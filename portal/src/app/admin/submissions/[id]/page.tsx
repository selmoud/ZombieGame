import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { statusLabels, statusStyles } from "@/lib/status";
import { acceptSubmission, addComment, requestRevision } from "./actions";

function displayValue(value: unknown, config: unknown) {
  const typedConfig = config as {
    options?: Array<{ value: string; label: string }>;
    columns?: Array<{ key: string; title: string; options?: Array<{ value: string; label: string }> }>;
  };
  if (value === null || value === undefined || value === "") {
    return <span className="italic text-slate-400">Не заполнено</span>;
  }
  if (Array.isArray(value)) {
    return (
      <div className="space-y-3">
        {value.map((row, index) => (
          <div key={index} className="rounded-xl bg-slate-50 p-4">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400">Строка {index + 1}</p>
            <dl className="grid gap-3 sm:grid-cols-2">
              {typedConfig.columns?.map((column) => {
                const raw = (row as Record<string, unknown>)[column.key];
                const label = column.options?.find((option) => option.value === raw)?.label;
                return (
                  <div key={column.key}>
                    <dt className="text-xs text-slate-400">{column.title}</dt>
                    <dd className="mt-1 whitespace-pre-wrap text-sm text-slate-700">{label ?? String(raw || "—")}</dd>
                  </div>
                );
              })}
            </dl>
          </div>
        ))}
      </div>
    );
  }
  if (typeof value === "object" && value && "id" in value) {
    const file = value as { id: unknown; name?: unknown };
    return <a className="font-semibold text-[#16877c]" href={`/api/attachments/${String(file.id)}`}>↓ {String(file.name ?? "Скачать файл")}</a>;
  }
  const option = typedConfig.options?.find((item) => item.value === value);
  return <p className="whitespace-pre-wrap leading-7 text-slate-700">{option?.label ?? String(value)}</p>;
}

export default async function SubmissionPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const admin = await requireRole("ADMIN");
  const { id } = await params;
  const query = await searchParams;
  const submission = await db.submission.findUnique({
    where: { id },
    include: {
      assignment: {
        include: {
          user: { include: { company: true, subgroup: true } },
          module: true,
          moduleVersion: { include: { questions: { orderBy: { order: "asc" } } } },
        },
      },
      answers: true,
      comments: { include: { author: true }, orderBy: { createdAt: "desc" } },
      history: { include: { actor: true }, orderBy: { createdAt: "desc" } },
    },
  });
  if (!submission) notFound();
  const answerMap = new Map(submission.answers.map((answer) => [answer.questionId, answer.value]));

  return (
    <AppShell user={admin}>
      <Link href="/admin/submissions" className="text-sm font-semibold text-[#16877c]">
        ← Все ответы
      </Link>
      <div className="mt-5 grid gap-7 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div>
          <section className="paper rounded-2xl p-6 sm:p-8">
            <div className="flex flex-wrap items-start justify-between gap-5">
              <div>
                <p className="text-sm font-semibold uppercase tracking-wider text-[#16877c]">
                  {submission.assignment.module.order}. {submission.assignment.module.title}
                </p>
                <h1 className="mt-2 text-3xl text-[#183a4a]">
                  {submission.assignment.user.fullName}
                </h1>
                <p className="mt-2 text-slate-500">
                  {submission.assignment.user.company?.name} · {submission.assignment.user.subgroup?.name}
                </p>
              </div>
              <span className={`rounded-full px-3 py-1.5 text-xs font-semibold ${statusStyles[submission.status]}`}>
                {statusLabels[submission.status]}
              </span>
            </div>
          </section>

          <section className="mt-5 space-y-4">
            {submission.assignment.moduleVersion.questions.map((question, index) => (
              <article key={question.id} className="paper rounded-2xl p-6">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Вопрос {index + 1}</p>
                <h2 className="mt-2 font-semibold text-[#183a4a]">{question.title}</h2>
                <div className="mt-4">{displayValue(answerMap.get(question.id), question.config)}</div>
              </article>
            ))}
          </section>
        </div>

        <aside className="space-y-4 xl:sticky xl:top-5 xl:self-start">
          {query.error && (
            <p className="rounded-xl bg-rose-50 p-4 text-sm text-rose-700">
              Для возврата нужен комментарий, а проверять можно только отправленный ответ.
            </p>
          )}
          {submission.status === "SUBMITTED" && (
            <section className="paper rounded-2xl p-5">
              <h2 className="text-xl text-[#183a4a]">Решение</h2>
              <form action={acceptSubmission} className="mt-4">
                <input type="hidden" name="submissionId" value={submission.id} />
                <button className="w-full rounded-xl bg-[#16877c] px-4 py-3 font-semibold text-white">
                  Принять ответ
                </button>
              </form>
              <form action={requestRevision} className="mt-5">
                <input type="hidden" name="submissionId" value={submission.id} />
                <label>
                  <span className="mb-1.5 block text-xs font-medium text-slate-600">Что нужно исправить</span>
                  <textarea className="field min-h-28" name="reason" required />
                </label>
                <button className="mt-3 w-full rounded-xl border border-rose-300 px-4 py-3 font-semibold text-rose-700">
                  Вернуть на доработку
                </button>
              </form>
            </section>
          )}

          <section className="paper rounded-2xl p-5">
            <h2 className="text-xl text-[#183a4a]">Комментарий</h2>
            <form action={addComment} className="mt-4">
              <input type="hidden" name="submissionId" value={submission.id} />
              <textarea className="field min-h-24" name="body" placeholder="Общее замечание к разделу" required />
              <button className="mt-3 rounded-lg bg-[#183a4a] px-4 py-2.5 text-sm font-semibold text-white">
                Добавить
              </button>
            </form>
            <div className="mt-5 space-y-3">
              {submission.comments.map((comment) => (
                <div key={comment.id} className="border-t border-slate-100 pt-3">
                  <p className="text-sm leading-6 text-slate-700">{comment.body}</p>
                  <p className="mt-1 text-xs text-slate-400">{comment.author.fullName}</p>
                </div>
              ))}
            </div>
          </section>

          {submission.history.length > 0 && (
            <section className="paper rounded-2xl p-5">
              <h2 className="text-xl text-[#183a4a]">История</h2>
              <div className="mt-4 space-y-3">
                {submission.history.map((entry) => (
                  <div key={entry.id} className="border-l-2 border-[#16877c]/30 pl-3 text-xs text-slate-500">
                    <p className="font-semibold text-slate-700">{statusLabels[entry.toStatus]}</p>
                    <p>{entry.actor.fullName} · {entry.createdAt.toLocaleDateString("ru-RU")}</p>
                  </div>
                ))}
              </div>
            </section>
          )}
        </aside>
      </div>
    </AppShell>
  );
}
