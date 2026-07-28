import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { statusLabels, statusStyles } from "@/lib/status";

export default async function DashboardPage() {
  const user = await requireUser();
  const assignments = await db.moduleAssignment.findMany({
    where: { userId: user.id },
    include: { module: true, submission: true },
    orderBy: { module: { order: "asc" } },
  });
  const completed = assignments.filter(
    (item) => item.submission?.status === "ACCEPTED",
  ).length;
  const progress = assignments.length
    ? Math.round(
        (assignments.filter(
          (item) => item.submission?.status !== "NOT_STARTED",
        ).length /
          assignments.length) *
          100,
      )
    : 0;

  return (
    <AppShell user={user}>
      <div className="grid gap-6 lg:grid-cols-[1fr_19rem]">
        <section>
          <p className="text-sm font-semibold uppercase tracking-wider text-[#0059C7]">
            Личный кабинет
          </p>
          <h1 className="mt-2 text-4xl text-[#000000]">
            Добрый день, {user.fullName.split(" ")[0]}
          </h1>
          <p className="mt-3 max-w-2xl leading-7 text-neutral-600">
            Заполните назначенные разделы. Черновики можно сохранять и
            продолжать в удобное время.
          </p>
        </section>
        <aside className="paper rounded-2xl p-5">
          <div className="flex items-end justify-between">
            <span className="text-sm text-neutral-500">Общий прогресс</span>
            <strong className="text-2xl text-[#000000]">{progress}%</strong>
          </div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-neutral-100">
            <div
              className="h-full rounded-full bg-[#0D78F8]"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="mt-3 text-xs text-neutral-500">
            Принято разделов: {completed} из {assignments.length}
          </p>
        </aside>
      </div>

      <section className="paper mt-7 grid gap-5 rounded-2xl p-5 sm:grid-cols-2 lg:grid-cols-4">
        {[
          ["ФИО", user.fullName],
          ["Компания", user.company?.name ?? "—"],
          ["Подгруппа", user.subgroup?.name ?? "—"],
          ["Роль", user.role === "LEAD" ? "Руководитель" : "Эксперт"],
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

      <div className="mt-9 flex items-end justify-between">
        <div>
          <h2 className="text-3xl text-[#000000]">
            Разделы доклада
          </h2>
          <p className="mt-1 text-sm text-neutral-500">
            Горизонт целевого состояния — 2036 год
          </p>
        </div>
      </div>
      <section className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {assignments.map(({ id, module, submission }) => {
          const status = submission?.status ?? "NOT_STARTED";
          return (
            <Link
              key={id}
              href={`/modules/${id}`}
              className="paper group rounded-2xl p-6 transition hover:-translate-y-0.5 hover:border-[#0D78F8]/50 hover:shadow-lg"
            >
              <div className="flex items-start justify-between gap-4">
                <span className="text-4xl text-[#CFCFCF]">
                  {String(module.order).padStart(2, "0")}
                </span>
                <span
                  className={`rounded-full px-3 py-1 text-xs font-semibold ${statusStyles[status]}`}
                >
                  {statusLabels[status]}
                </span>
              </div>
              <h3 className="mt-6 text-lg font-semibold text-[#000000]">
                {module.title}
              </h3>
              <p className="mt-5 text-sm font-semibold text-[#0059C7] group-hover:text-[#00479F]">
                {status === "NOT_STARTED" ? "Начать заполнение" : "Открыть раздел"} →
              </p>
            </Link>
          );
        })}
      </section>
    </AppShell>
  );
}
