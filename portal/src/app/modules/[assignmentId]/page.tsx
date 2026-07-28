import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import ReactMarkdown from "react-markdown";
import { AppShell } from "@/components/app-shell";
import { DraftStatus } from "@/components/draft-status";
import { DynamicForm } from "@/components/dynamic-form";
import { GlossaryModal } from "@/components/glossary-modal";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { isModuleUnlocked } from "@/lib/module-access-db";
import { isQuestionHidden } from "@/lib/questions";
import {
  canDownloadSubmissionResults,
  statusLabels,
  statusStyles,
} from "@/lib/status";

export default async function ModulePage({
  params,
}: {
  params: Promise<{ assignmentId: string }>;
}) {
  const user = await requireUser();
  const { assignmentId } = await params;
  const assignment = await db.moduleAssignment.findUnique({
    where: { id: assignmentId },
    include: {
      module: true,
      moduleVersion: {
        include: { questions: { orderBy: { order: "asc" } } },
      },
      submission: {
        include: {
          answers: true,
          comments: {
            include: { author: true, question: true },
            orderBy: { createdAt: "desc" },
          },
        },
      },
    },
  });
  if (!assignment || assignment.userId !== user.id || !assignment.submission) {
    notFound();
  }
  if (!(await isModuleUnlocked(user.id, assignment.module.order))) {
    redirect("/dashboard?locked=1");
  }
  const status = assignment.submission.status;
  const canDownload = canDownloadSubmissionResults(status);
  const answers = Object.fromEntries(
    assignment.submission.answers.map((answer) => [
      answer.questionId,
      answer.value,
    ]),
  );
  const questions = assignment.moduleVersion.questions
    .filter((question) => !isQuestionHidden(question.config))
    .map((question) => ({
      id: question.id,
      key: question.key,
      type: question.type,
      title: question.title,
      description: question.description,
      required: question.required,
      config: question.config as {
      options?: Array<{ value: string; label: string }>;
      min?: number;
      max?: number;
      minRows?: number;
      maxRows?: number;
      fixedRows?: number;
      addRowLabel?: string;
      numberRows?: boolean;
      rowLabel?: string;
      sortableRows?: boolean;
      columns?: Array<{
        key: string;
        title: string;
        description?: string;
        type: string;
        required?: boolean;
        options?: Array<{ value: string; label: string }>;
        allowCustom?: boolean;
        defaultValue?: string;
        excludeColumnKey?: string;
        excludeOptionValues?: string[];
        fullWidth?: boolean;
        lastOptionValue?: string;
        notBeforeColumnKey?: string;
        optionsFromColumnKey?: string;
        requiredWhen?: { columnKey: string; equals: string };
        sortOptions?: boolean;
        sourceQuestionKey?: string;
        sourceColumnKey?: string;
        sourceLabelSuffix?: string;
        uniqueAcrossRows?: boolean;
        visibleWhen?: { columnKey: string; equals: string };
        min?: number;
        max?: number;
        step?: number;
      }>;
      },
    }));

  return (
    <AppShell user={user}>
      <Link href="/dashboard" className="text-sm font-semibold text-[#0059C7]">
        ← Все разделы
      </Link>
      <div className="mt-5 grid gap-7 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <div>
          <div className="paper rounded-2xl p-6 sm:p-8">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold uppercase tracking-wider text-[#0059C7]">
                  Раздел {String(assignment.module.order).padStart(2, "0")}
                </p>
                <h1 className="mt-2 text-3xl text-[#000000] sm:text-4xl">
                  {assignment.module.title}
                </h1>
                <p className="mt-3 max-w-2xl leading-7 text-neutral-600">
                  {assignment.moduleVersion.description}
                </p>
              </div>
              {status !== "DRAFT" && (
                <span
                  className={`rounded-full px-3 py-1.5 text-xs font-semibold ${statusStyles[status]}`}
                >
                  {statusLabels[status]}
                </span>
              )}
            </div>
          </div>

          {assignment.submission.comments.length > 0 && (
            <section className="mt-5 rounded-2xl border border-[#D8B1F5] bg-[#F1E5FB] p-5">
              <h2 className="font-semibold text-[#541087]">Комментарии проверки</h2>
              <div className="mt-3 space-y-3">
                {assignment.submission.comments.map((comment) => (
                  <div key={comment.id} className="rounded-lg bg-white/70 p-3 text-sm">
                    <p className="text-[#541087]">{comment.body}</p>
                    <p className="mt-1 text-xs text-[#6815A8]">
                      {comment.author.fullName}
                      {comment.question ? ` · ${comment.question.title}` : ""}
                    </p>
                  </div>
                ))}
              </div>
            </section>
          )}

          <section className="paper mt-5 rounded-2xl p-6 sm:p-8">
            <p className="text-sm font-semibold uppercase tracking-wider text-[#8125C8]">
              Теоретическая часть
            </p>
            <h2 className="mt-2 text-2xl font-bold text-black">
              Что нужно знать перед заполнением
            </h2>
            <div className="prose mt-5">
              <ReactMarkdown>{assignment.moduleVersion.theoryMarkdown}</ReactMarkdown>
            </div>
          </section>
          <section className="mt-5 rounded-2xl bg-[#0D78F8] p-6 text-white sm:p-8">
            <p className="text-sm font-semibold uppercase tracking-wider text-white/80">
              Практическая часть
            </p>
            <h2 className="mt-2 text-2xl font-bold">
              Ответьте на вопросы раздела
            </h2>
            <p className="mt-2 max-w-2xl leading-7 text-white/90">
              <span className="block">
                Опирайтесь на собственную экспертизу, проверяемые данные и
                конкретные примеры.
              </span>
              <span className="block">Обязательные поля отмечены *</span>
              <span className="block">Черновик сохраняется автоматически.</span>
            </p>
          </section>
          <div className="mt-4">
            <DynamicForm
              assignmentId={assignment.id}
              questions={questions}
              initialAnswers={answers}
              initialRevision={assignment.submission.revision}
              initialStatus={status}
            />
          </div>
          <section className="paper mt-5 flex flex-col gap-4 rounded-2xl p-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="font-semibold text-[#000000]">Результаты раздела</h2>
              <p className="mt-1 text-sm leading-6 text-neutral-500">
                PDF содержит ответы в том порядке, в котором их увидит
                модератор, и станет доступен после отправки раздела.
              </p>
            </div>
            {canDownload ? (
              <a
                href={`/api/assignments/${assignment.id}/pdf`}
                className="shrink-0 rounded-xl bg-[#0059C7] px-5 py-3 text-center text-sm font-semibold text-white hover:bg-[#00479F]"
              >
                Скачать результаты раздела
              </a>
            ) : (
              <span
                aria-disabled="true"
                className="cursor-not-allowed shrink-0 rounded-xl bg-neutral-200 px-5 py-3 text-center text-sm font-semibold text-neutral-500"
              >
                Скачать результаты раздела
              </span>
            )}
          </section>
        </div>

        <aside className="space-y-4 xl:sticky xl:top-5 xl:self-start">
          <section className="paper rounded-2xl p-5">
            <p className="text-xs font-semibold uppercase tracking-wider text-neutral-400">
              Как работать
            </p>
            <ol className="mt-4 space-y-4 text-sm leading-6 text-neutral-600">
              <li><strong className="text-[#000000]">1.</strong> Изучите методические материалы.</li>
              <li><strong className="text-[#000000]">2.</strong> Заполните вопросы и таблицы.</li>
              <li><strong className="text-[#000000]">3.</strong> Отправьте раздел на проверку.</li>
            </ol>
          </section>
          <section className="rounded-2xl bg-[#DDF8FB] p-5">
            <p className="text-lg text-[#000000]">Важно</p>
            <p className="mt-2 text-sm leading-6 text-neutral-600">
              Подкрепляйте выводы измеримыми показателями, источниками и
              конкретными примерами.
            </p>
          </section>
          <DraftStatus assignmentId={assignment.id} initialStatus={status} />
          <GlossaryModal />
        </aside>
      </div>
    </AppShell>
  );
}
