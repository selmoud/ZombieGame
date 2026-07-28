import { getCurrentUser } from "@/lib/auth";
import { validateAnswers } from "@/lib/answer-validation";
import { db } from "@/lib/db";
import { isModuleUnlocked } from "@/lib/module-access-db";
import { isQuestionHidden } from "@/lib/questions";

export async function POST(
  _request: Request,
  context: RouteContext<"/api/assignments/[id]/submit">,
) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "UNAUTHORIZED" }, { status: 401 });
  const { id } = await context.params;
  const assignment = await db.moduleAssignment.findUnique({
    where: { id },
    include: {
      submission: { include: { answers: true } },
      module: true,
      moduleVersion: { include: { questions: { orderBy: { order: "asc" } } } },
    },
  });
  if (!assignment || assignment.userId !== user.id || !assignment.submission) {
    return Response.json({ error: "NOT_FOUND" }, { status: 404 });
  }
  if (!(await isModuleUnlocked(user.id, assignment.module.order))) {
    return Response.json({ error: "MODULE_LOCKED" }, { status: 403 });
  }
  if (!["DRAFT", "NEEDS_REVISION"].includes(assignment.submission.status)) {
    return Response.json({ error: "INVALID_STATUS" }, { status: 409 });
  }

  const answers = Object.fromEntries(
    assignment.submission.answers.map((answer) => [
      answer.questionId,
      answer.value,
    ]),
  );
  const visibleQuestions = assignment.moduleVersion.questions.filter(
    (question) => !isQuestionHidden(question.config),
  );
  const errors = validateAnswers(visibleQuestions, answers);
  if (Object.keys(errors).length) {
    return Response.json({ error: "VALIDATION_ERROR", fields: errors }, { status: 422 });
  }

  const fromStatus = assignment.submission.status;
  await db.$transaction([
    db.submission.update({
      where: { id: assignment.submission.id },
      data: {
        status: "SUBMITTED",
        submittedAt: new Date(),
        revision: { increment: 1 },
      },
    }),
    db.statusHistory.create({
      data: {
        submissionId: assignment.submission.id,
        fromStatus,
        toStatus: "SUBMITTED",
        actorId: user.id,
      },
    }),
  ]);
  return Response.json({ status: "SUBMITTED" });
}
