import { readFile, unlink } from "node:fs/promises";
import path from "node:path";
import { Prisma } from "@/generated/prisma/client";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET(
  _request: Request,
  context: RouteContext<"/api/attachments/[id]">,
) {
  const user = await getCurrentUser();
  if (!user) return new Response("Unauthorized", { status: 401 });
  const { id } = await context.params;
  const attachment = await db.attachment.findUnique({
    where: { id },
    include: {
      answer: {
        include: {
          submission: {
            include: { assignment: { include: { user: true } } },
          },
        },
      },
    },
  });
  if (
    !attachment ||
    attachment.deletedAt ||
    (user.role !== "ADMIN" &&
      attachment.answer.submission.assignment.userId !== user.id)
  ) {
    return new Response("Not found", { status: 404 });
  }
  const data = await readFile(
    path.join(
      /*turbopackIgnore: true*/ process.cwd(),
      process.env.UPLOAD_DIR ?? "data/uploads",
      attachment.storageKey,
    ),
  );
  return new Response(data, {
    headers: {
      "Content-Type": attachment.mimeType,
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(attachment.originalName)}`,
      "Cache-Control": "private, no-store",
    },
  });
}

export async function DELETE(
  _request: Request,
  context: RouteContext<"/api/attachments/[id]">,
) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "UNAUTHORIZED" }, { status: 401 });
  const { id } = await context.params;
  const attachment = await db.attachment.findUnique({
    where: { id },
    include: {
      answer: {
        include: {
          submission: {
            include: { assignment: true },
          },
        },
      },
    },
  });
  if (!attachment || attachment.deletedAt) {
    return Response.json({ error: "NOT_FOUND" }, { status: 404 });
  }
  const submission = attachment.answer.submission;
  const canDelete =
    submission.assignment.userId === user.id &&
    ["NOT_STARTED", "DRAFT", "NEEDS_REVISION"].includes(submission.status);
  if (!canDelete) {
    return Response.json({ error: "NOT_ALLOWED" }, { status: 403 });
  }

  await db.$transaction([
    db.attachment.update({
      where: { id: attachment.id },
      data: { deletedAt: new Date() },
    }),
    db.answer.update({
      where: { id: attachment.answerId },
      data: { value: Prisma.JsonNull },
    }),
  ]);

  const uploadRoot = path.join(
    /*turbopackIgnore: true*/ process.cwd(),
    process.env.UPLOAD_DIR ?? "data/uploads",
  );
  if (/^[0-9a-f-]{36}\/[0-9a-f-]{36}$/i.test(attachment.storageKey)) {
    const target = path.join(
      /*turbopackIgnore: true*/ uploadRoot,
      attachment.storageKey,
    );
    await unlink(target).catch(() => undefined);
  }
  return Response.json({ deleted: true });
}
