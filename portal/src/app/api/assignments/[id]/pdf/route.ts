import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { isModuleUnlocked } from "@/lib/module-access-db";
import { isQuestionHidden } from "@/lib/questions";
import { statusLabels } from "@/lib/status";
import { createSubmissionPdf } from "@/lib/submission-pdf";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  context: RouteContext<"/api/assignments/[id]/pdf">,
) {
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    return Response.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }
  const { id } = await context.params;
  const assignment = await db.moduleAssignment.findUnique({
    where: { id },
    include: {
      user: { include: { company: true, subgroup: true } },
      module: true,
      moduleVersion: {
        include: { questions: { orderBy: { order: "asc" } } },
      },
      submission: { include: { answers: true } },
    },
  });
  if (
    !assignment ||
    !assignment.submission ||
    (currentUser.role !== "ADMIN" && assignment.userId !== currentUser.id)
  ) {
    return Response.json({ error: "NOT_FOUND" }, { status: 404 });
  }
  if (
    currentUser.role !== "ADMIN" &&
    !(await isModuleUnlocked(currentUser.id, assignment.module.order))
  ) {
    return Response.json({ error: "MODULE_LOCKED" }, { status: 403 });
  }

  const answerMap = new Map(
    assignment.submission.answers.map((answer) => [
      answer.questionId,
      answer.value,
    ]),
  );
  const pdf = await createSubmissionPdf({
    moduleOrder: assignment.module.order,
    moduleTitle: assignment.module.title,
    expertName: assignment.user.fullName,
    companyName: assignment.user.company?.name ?? "",
    subgroupName: assignment.user.subgroup?.name ?? "",
    statusLabel: statusLabels[assignment.submission.status],
    questions: assignment.moduleVersion.questions
      .filter((question) => !isQuestionHidden(question.config))
      .map((question) => ({
        title: question.title,
        config: question.config as {
          options?: Array<{ value: string; label: string }>;
          columns?: Array<{
            key: string;
            title: string;
            options?: Array<{ value: string; label: string }>;
            defaultValue?: string;
            visibleWhen?: { columnKey: string; equals: string };
          }>;
          rowLabel?: string;
        },
        value: answerMap.get(question.id),
      })),
  });

  const fileName = `module-${String(assignment.module.order).padStart(2, "0")}.pdf`;
  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${fileName}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
