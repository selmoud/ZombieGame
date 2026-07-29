import Link from "next/link";
import { AcceptedAnalyticsDashboard } from "@/components/accepted-analytics-dashboard";
import { AppShell } from "@/components/app-shell";
import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";

export default async function AdminAnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const admin = await requireRole("ADMIN");
  const query = await searchParams;
  const subgroups = await db.subgroup.findMany({
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
  const requested =
    typeof query.subgroup === "string" ? query.subgroup : "all";
  const selected = subgroups.find((item) => item.id === requested);

  const [acceptedSubmissions, economicData] = await Promise.all([
    db.submission.findMany({
    where: {
      status: "ACCEPTED",
      assignment: {
        ...(selected
          ? {
              user: {
                subgroupMemberships: {
                  some: { subgroupId: selected.id },
                },
              },
            }
          : {}),
      },
    },
    include: {
      assignment: {
        include: {
          module: true,
          user: { select: { id: true, fullName: true } },
        },
      },
      answers: {
        include: {
          question: { select: { key: true } },
        },
      },
    },
    }),
    db.ministryEconomicData.findUnique({
      where: { industry: "Коммуникации, медиа и развлечения" },
    }),
  ]);

  const expertIds = new Set(
    acceptedSubmissions.map((item) => item.assignment.user.id),
  );
  const completedExperts = Array.from(expertIds).filter((expertId) => {
    const acceptedOrders = new Set(
      acceptedSubmissions
        .filter((item) => item.assignment.user.id === expertId)
        .map((item) => item.assignment.module.order),
    );
    return acceptedOrders.size === 8;
  }).length;

  return (
    <AppShell user={admin} mode="admin">
      <div className="flex flex-wrap items-end justify-between gap-5">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wider text-[#8125C8]">
            Административная панель
          </p>
          <h1 className="mt-2 text-4xl text-black">Сводная аналитика</h1>
          <p className="mt-2 max-w-3xl leading-7 text-neutral-600">
            Расчёты строятся только по ответам, принятым модератором. При
            просмотре всей рабочей группы ответ эксперта учитывается один раз,
            даже если эксперт состоит в нескольких подгруппах.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <a
            href={
              selected
                ? `/api/reports/summary?subgroup=${selected.id}`
                : "/api/reports/summary?scope=all"
            }
            className="rounded-xl bg-[#0059C7] px-4 py-3 text-sm font-semibold text-white hover:bg-[#00479F]"
          >
            Сформировать итоговый PDF
          </a>
          <Link
            href="/admin"
            className="rounded-xl border border-neutral-300 bg-white px-4 py-3 text-sm font-semibold text-black hover:bg-neutral-50"
          >
            Вернуться в админку
          </Link>
        </div>
      </div>

      <nav className="mt-7 flex flex-wrap gap-2">
        <Link
          href="/admin/analytics?subgroup=all"
          className={`rounded-xl px-4 py-2.5 text-sm font-semibold ${
            !selected
              ? "bg-[#0059C7] text-white"
              : "border border-neutral-300 bg-white text-black"
          }`}
        >
          Вся рабочая группа
        </Link>
        {subgroups.map((subgroup) => (
          <Link
            key={subgroup.id}
            href={`/admin/analytics?subgroup=${subgroup.id}`}
            className={`rounded-xl px-4 py-2.5 text-sm font-semibold ${
              selected?.id === subgroup.id
                ? "bg-[#0059C7] text-white"
                : "border border-neutral-300 bg-white text-black"
            }`}
          >
            {subgroup.name}
          </Link>
        ))}
      </nav>

      <section className="mt-5 grid gap-4 sm:grid-cols-3">
        {[
          ["Экспертов в расчёте", expertIds.size],
          ["Принято модулей", acceptedSubmissions.length],
          ["Завершили все модули", completedExperts],
        ].map(([label, value]) => (
          <div key={label} className="paper rounded-2xl p-5">
            <p className="text-sm text-neutral-500">{label}</p>
            <p className="mt-2 text-3xl text-black">{value}</p>
          </div>
        ))}
      </section>

      <section className="paper mt-7 overflow-hidden rounded-2xl">
        <div className="border-b border-neutral-200 px-6 py-5">
          <h2 className="text-2xl font-bold text-black">
            Место отрасли в экономике
          </h2>
          <p className="mt-1 text-sm text-neutral-500">
            Данные Минэкономразвития, не относящиеся к ответам отдельных
            экспертов.
          </p>
        </div>
        {economicData ? (
          <div className="grid gap-4 p-6 sm:grid-cols-2 xl:grid-cols-5">
            {[
              ["Период", economicData.reportingPeriod ?? "—"],
              [
                "Доля в ВВП",
                economicData.gdpShare === null
                  ? "—"
                  : `${economicData.gdpShare}%`,
              ],
              [
                "Доля в ВДС",
                economicData.gvaShare === null
                  ? "—"
                  : `${economicData.gvaShare}%`,
              ],
              [
                "Доля в занятости",
                economicData.employmentShare === null
                  ? "—"
                  : `${economicData.employmentShare}%`,
              ],
              [
                "Инвестиционная активность",
                economicData.investmentActivity ?? "—",
              ],
              [
                "Производительность труда",
                economicData.productivityComparison ?? "—",
              ],
            ].map(([label, value]) => (
              <div key={String(label)} className="rounded-xl bg-neutral-50 p-4">
                <p className="text-xs uppercase tracking-wider text-neutral-400">
                  {label}
                </p>
                <p className="mt-2 font-semibold text-black">{value}</p>
              </div>
            ))}
            {(economicData.source || economicData.comment) && (
              <div className="sm:col-span-2 xl:col-span-4">
                <p className="text-xs uppercase tracking-wider text-neutral-400">
                  Источник и пояснение
                </p>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-neutral-600">
                  {[economicData.source, economicData.comment]
                    .filter(Boolean)
                    .join("\n\n")}
                </p>
              </div>
            )}
          </div>
        ) : (
          <p className="p-8 text-center text-sm text-neutral-400">
            Данные пока не заполнены в административной панели.
          </p>
        )}
      </section>

      <AcceptedAnalyticsDashboard submissions={acceptedSubmissions} />
    </AppShell>
  );
}
