import { getCurrentUser } from "@/lib/auth";
import { validateAnswers } from "@/lib/answer-validation";
import { db } from "@/lib/db";
import { isModuleUnlocked } from "@/lib/module-access-db";
import { isQuestionHidden } from "@/lib/questions";
import { isTrustedMutationRequest } from "@/lib/request-security";
import { portalLink, queueMaxNotification } from "@/lib/max-bot";

export async function POST(
  request: Request,
  context: RouteContext<"/api/assignments/[id]/submit">,
) {
  if (!isTrustedMutationRequest(request)) {
    return Response.json({ error: "INVALID_ORIGIN" }, { status: 403 });
  }
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "UNAUTHORIZED" }, { status: 401 });
  if (user.role === "ADMIN") {
    return Response.json(
      { error: "SUPER_EXPERT_DRAFT_ONLY" },
      { status: 403 },
    );
  }
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

  const submission = assignment.submission;
  const fromStatus = submission.status;
  await db.$transaction(async (tx) => {
    await tx.submission.update({
      where: { id: submission.id },
      data: {
        status: "SUBMITTED",
        submittedAt: new Date(),
        revision: { increment: 1 },
      },
    });
    await tx.statusHistory.create({
      data: {
        submissionId: submission.id,
        fromStatus,
        toStatus: "SUBMITTED",
        actorId: user.id,
      },
    });
    const binding = await tx.maxBotBinding.findUnique({
      where: { userId: user.id },
    });
    if (binding) {
      await queueMaxNotification(tx, {
        bindingId: binding.id,
        eventType: "MODULE_SUBMITTED",
        dedupeKey: `submission-submitted:${submission.id}:${submission.revision}`,
        text: `Модуль «${assignment.module.title}» отправлен модератору. Я сообщу о результате проверки.`,
        linkUrl: portalLink(),
        linkLabel: "Открыть портал",
      });
    }
  });
  return Response.json({ status: "SUBMITTED" });
}
