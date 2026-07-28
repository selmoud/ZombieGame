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

  const acceptedSubmissions = await db.submission.findMany({
    where: {
      status: "ACCEPTED",
      assignment: {
        module: { order: { in: [1, 2] } },
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
  });

  const expertIds = new Set(
    acceptedSubmissions.map((item) => item.assignment.user.id),
  );
  const sectionOne = acceptedSubmissions.filter(
    (item) => item.assignment.module.order === 1,
  ).length;
  const sectionTwo = acceptedSubmissions.filter(
    (item) => item.assignment.module.order === 2,
  ).length;

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
        <Link
          href="/admin"
          className="rounded-xl border border-neutral-300 bg-white px-4 py-3 text-sm font-semibold text-black hover:bg-neutral-50"
        >
          Вернуться в админку
        </Link>
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
          ["Принято разделов 1", sectionOne],
          ["Принято разделов 2", sectionTwo],
        ].map(([label, value]) => (
          <div key={label} className="paper rounded-2xl p-5">
            <p className="text-sm text-neutral-500">{label}</p>
            <p className="mt-2 text-3xl text-black">{value}</p>
          </div>
        ))}
      </section>

      <AcceptedAnalyticsDashboard submissions={acceptedSubmissions} />
    </AppShell>
  );
}
