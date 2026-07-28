"use server";

import { unlink } from "node:fs/promises";
import path from "node:path";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { hashPassword } from "@/lib/password";

export type CreateExpertState = {
  error?: string;
  success?: boolean;
  expert?: string;
};

export async function createExpert(
  _previousState: CreateExpertState,
  formData: FormData,
): Promise<CreateExpertState> {
  const admin = await requireRole("ADMIN");
  const fullName = String(formData.get("fullName") ?? "").trim();
  const companyName = String(formData.get("company") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const passwordConfirmation = String(
    formData.get("passwordConfirmation") ?? "",
  );
  if (fullName.split(/\s+/).length < 2 || !companyName) {
    return { error: "Укажите фамилию, имя и компанию." };
  }
  if (password.length < 8) {
    return { error: "Пароль должен содержать не менее 8 символов." };
  }
  if (password !== passwordConfirmation) {
    return { error: "Пароли не совпадают." };
  }
  const existingUser = await db.user.findFirst({
    where: { fullName: { equals: fullName, mode: "insensitive" } },
    select: { id: true },
  });
  if (existingUser) {
    return { error: "Пользователь с таким именем уже существует." };
  }

  await db.$transaction(async (tx) => {
    const [company, subgroup, modules] = await Promise.all([
      tx.company.upsert({
        where: { name: companyName },
        update: {},
        create: { name: companyName },
      }),
      tx.subgroup.upsert({
        where: { name: "Медиа и контент" },
        update: {},
        create: { name: "Медиа и контент" },
      }),
      tx.module.findMany({
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
    const user = await tx.user.create({
      data: {
        fullName,
        direction: "Коммуникации, медиа и развлечения",
        role: "EXPERT",
        companyId: company.id,
        subgroupId: subgroup.id,
        isActive: true,
        activatedAt: new Date(),
        passwordHash: await hashPassword(password),
      },
    });
    for (const moduleRecord of modules) {
      const version = moduleRecord.versions[0];
      if (!version) continue;
      const assignment = await tx.moduleAssignment.create({
        data: {
          userId: user.id,
          moduleId: moduleRecord.id,
          moduleVersionId: version.id,
          assignedById: admin.id,
        },
      });
      await tx.submission.create({ data: { assignmentId: assignment.id } });
    }
  });
  revalidatePath("/admin");
  return {
    success: true,
    expert: fullName,
  };
}

export type ResetExpertPasswordState = {
  error?: string;
  success?: boolean;
};

export async function resetExpertPassword(
  _previousState: ResetExpertPasswordState,
  formData: FormData,
): Promise<ResetExpertPasswordState> {
  await requireRole("ADMIN");
  const userId = String(formData.get("userId") ?? "");
  const password = String(formData.get("password") ?? "");
  const passwordConfirmation = String(
    formData.get("passwordConfirmation") ?? "",
  );
  if (password.length < 8) {
    return { error: "Пароль должен содержать не менее 8 символов." };
  }
  if (password !== passwordConfirmation) {
    return { error: "Пароли не совпадают." };
  }
  const user = await db.user.findFirst({
    where: { id: userId, role: { in: ["EXPERT", "LEAD"] } },
    select: { id: true },
  });
  if (!user) return { error: "Эксперт не найден." };

  await db.$transaction([
    db.user.update({
      where: { id: user.id },
      data: {
        passwordHash: await hashPassword(password),
        isActive: true,
        activatedAt: new Date(),
      },
    }),
    db.session.updateMany({
      where: { userId: user.id, revokedAt: null },
      data: { revokedAt: new Date() },
    }),
  ]);
  revalidatePath("/admin");
  return { success: true };
}

export async function deleteExpert(formData: FormData) {
  await requireRole("ADMIN");
  const userId = String(formData.get("userId") ?? "");
  const expert = await db.user.findFirst({
    where: { id: userId, role: { in: ["EXPERT", "LEAD"] } },
    select: { id: true },
  });
  if (!expert) redirect("/admin?expert=not-found");

  const attachments = await db.attachment.findMany({
    where: {
      answer: {
        OR: [
          { updatedById: expert.id },
          { submission: { assignment: { userId: expert.id } } },
        ],
      },
    },
    select: { storageKey: true },
  });
  await db.$transaction(async (tx) => {
    await tx.answer.deleteMany({
      where: {
        OR: [
          { updatedById: expert.id },
          { submission: { assignment: { userId: expert.id } } },
        ],
      },
    });
    await tx.reviewComment.deleteMany({
      where: {
        OR: [
          { authorId: expert.id },
          { submission: { assignment: { userId: expert.id } } },
        ],
      },
    });
    await tx.statusHistory.deleteMany({
      where: {
        OR: [
          { actorId: expert.id },
          { submission: { assignment: { userId: expert.id } } },
        ],
      },
    });
    await tx.invitationToken.updateMany({
      where: { createdById: expert.id },
      data: { createdById: null },
    });
    await tx.moduleAssignment.updateMany({
      where: { assignedById: expert.id },
      data: { assignedById: null },
    });
    await tx.moduleAssignment.deleteMany({ where: { userId: expert.id } });
    await tx.user.delete({ where: { id: expert.id } });
  });

  const uploadRoot = path.join(
    /*turbopackIgnore: true*/ process.cwd(),
    process.env.UPLOAD_DIR ?? "data/uploads",
  );
  await Promise.all(
    attachments.map(async ({ storageKey }) => {
      if (!/^[0-9a-f-]{36}\/[0-9a-f-]{36}$/i.test(storageKey)) return;
      const target = path.join(
        /*turbopackIgnore: true*/ uploadRoot,
        storageKey,
      );
      await unlink(target).catch(() => undefined);
    }),
  );
  redirect("/admin?expert=deleted");
}

export async function approveRegistration(formData: FormData) {
  const admin = await requireRole("ADMIN");
  const requestId = String(formData.get("requestId") ?? "");
  const request = await db.registrationRequest.findUnique({
    where: { id: requestId },
  });
  if (!request || request.status !== "PENDING") {
    redirect("/admin?registration=unavailable");
  }
  const existingUser = await db.user.findFirst({
    where: { fullName: { equals: request.fullName, mode: "insensitive" } },
  });
  if (existingUser) {
    redirect("/admin?registration=duplicate");
  }

  await db.$transaction(async (tx) => {
    const company = await tx.company.upsert({
      where: { name: request.companyName },
      update: {},
      create: { name: request.companyName },
    });
    const subgroup = await tx.subgroup.upsert({
      where: { name: "Медиа и контент" },
      update: {},
      create: { name: "Медиа и контент" },
    });
    const expert = await tx.user.create({
      data: {
        fullName: request.fullName,
        companyId: company.id,
        subgroupId: subgroup.id,
        direction: "Коммуникации, медиа и развлечения",
        role: "EXPERT",
        isActive: true,
        activatedAt: new Date(),
        passwordHash: request.passwordHash,
      },
    });
    const modules = await tx.module.findMany({
      where: { isActive: true },
      include: {
        versions: {
          where: { publishedAt: { not: null } },
          orderBy: { version: "desc" },
          take: 1,
        },
      },
    });
    for (const moduleRecord of modules) {
      const version = moduleRecord.versions[0];
      if (!version) continue;
      const assignment = await tx.moduleAssignment.create({
        data: {
          userId: expert.id,
          moduleId: moduleRecord.id,
          moduleVersionId: version.id,
          assignedById: admin.id,
        },
      });
      await tx.submission.create({ data: { assignmentId: assignment.id } });
    }
    await tx.registrationRequest.update({
      where: { id: request.id },
      data: {
        status: "APPROVED",
        reviewedById: admin.id,
        reviewedAt: new Date(),
      },
    });
  });
  redirect("/admin?registration=approved");
}

export async function rejectRegistration(formData: FormData) {
  const admin = await requireRole("ADMIN");
  const requestId = String(formData.get("requestId") ?? "");
  await db.registrationRequest.updateMany({
    where: { id: requestId, status: "PENDING" },
    data: {
      status: "REJECTED",
      reviewedById: admin.id,
      reviewedAt: new Date(),
    },
  });
  redirect("/admin?registration=rejected");
}
