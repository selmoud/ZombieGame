"use server";

import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  portalLink,
  queueMaxNotification,
  resolveMaxAdminNotification,
} from "@/lib/max-bot";
import { completedModulesMessage } from "@/lib/max-reminder-policy";

export async function addComment(formData: FormData) {
  const admin = await requireRole("ADMIN");
  const submissionId = String(formData.get("submissionId") ?? "");
  const body = String(formData.get("body") ?? "").trim();
  if (body && body.length <= 5_000) {
    await db.reviewComment.create({
      data: { submissionId, authorId: admin.id, body },
    });
  }
  redirect(`/admin/submissions/${submissionId}`);
}

export async function requestRevision(formData: FormData) {
  const admin = await requireRole("ADMIN");
  const submissionId = String(formData.get("submissionId") ?? "");
  const reason = String(formData.get("reason") ?? "").trim();
  const submission = await db.submission.findUnique({
    where: { id: submissionId },
    include: {
      assignment: {
        include: {
          module: true,
          user: { include: { maxBotBinding: true } },
        },
      },
    },
  });
  if (
    !submission ||
    submission.status !== "SUBMITTED" ||
    !reason ||
    reason.length > 5_000
  ) {
    redirect(`/admin/submissions/${submissionId}?error=revision`);
  }
  await db.$transaction(async (tx) => {
    await tx.reviewComment.create({
      data: { submissionId, authorId: admin.id, body: reason },
    });
    await tx.submission.update({
      where: { id: submissionId },
      data: { status: "NEEDS_REVISION", revision: { increment: 1 } },
    });
    await tx.statusHistory.create({
      data: {
        submissionId,
        actorId: admin.id,
        fromStatus: submission.status,
        toStatus: "NEEDS_REVISION",
        reason,
      },
    });
    await resolveMaxAdminNotification(tx, {
      entityType: "SUBMISSION",
      entityId: submission.id,
    });
    const binding = submission.assignment.user.maxBotBinding;
    if (binding) {
      await queueMaxNotification(tx, {
        bindingId: binding.id,
        eventType: "MODULE_NEEDS_REVISION",
        dedupeKey: `submission-revision:${submission.id}:${submission.revision}`,
        text: `Модуль «${submission.assignment.module.title}» возвращён на доработку.\n\nКомментарий модератора: ${reason}`,
        linkUrl: portalLink(`/modules/${submission.assignmentId}`),
        linkLabel: "Открыть модуль",
      });
    }
  });
  redirect(`/admin/submissions/${submissionId}`);
}

export async function acceptSubmission(formData: FormData) {
  const admin = await requireRole("ADMIN");
  const submissionId = String(formData.get("submissionId") ?? "");
  const submission = await db.submission.findUnique({
    where: { id: submissionId },
    include: {
      assignment: {
        include: {
          module: true,
          user: { include: { maxBotBinding: true } },
        },
      },
    },
  });
  if (!submission || submission.status !== "SUBMITTED") {
    redirect(`/admin/submissions/${submissionId}?error=status`);
  }
  await db.$transaction(async (tx) => {
    await tx.submission.update({
      where: { id: submissionId },
      data: { status: "ACCEPTED", acceptedAt: new Date(), revision: { increment: 1 } },
    });
    await tx.statusHistory.create({
      data: {
        submissionId,
        actorId: admin.id,
        fromStatus: submission.status,
        toStatus: "ACCEPTED",
      },
    });
    await resolveMaxAdminNotification(tx, {
      entityType: "SUBMISSION",
      entityId: submission.id,
    });
    const binding = submission.assignment.user.maxBotBinding;
    if (binding) {
      const assignments = await tx.moduleAssignment.findMany({
        where: {
          userId: submission.assignment.user.id,
          module: { isActive: true },
        },
        select: { submission: { select: { status: true } } },
      });
      const activeModuleCount = await tx.module.count({
        where: { isActive: true },
      });
      const finalModule =
        activeModuleCount > 0 &&
        assignments.length === activeModuleCount &&
        assignments.every((item) => item.submission?.status === "ACCEPTED");
      await queueMaxNotification(tx, {
        bindingId: binding.id,
        eventType: finalModule ? "ALL_MODULES_ACCEPTED" : "MODULE_ACCEPTED",
        dedupeKey: finalModule
          ? `all-modules-completed:${submission.assignment.user.id}`
          : `submission-accepted:${submission.id}`,
        text: finalModule
          ? completedModulesMessage
          : `Модуль «${submission.assignment.module.title}» принят модератором. Следующий модуль открыт для заполнения.`,
        linkUrl: finalModule ? undefined : portalLink("/dashboard"),
        linkLabel: finalModule ? undefined : "Открыть портал",
      });
    }
  });
  redirect(`/admin/submissions/${submissionId}`);
}
