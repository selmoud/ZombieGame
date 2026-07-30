import { createHash, randomUUID } from "node:crypto";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Prisma } from "@/generated/prisma/client";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  isAllowedUploadMimeType,
  validateUpload,
} from "@/lib/file-security";
import { isModuleUnlocked } from "@/lib/module-access-db";
import { isTrustedMutationRequest } from "@/lib/request-security";

const MAX_ATTACHMENTS_PER_ANSWER = 10;

class AttachmentLimitError extends Error {}

export async function POST(request: Request) {
  if (!isTrustedMutationRequest(request)) {
    return Response.json({ error: "INVALID_ORIGIN" }, { status: 403 });
  }
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "UNAUTHORIZED" }, { status: 401 });
  const maxBytes = Number(process.env.MAX_UPLOAD_SIZE_MB ?? 20) * 1024 * 1024;
  const contentLength = Number(request.headers.get("content-length"));
  if (
    !Number.isFinite(contentLength) ||
    contentLength <= 0 ||
    contentLength > maxBytes + 128 * 1024
  ) {
    return Response.json({ error: "PAYLOAD_TOO_LARGE" }, { status: 413 });
  }
  const data = await request.formData();
  const assignmentId = String(data.get("assignmentId") ?? "");
  const questionId = String(data.get("questionId") ?? "");
  const file = data.get("file");
  if (!(file instanceof File)) {
    return Response.json({ error: "FILE_REQUIRED" }, { status: 400 });
  }
  if (
    file.size <= 0 ||
    file.size > maxBytes ||
    !isAllowedUploadMimeType(file.type)
  ) {
    return Response.json({ error: "FILE_NOT_ALLOWED" }, { status: 422 });
  }
  const assignment = await db.moduleAssignment.findUnique({
    where: { id: assignmentId },
    include: {
      module: true,
      submission: true,
      moduleVersion: { include: { questions: true } },
    },
  });
  const question = assignment?.moduleVersion.questions.find(
    (item) => item.id === questionId && item.type === "FILE",
  );
  if (
    !assignment ||
    assignment.userId !== user.id ||
    !assignment.submission ||
    !question ||
    !["NOT_STARTED", "DRAFT", "NEEDS_REVISION"].includes(assignment.submission.status)
  ) {
    return Response.json({ error: "NOT_ALLOWED" }, { status: 403 });
  }
  if (!(await isModuleUnlocked(user.id, assignment.module.order))) {
    return Response.json({ error: "MODULE_LOCKED" }, { status: 403 });
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  const validatedFile = validateUpload(file.name, file.type, bytes);
  if (!validatedFile.allowed) {
    return Response.json({ error: "FILE_CONTENT_MISMATCH" }, { status: 422 });
  }
  const checksum = createHash("sha256").update(bytes).digest("hex");
  const activeAttachmentCount = await db.attachment.count({
    where: {
      answer: {
        submissionId: assignment.submission.id,
        questionId,
      },
      deletedAt: null,
    },
  });
  if (activeAttachmentCount >= MAX_ATTACHMENTS_PER_ANSWER) {
    return Response.json({ error: "ATTACHMENT_LIMIT" }, { status: 422 });
  }
  const storageKey = `${assignment.id}/${randomUUID()}`;
  const destination = path.join(
    /*turbopackIgnore: true*/ process.cwd(),
    process.env.UPLOAD_DIR ?? "data/uploads",
    storageKey,
  );
  await mkdir(path.dirname(destination), { recursive: true });
  await writeFile(destination, bytes, { flag: "wx", mode: 0o600 });

  let attachments;
  try {
    attachments = await db.$transaction(async (tx) => {
      const answer = await tx.answer.upsert({
        where: {
          submissionId_questionId: {
            submissionId: assignment.submission!.id,
            questionId,
          },
        },
        update: {
          updatedById: user.id,
        },
        create: {
          submissionId: assignment.submission!.id,
          questionId,
          value: [] as Prisma.InputJsonValue,
          updatedById: user.id,
        },
      });
      const attachmentCount = await tx.attachment.count({
        where: { answerId: answer.id, deletedAt: null },
      });
      if (attachmentCount >= MAX_ATTACHMENTS_PER_ANSWER) {
        throw new AttachmentLimitError();
      }
      await tx.attachment.create({
        data: {
          answerId: answer.id,
          storageKey,
          originalName: validatedFile.name,
          mimeType: validatedFile.mimeType,
          sizeBytes: file.size,
          checksum,
        },
      });
      const activeAttachments = await tx.attachment.findMany({
        where: { answerId: answer.id, deletedAt: null },
        orderBy: { createdAt: "asc" },
        select: { id: true, originalName: true, sizeBytes: true },
      });
      const value = activeAttachments.map((item) => ({
        id: item.id,
        name: item.originalName,
        size: Number(item.sizeBytes),
      }));
      await tx.answer.update({
        where: { id: answer.id },
        data: { value: value as Prisma.InputJsonValue },
      });
      return value;
    }, { isolationLevel: "Serializable" });
  } catch (error) {
    await unlink(destination).catch(() => undefined);
    if (error instanceof AttachmentLimitError) {
      return Response.json({ error: "ATTACHMENT_LIMIT" }, { status: 422 });
    }
    throw error;
  }
  return Response.json({ value: attachments });
}
