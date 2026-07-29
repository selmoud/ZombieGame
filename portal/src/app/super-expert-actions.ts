"use server";

import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";

export async function enterSuperExpertMode() {
  const admin = await requireRole("ADMIN");

  await db.$transaction(async (tx) => {
    const modules = await tx.module.findMany({
      where: { isActive: true },
      include: {
        versions: {
          where: { publishedAt: { not: null } },
          orderBy: { version: "desc" },
          take: 1,
        },
      },
      orderBy: { order: "asc" },
    });

    await tx.user.update({
      where: { id: admin.id },
      data: { unlockAllModules: true },
    });

    for (const moduleRecord of modules) {
      const version = moduleRecord.versions[0];
      if (!version) continue;

      await tx.moduleAssignment.upsert({
        where: {
          userId_moduleId: {
            userId: admin.id,
            moduleId: moduleRecord.id,
          },
        },
        update: {},
        create: {
          userId: admin.id,
          moduleId: moduleRecord.id,
          moduleVersionId: version.id,
          assignedById: admin.id,
          submission: { create: {} },
        },
      });
    }
  });

  redirect("/dashboard");
}
