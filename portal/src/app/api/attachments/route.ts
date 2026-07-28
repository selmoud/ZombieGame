import { createHash, randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Prisma } from "@/generated/prisma/client";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { isModuleUnlocked } from "@/lib/module-access-db";

const allowedTypes = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "image/png",
  "image/jpeg",
]);

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "UNAUTHORIZED" }, { status: 401 });
  const data = await request.formData();
  const assignmentId = String(data.get("assignmentId") ?? "");
  const questionId = String(data.get("questionId") ?? "");
  const file = data.get("file");
  if (!(file instanceof File)) {
    return Response.json({ error: "FILE_REQUIRED" }, { status: 400 });
  }
  const maxBytes = Number(process.env.MAX_UPLOAD_SIZE_MB ?? 20) * 1024 * 1024;
  if (file.size > maxBytes || !allowedTypes.has(file.type)) {
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
  const checksum = createHash("sha256").update(bytes).digest("hex");
  const storageKey = `${assignment.id}/${randomUUID()}`;
  const destination = path.join(
    /*turbopackIgnore: true*/ process.cwd(),
    process.env.UPLOAD_DIR ?? "data/uploads",
    storageKey,
  );
  await mkdir(path.dirname(destination), { recursive: true });
  await writeFile(destination, bytes, { flag: "wx" });

  const answer = await db.answer.upsert({
    where: {
      submissionId_questionId: {
        submissionId: assignment.submission.id,
        questionId,
      },
    },
    update: {
      value: { name: file.name } as Prisma.InputJsonValue,
      updatedById: user.id,
    },
    create: {
      submissionId: assignment.submission.id,
      questionId,
      value: { name: file.name } as Prisma.InputJsonValue,
      updatedById: user.id,
    },
  });
  const attachment = await db.attachment.create({
    data: {
      answerId: answer.id,
      storageKey,
      originalName: file.name,
      mimeType: file.type,
      sizeBytes: file.size,
      checksum,
    },
  });
  await db.answer.update({
    where: { id: answer.id },
    data: {
      value: {
        id: attachment.id,
        name: file.name,
        size: file.size,
      } as Prisma.InputJsonValue,
    },
  });
  return Response.json({
    value: { id: attachment.id, name: file.name, size: file.size },
  });
}
