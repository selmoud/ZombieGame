import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { isQuestionHidden } from "@/lib/questions";
import { statusLabels } from "@/lib/status";
import { formatSubgroups } from "@/lib/subgroups";
import { createXlsx } from "@/lib/xlsx";

function simpleValue(value: unknown) {
  if (value === null || value === undefined) return "";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

export async function GET() {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") {
    return new Response("Unauthorized", { status: 401 });
  }
  const submissions = await db.submission.findMany({
    where: {
      assignment: {
        user: { role: { in: ["EXPERT", "LEAD"] } },
      },
    },
    include: {
      assignment: {
        include: {
          user: {
            include: {
              company: true,
              subgroupMemberships: { include: { subgroup: true } },
            },
          },
          module: true,
          moduleVersion: { include: { questions: true } },
        },
      },
      answers: true,
      comments: true,
      history: true,
    },
    orderBy: { updatedAt: "desc" },
  });
  const overview = submissions.map((submission) => ({
    Эксперт: submission.assignment.user.fullName,
    Компания: submission.assignment.user.company?.name ?? "",
    Подгруппы: formatSubgroups(
      submission.assignment.user.subgroupMemberships,
    ),
    Раздел: submission.assignment.module.title,
    Статус: statusLabels[submission.status],
    "Дата отправки": submission.submittedAt?.toISOString() ?? "",
    "Дата принятия": submission.acceptedAt?.toISOString() ?? "",
  }));
  const sheets: Array<{ name: string; rows: Array<Record<string, string>> }> = [
    { name: "Ответы", rows: overview },
  ];
  for (let order = 1; order <= 8; order += 1) {
    const rows: Array<Record<string, string>> = [];
    for (const submission of submissions.filter(
      (item) => item.assignment.module.order === order,
    )) {
      const answerMap = new Map(
        submission.answers.map((answer) => [answer.questionId, answer.value]),
      );
      const row: Record<string, string> = {
        Эксперт: submission.assignment.user.fullName,
        Компания: submission.assignment.user.company?.name ?? "",
        Статус: statusLabels[submission.status],
      };
      for (const question of submission.assignment.moduleVersion.questions) {
        if (isQuestionHidden(question.config)) continue;
        row[question.title] = simpleValue(answerMap.get(question.id));
      }
      rows.push(row);
    }
    const moduleTitle =
      submissions.find((item) => item.assignment.module.order === order)
        ?.assignment.module.title ?? `Модуль ${order}`;
    sheets.push({ name: `${order}. ${moduleTitle}`, rows });
  }
  const comments = submissions.flatMap((submission) =>
    submission.comments.map((comment) => ({
      Эксперт: submission.assignment.user.fullName,
      Раздел: submission.assignment.module.title,
      Комментарий: comment.body,
      Дата: comment.createdAt.toISOString(),
    })),
  );
  sheets.push({ name: "Комментарии", rows: comments });
  const buffer = createXlsx(sheets);
  const fileName = `expert-positions-${new Date().toISOString().slice(0, 10)}.xlsx`;
  return new Response(buffer, {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${fileName}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
