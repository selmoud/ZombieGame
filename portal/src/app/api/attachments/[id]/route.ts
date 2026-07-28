import { readFile } from "node:fs/promises";
import path from "node:path";
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
