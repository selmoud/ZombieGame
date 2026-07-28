import type { Prisma } from "@/generated/prisma/client";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";

export async function PUT(
  request: Request,
  context: RouteContext<"/api/assignments/[id]/draft">,
) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "UNAUTHORIZED" }, { status: 401 });
  const { id } = await context.params;
  const body = (await request.json()) as {
    revision?: number;
    answers?: Record<string, unknown>;
  };
  if (
    typeof body.revision !== "number" ||
    !body.answers ||
    typeof body.answers !== "object"
  ) {
    return Response.json({ error: "INVALID_BODY" }, { status: 400 });
  }

  const assignment = await db.moduleAssignment.findUnique({
    where: { id },
    include: { submission: true, moduleVersion: { include: { questions: true } } },
  });
  if (!assignment || assignment.userId !== user.id || !assignment.submission) {
    return Response.json({ error: "NOT_FOUND" }, { status: 404 });
  }
  if (!["NOT_STARTED", "DRAFT", "NEEDS_REVISION"].includes(assignment.submission.status)) {
    return Response.json({ error: "READ_ONLY" }, { status: 409 });
  }
  if (assignment.submission.revision !== body.revision) {
    return Response.json(
      { error: "REVISION_CONFLICT", revision: assignment.submission.revision },
      { status: 409 },
    );
  }

  const questionIds = new Set(
    assignment.moduleVersion.questions.map((question) => question.id),
  );
  const entries = Object.entries(body.answers).filter(([questionId]) =>
    questionIds.has(questionId),
  );

  const updated = await db.$transaction(async (tx) => {
    for (const [questionId, value] of entries) {
      await tx.answer.upsert({
        where: {
          submissionId_questionId: {
            submissionId: assignment.submission!.id,
            questionId,
          },
        },
        update: {
          value: value as Prisma.InputJsonValue,
          updatedById: user.id,
        },
        create: {
          submissionId: assignment.submission!.id,
          questionId,
          value: value as Prisma.InputJsonValue,
          updatedById: user.id,
        },
      });
    }
    return tx.submission.update({
      where: {
        id: assignment.submission!.id,
        revision: body.revision,
      },
      data: {
        revision: { increment: 1 },
        status:
          assignment.submission!.status === "NOT_STARTED"
            ? "DRAFT"
            : undefined,
      },
    });
  });

  return Response.json({ revision: updated.revision, status: updated.status });
}
