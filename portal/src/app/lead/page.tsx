import Link from "next/link";
import { redirect } from "next/navigation";
import { AcceptedAnalyticsDashboard } from "@/components/accepted-analytics-dashboard";
import { AppShell } from "@/components/app-shell";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";

export default async function LeadPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireUser();
  if (user.role === "ADMIN") redirect("/admin");
  const ledSubgroups = await db.subgroup.findMany({
    where: { leaderId: user.id },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
  if (!ledSubgroups.length) redirect("/dashboard");

  const query = await searchParams;
  const requestedSubgroup =
    typeof query.subgroup === "string" ? query.subgroup : "";
  const selected =
    ledSubgroups.find((subgroup) => subgroup.id === requestedSubgroup) ??
    ledSubgroups[0];

  const [memberships, acceptedSubmissions, moduleCount] = await Promise.all([
    db.userSubgroup.findMany({
      where: {
        subgroupId: selected.id,
        user: {
          role: { in: ["EXPERT", "LEAD"] },
          isActive: true,
        },
      },
      include: {
        user: {
          include: {
            company: true,
            assignments: {
              where: { submission: { status: "ACCEPTED" } },
              include: { module: true, submission: true },
              orderBy: { module: { order: "asc" } },
            },
          },
        },
      },
      orderBy: { user: { fullName: "asc" } },
    }),
    db.submission.findMany({
      where: {
        status: "ACCEPTED",
        assignment: {
          user: {
            subgroupMemberships: {
              some: { subgroupId: selected.id },
            },
          },
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
    db.module.count({ where: { isActive: true } }),
  ]);

  const completedMembers = memberships.filter(
    ({ user: member }) => member.assignments.length === moduleCount,
  ).length;
  const acceptedTotal = memberships.reduce(
    (sum, membership) => sum + membership.user.assignments.length,
    0,
  );

  return (
    <AppShell user={user} mode="lead">
      <div className="flex flex-wrap items-end justify-between gap-5">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wider text-[#8125C8]">
            Режим руководителя
          </p>
          <h1 className="mt-2 text-4xl text-black">{selected.name}</h1>
          <p className="mt-2 max-w-3xl leading-7 text-neutral-600">
            Прогресс участников и сводная аналитика только по ответам,
            принятым модератором.
          </p>
        </div>
        {ledSubgroups.length > 1 && (
          <div className="flex flex-wrap gap-2">
            {ledSubgroups.map((subgroup) => (
              <Link
                key={subgroup.id}
                href={`/lead?subgroup=${subgroup.id}`}
                className={`rounded-xl px-4 py-2.5 text-sm font-semibold ${
                  subgroup.id === selected.id
                    ? "bg-[#0059C7] text-white"
                    : "border border-neutral-300 bg-white text-black"
                }`}
              >
                {subgroup.name}
              </Link>
            ))}
          </div>
        )}
      </div>

      <section className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          ["Участников", memberships.length],
          ["Принято модулей", acceptedTotal],
          ["Завершили все модули", completedMembers],
          ["Модулей в программе", moduleCount],
        ].map(([label, value]) => (
          <div key={label} className="paper rounded-2xl p-5">
            <p className="text-sm text-neutral-500">{label}</p>
            <p className="mt-2 text-3xl text-black">{value}</p>
          </div>
        ))}
      </section>

      <section className="paper mt-7 overflow-hidden rounded-2xl">
        <div className="border-b border-neutral-200 px-6 py-5">
          <h2 className="text-2xl font-bold text-black">Участники подгруппы</h2>
          <p className="mt-1 text-sm text-neutral-500">
            Отображаются только принятые разделы. Материалы на рассмотрении
            руководителю недоступны.
          </p>
        </div>
        <div className="divide-y divide-neutral-100">
          {memberships.map(({ user: member }) => (
            <article
              key={member.id}
              className="grid gap-4 px-6 py-5 lg:grid-cols-[1.2fr_1fr_0.7fr_2fr] lg:items-center"
            >
              <div>
                <p className="font-semibold text-black">{member.fullName}</p>
                <p className="mt-1 text-sm text-neutral-500">
                  {member.company?.name ?? "—"}
                </p>
              </div>
              <p className="text-sm text-neutral-600">
                Принято: {member.assignments.length} из {moduleCount}
              </p>
              <div className="h-2 overflow-hidden rounded-full bg-neutral-100">
                <div
                  className="h-full rounded-full bg-[#0D78F8]"
                  style={{
                    width: `${moduleCount ? (member.assignments.length / moduleCount) * 100 : 0}%`,
                  }}
                />
              </div>
              <div className="flex flex-wrap justify-start gap-2 lg:justify-end">
                {member.assignments.map((assignment) => (
                  <a
                    key={assignment.id}
                    href={`/api/assignments/${assignment.id}/pdf`}
                    className="rounded-lg border border-[#0059C7] px-3 py-2 text-xs font-semibold text-[#0059C7] hover:bg-[#E0EEFF]"
                  >
                    Раздел {assignment.module.order} · PDF
                  </a>
                ))}
                {!member.assignments.length && (
                  <span className="text-sm text-neutral-400">
                    Принятых разделов пока нет
                  </span>
                )}
              </div>
            </article>
          ))}
        </div>
      </section>

      <AcceptedAnalyticsDashboard submissions={acceptedSubmissions} />
    </AppShell>
  );
}
