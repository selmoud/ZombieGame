import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { isModuleUnlockedFromAssignments } from "@/lib/module-access";
import {
  canDownloadSubmissionResults,
  statusLabels,
  statusStyles,
} from "@/lib/status";
import { formatSubgroups } from "@/lib/subgroups";
import { acceptedModuleProgress } from "@/lib/progress";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireUser();
  const isSuperExpert = user.role === "ADMIN";
  const query = await searchParams;
  const assignments = await db.moduleAssignment.findMany({
    where: { userId: user.id },
    include: { module: true, submission: true },
    orderBy: { module: { order: "asc" } },
  });
  const progress = acceptedModuleProgress(assignments);

  return (
    <AppShell user={user} mode={isSuperExpert ? "superExpert" : undefined}>
      {isSuperExpert && (
        <div className="mb-6 rounded-2xl border border-[#0D78F8] bg-[#E0EEFF] px-5 py-4 text-sm leading-6 text-[#003E8A]">
          <strong className="block text-base text-[#000000]">
            Режим суперэксперта
          </strong>
          Здесь можно проверить содержание всех модулей, наследование данных и
          предварительный PDF. Черновики видны только вам и не включаются в
          экспертную аналитику.
        </div>
      )}
      {query.locked && (
        <p className="mb-5 rounded-xl border border-[#D8B1F5] bg-[#F1E5FB] px-4 py-3 text-sm text-[#6815A8]">
          Этот модуль пока недоступен. Сначала отправьте предыдущий модуль и
          дождитесь, пока администратор его примет.
        </p>
      )}
      <div className="grid gap-6 lg:grid-cols-[1fr_19rem]">
        <section>
          <p className="text-sm font-semibold uppercase tracking-wider text-[#0059C7]">
            Личный кабинет
          </p>
          <h1 className="mt-2 max-w-3xl text-4xl leading-tight text-[#000000]">
            Добрый день, {user.fullName}
          </h1>
          <p className="mt-3 max-w-2xl leading-7 text-neutral-600">
            {isSuperExpert
              ? "Все модули открыты для проверки. Черновики сохраняются автоматически, но не отправляются на модерацию."
              : "Заполняйте модули последовательно. Следующий откроется после того, как администратор примет предыдущий. Черновики сохраняются автоматически."}
          </p>
        </section>
        <aside className="paper rounded-2xl p-5">
          <div className="flex items-end justify-between">
            <span className="text-sm text-neutral-500">
              {isSuperExpert ? "Доступно модулей" : "Общий прогресс"}
            </span>
            <strong className="text-2xl text-[#000000]">
              {isSuperExpert ? assignments.length : `${progress.percent}%`}
            </strong>
          </div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-neutral-100">
            <div
              className="h-full rounded-full bg-[#0D78F8]"
              style={{
                width: isSuperExpert ? "100%" : `${progress.percent}%`,
              }}
            />
          </div>
          <p className="mt-3 text-xs text-neutral-500">
            {isSuperExpert
              ? "Все модули открыты для проверки"
              : `Принято разделов: ${progress.accepted} из ${progress.total}`}
          </p>
        </aside>
      </div>

      <section className="paper mt-7 grid gap-5 rounded-2xl p-5 sm:grid-cols-2 lg:grid-cols-4">
        {[
          ["ФИО", user.fullName],
          ["Компания", user.company?.name ?? "—"],
          ["Подгруппы", formatSubgroups(user.subgroupMemberships)],
          [
            "Роль",
            isSuperExpert
              ? "Суперэксперт"
              : user.ledSubgroups.length
                ? "Эксперт и руководитель подгруппы"
                : "Эксперт",
          ],
        ].map(([label, value]) => (
          <div key={label}>
            <p className="text-xs uppercase tracking-wider text-neutral-400">
              {label}
            </p>
            <p className="mt-1.5 text-sm font-semibold text-[#000000]">
              {value}
            </p>
          </div>
        ))}
      </section>

      <div className="mt-9 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <h2 className="text-3xl text-[#000000]">
            Экспертные модули
          </h2>
          <p className="mt-1 text-sm text-neutral-500">
            Горизонт целевого состояния — 2036 год
          </p>
        </div>
        <a
          href="https://cloud.mail.ru/public/QKGP/fvDNjsbCb"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-11 items-center justify-center rounded-lg bg-[#0059C7] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#00479F]"
        >
          Полезные материалы
        </a>
      </div>
      <section className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {assignments.map(({ id, module, submission }) => {
          const status = submission?.status ?? "NOT_STARTED";
          const locked = !isModuleUnlockedFromAssignments(
            assignments,
            module.order,
            isSuperExpert || user.unlockAllModules,
          );
          const canDownload = canDownloadSubmissionResults(status);
          const content = (
            <>
              <div className="flex items-start justify-between gap-4">
                <span className="text-4xl text-[#CFCFCF]">
                  {String(module.order).padStart(2, "0")}
                </span>
                <span
                  className={`rounded-full px-3 py-1 text-xs font-semibold ${
                    locked
                      ? "bg-neutral-100 text-neutral-500"
                      : statusStyles[status]
                  }`}
                >
                  {locked ? "Заблокирован" : statusLabels[status]}
                </span>
              </div>
              <h3 className="mt-6 text-lg font-semibold text-[#000000]">
                {module.title}
              </h3>
            </>
          );
          return locked ? (
            <article
              key={id}
              className="paper rounded-2xl p-6 opacity-75"
            >
              {content}
              <p className="mt-5 text-sm font-semibold text-neutral-400">
                Откроется после завершения предыдущего модуля
              </p>
            </article>
          ) : (
            <article
              key={id}
              className="paper rounded-2xl p-6"
            >
              {content}
              <div className="mt-5 flex flex-wrap items-center gap-3">
                <Link
                  href={`/modules/${id}`}
                  className="rounded-lg bg-[#0059C7] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#00479F]"
                >
                  {status === "NOT_STARTED"
                    ? "Начать заполнение"
                    : "Открыть раздел"}
                </Link>
                {canDownload ? (
                  <a
                    href={`/api/assignments/${id}/pdf`}
                    className="rounded-lg border border-[#0059C7] px-4 py-2.5 text-sm font-semibold text-[#0059C7] hover:bg-[#E0EEFF]"
                  >
                    Скачать результаты раздела
                  </a>
                ) : (
                  <span
                    aria-disabled="true"
                    title="Станет доступно после отправки раздела модератору"
                    className="cursor-not-allowed rounded-lg border border-neutral-300 px-4 py-2.5 text-sm font-semibold text-neutral-400"
                  >
                    Скачать результаты раздела
                  </span>
                )}
              </div>
            </article>
          );
        })}
      </section>
    </AppShell>
  );
}
