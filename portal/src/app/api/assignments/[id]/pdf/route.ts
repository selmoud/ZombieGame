import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { isModuleUnlocked } from "@/lib/module-access-db";
import { isQuestionHidden } from "@/lib/questions";
import {
  canDownloadSubmissionResults,
  statusLabels,
} from "@/lib/status";
import { createSubmissionPdf } from "@/lib/submission-pdf";
import { formatSubgroups } from "@/lib/subgroups";

export const runtime = "nodejs";

export async function GET(
  request: Request,
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
      user: {
        include: {
          company: true,
          subgroupMemberships: { include: { subgroup: true } },
        },
      },
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
  if (
    currentUser.role !== "ADMIN" &&
    !canDownloadSubmissionResults(assignment.submission.status)
  ) {
    return Response.json(
      { error: "RESULTS_NOT_AVAILABLE" },
      { status: 403 },
    );
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
    subgroupName: formatSubgroups(assignment.user.subgroupMemberships),
    statusLabel: statusLabels[assignment.submission.status],
    attachmentBaseUrl: `${(
      process.env.APP_URL ?? new URL(request.url).origin
    ).replace(/\/$/, "")}/api/attachments`,
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
            visibleWhen?: {
              columnKey: string;
              equals?: string;
              includes?: string;
            };
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
