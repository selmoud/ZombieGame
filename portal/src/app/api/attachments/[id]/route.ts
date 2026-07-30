import { readFile, unlink } from "node:fs/promises";
import path from "node:path";
import { Prisma } from "@/generated/prisma/client";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { leadsExpertSubgroup } from "@/lib/leader-access";
import { isModuleUnlocked } from "@/lib/module-access-db";
import { isTrustedMutationRequest } from "@/lib/request-security";

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
  if (!attachment || attachment.deletedAt) {
    return new Response("Not found", { status: 404 });
  }
  const submission = attachment.answer.submission;
  const isOwner = submission.assignment.userId === user.id;
  const isLeaderViewer =
    user.role !== "ADMIN" &&
    !isOwner &&
    submission.status === "ACCEPTED" &&
    (await leadsExpertSubgroup(user.id, submission.assignment.userId));
  if (user.role !== "ADMIN" && !isOwner && !isLeaderViewer) {
    return new Response("Not found", { status: 404 });
  }
  if (!/^[0-9a-f-]{36}\/[0-9a-f-]{36}$/i.test(attachment.storageKey)) {
    return new Response("Not found", { status: 404 });
  }
  const data = await readFile(
    path.join(
      /*turbopackIgnore: true*/ process.cwd(),
      process.env.UPLOAD_DIR ?? "data/uploads",
      attachment.storageKey,
    ),
  ).catch(() => null);
  if (!data) return new Response("Not found", { status: 404 });
  return new Response(data, {
    headers: {
      "Content-Type": attachment.mimeType,
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(attachment.originalName)}`,
      "Cache-Control": "private, no-store",
      "Content-Security-Policy": "sandbox",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

export async function DELETE(
  request: Request,
  context: RouteContext<"/api/attachments/[id]">,
) {
  if (!isTrustedMutationRequest(request)) {
    return Response.json({ error: "INVALID_ORIGIN" }, { status: 403 });
  }
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "UNAUTHORIZED" }, { status: 401 });
  const { id } = await context.params;
  const attachment = await db.attachment.findUnique({
    where: { id },
    include: {
      answer: {
        include: {
          submission: {
            include: { assignment: { include: { module: true } } },
          },
        },
      },
    },
  });
  if (!attachment || attachment.deletedAt) {
    return Response.json({ error: "NOT_FOUND" }, { status: 404 });
  }
  const submission = attachment.answer.submission;
  const unlocked = await isModuleUnlocked(
    user.id,
    submission.assignment.module.order,
  );
  const canDelete =
    submission.assignment.userId === user.id &&
    unlocked &&
    ["NOT_STARTED", "DRAFT", "NEEDS_REVISION"].includes(submission.status);
  if (!canDelete) {
    return Response.json({ error: "NOT_ALLOWED" }, { status: 403 });
  }

  const remainingAttachments = await db.$transaction(async (tx) => {
    await tx.attachment.update({
      where: { id: attachment.id },
      data: { deletedAt: new Date() },
    });
    const remaining = await tx.attachment.findMany({
      where: { answerId: attachment.answerId, deletedAt: null },
      orderBy: { createdAt: "asc" },
      select: { id: true, originalName: true, sizeBytes: true },
    });
    const value = remaining.map((item) => ({
      id: item.id,
      name: item.originalName,
      size: Number(item.sizeBytes),
    }));
    await tx.answer.update({
      where: { id: attachment.answerId },
      data: { value: value as Prisma.InputJsonValue },
    });
    return value;
  });

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
  return Response.json({ deleted: true, value: remainingAttachments });
}
