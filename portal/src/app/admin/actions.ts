"use server";

import { createInvitationToken, hashInvitationToken, requireRole } from "@/lib/auth";
import { db } from "@/lib/db";

export type CreateExpertState = {
  error?: string;
  link?: string;
  expert?: string;
};

export async function createExpert(
  _previousState: CreateExpertState,
  formData: FormData,
): Promise<CreateExpertState> {
  const admin = await requireRole("ADMIN");
  const fullName = String(formData.get("fullName") ?? "").trim();
  const companyName = String(formData.get("company") ?? "").trim();
  const position = String(formData.get("position") ?? "").trim();
  const subgroupName = String(formData.get("subgroup") ?? "").trim();
  if (!fullName || !companyName || !subgroupName) {
    return { error: "Заполните обязательные поля." };
  }
  const [company, subgroup, modules] = await Promise.all([
    db.company.upsert({
      where: { name: companyName },
      update: {},
      create: { name: companyName },
    }),
    db.subgroup.upsert({
      where: { name: subgroupName },
      update: {},
      create: { name: subgroupName },
    }),
    db.module.findMany({
      where: { isActive: true },
      include: {
        versions: {
          where: { publishedAt: { not: null } },
          orderBy: { version: "desc" },
          take: 1,
        },
      },
    }),
  ]);
  const user = await db.user.create({
    data: {
      fullName,
      position: position || null,
      role: "EXPERT",
      companyId: company.id,
      subgroupId: subgroup.id,
    },
  });
  for (const moduleRecord of modules) {
    if (!moduleRecord.versions[0]) continue;
    const assignment = await db.moduleAssignment.create({
      data: {
        userId: user.id,
        moduleId: moduleRecord.id,
        moduleVersionId: moduleRecord.versions[0].id,
        assignedById: admin.id,
      },
    });
    await db.submission.create({ data: { assignmentId: assignment.id } });
  }
  const rawToken = createInvitationToken();
  await db.invitationToken.create({
    data: {
      userId: user.id,
      tokenHash: hashInvitationToken(rawToken),
      expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      createdById: admin.id,
    },
  });
  return {
    link: `${process.env.APP_URL ?? "http://localhost:3000"}/invite/${rawToken}`,
    expert: fullName,
  };
}
