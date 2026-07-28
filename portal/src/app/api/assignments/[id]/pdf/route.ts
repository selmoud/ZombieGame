import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { isModuleUnlocked } from "@/lib/module-access-db";
import { isQuestionHidden } from "@/lib/questions";
import { leadsExpertSubgroup } from "@/lib/leader-access";
import {
  canDownloadSubmissionResults,
  statusLabels,
} from "@/lib/status";
import { createSubmissionPdf } from "@/lib/submission-pdf";
import { formatSubgroups } from "@/lib/subgroups";

export const runtime = "nodejs";

async function renderPdf(
  request: Request,
  context: RouteContext<"/api/assignments/[id]/pdf">,
  previewAnswers?: Record<string, unknown>,
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
  if (!assignment || !assignment.submission) {
    return Response.json({ error: "NOT_FOUND" }, { status: 404 });
  }
  const isAdmin = currentUser.role === "ADMIN";
  const isOwner = assignment.userId === currentUser.id;
  const isLeaderViewer =
    !isAdmin &&
    !isOwner &&
    assignment.submission.status === "ACCEPTED" &&
    (await leadsExpertSubgroup(currentUser.id, assignment.userId));
  if (
    (!isAdmin && !isOwner && !isLeaderViewer) ||
    (previewAnswers !== undefined && !isAdmin && !isOwner)
  ) {
    return Response.json({ error: "NOT_FOUND" }, { status: 404 });
  }
  if (
    isOwner &&
    !(await isModuleUnlocked(currentUser.id, assignment.module.order))
  ) {
    return Response.json({ error: "MODULE_LOCKED" }, { status: 403 });
  }
  if (
    isOwner &&
    previewAnswers === undefined &&
    new URL(request.url).searchParams.get("preview") !== "1" &&
    !canDownloadSubmissionResults(assignment.submission.status)
  ) {
    return Response.json(
      { error: "RESULTS_NOT_AVAILABLE" },
      { status: 403 },
    );
  }

  const answerMap = new Map<string, unknown>(
    assignment.submission.answers.map((answer) => [
      answer.questionId,
      answer.value,
    ]),
  );
  if (previewAnswers) {
    const questionIds = new Set(
      assignment.moduleVersion.questions.map((question) => question.id),
    );
    Object.entries(previewAnswers).forEach(([questionId, value]) => {
      if (questionIds.has(questionId)) answerMap.set(questionId, value);
    });
  }
  const isPreview =
    previewAnswers !== undefined ||
    new URL(request.url).searchParams.get("preview") === "1";
  const pdf = await createSubmissionPdf({
    moduleOrder: assignment.module.order,
    moduleTitle: assignment.module.title,
    expertName: assignment.user.fullName,
    companyName: assignment.user.company?.name ?? "",
    subgroupName: formatSubgroups(assignment.user.subgroupMemberships),
    statusLabel: isPreview
      ? `Предварительный просмотр · ${statusLabels[assignment.submission.status]}`
      : statusLabels[assignment.submission.status],
    isPreview,
    attachmentBaseUrl: `${(
      process.env.APP_URL ?? new URL(request.url).origin
    ).replace(/\/$/, "")}/api/attachments`,
    questions: assignment.moduleVersion.questions
      .filter((question) => !isQuestionHidden(question.config))
      .map((question) => ({
        key: question.key,
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
      "Content-Disposition": `${
        isPreview ? "inline" : "attachment"
      }; filename="${fileName}"`,
      "Cache-Control": "private, no-store",
    },
  });
}

export async function GET(
  request: Request,
  context: RouteContext<"/api/assignments/[id]/pdf">,
) {
  return renderPdf(request, context);
}

export async function POST(
  request: Request,
  context: RouteContext<"/api/assignments/[id]/pdf">,
) {
  const body = (await request.json().catch(() => null)) as {
    answers?: Record<string, unknown>;
  } | null;
  if (!body?.answers || typeof body.answers !== "object") {
    return Response.json({ error: "INVALID_BODY" }, { status: 400 });
  }
  return renderPdf(request, context, body.answers);
}
