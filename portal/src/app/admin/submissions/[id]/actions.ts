"use server";

import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";

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
  const submission = await db.submission.findUnique({ where: { id: submissionId } });
  if (
    !submission ||
    submission.status !== "SUBMITTED" ||
    !reason ||
    reason.length > 5_000
  ) {
    redirect(`/admin/submissions/${submissionId}?error=revision`);
  }
  await db.$transaction([
    db.reviewComment.create({
      data: { submissionId, authorId: admin.id, body: reason },
    }),
    db.submission.update({
      where: { id: submissionId },
      data: { status: "NEEDS_REVISION", revision: { increment: 1 } },
    }),
    db.statusHistory.create({
      data: {
        submissionId,
        actorId: admin.id,
        fromStatus: submission.status,
        toStatus: "NEEDS_REVISION",
        reason,
      },
    }),
  ]);
  redirect(`/admin/submissions/${submissionId}`);
}

export async function acceptSubmission(formData: FormData) {
  const admin = await requireRole("ADMIN");
  const submissionId = String(formData.get("submissionId") ?? "");
  const submission = await db.submission.findUnique({ where: { id: submissionId } });
  if (!submission || submission.status !== "SUBMITTED") {
    redirect(`/admin/submissions/${submissionId}?error=status`);
  }
  await db.$transaction([
    db.submission.update({
      where: { id: submissionId },
      data: { status: "ACCEPTED", acceptedAt: new Date(), revision: { increment: 1 } },
    }),
    db.statusHistory.create({
      data: {
        submissionId,
        actorId: admin.id,
        fromStatus: submission.status,
        toStatus: "ACCEPTED",
      },
    }),
  ]);
  redirect(`/admin/submissions/${submissionId}`);
}
