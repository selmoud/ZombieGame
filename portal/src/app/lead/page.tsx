import Link from "next/link";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";

type CountItem = { label: string; count: number };

function rows(value: unknown) {
  return Array.isArray(value)
    ? value.filter(
        (row): row is Record<string, unknown> =>
          typeof row === "object" && row !== null && !Array.isArray(row),
      )
    : [];
}

function countValues(values: unknown[]): CountItem[] {
  const counts = new Map<string, number>();
  values
    .flatMap((value) => (Array.isArray(value) ? value : [value]))
    .map((value) => String(value ?? "").trim())
    .filter(Boolean)
    .forEach((value) => counts.set(value, (counts.get(value) ?? 0) + 1));
  return Array.from(counts, ([label, count]) => ({ label, count })).sort(
    (left, right) =>
      right.count - left.count || left.label.localeCompare(right.label, "ru"),
  );
}

function MetricList({
  title,
  items,
  empty = "Недостаточно принятых ответов",
}: {
  title: string;
  items: CountItem[];
  empty?: string;
}) {
  const max = Math.max(...items.map((item) => item.count), 1);
  return (
    <section className="paper rounded-2xl p-5">
      <h3 className="font-semibold text-black">{title}</h3>
      {items.length ? (
        <div className="mt-4 space-y-3">
          {items.slice(0, 8).map((item) => (
            <div key={item.label}>
              <div className="flex items-start justify-between gap-3 text-sm">
                <span className="leading-5 text-neutral-700">{item.label}</span>
                <strong className="shrink-0 text-black">{item.count}</strong>
              </div>
              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-neutral-100">
                <div
                  className="h-full rounded-full bg-[#0D78F8]"
                  style={{ width: `${Math.max((item.count / max) * 100, 8)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-4 text-sm text-neutral-400">{empty}</p>
      )}
    </section>
  );
}

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
          module: { order: { in: [1, 2] } },
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

  const answerRows = (moduleOrder: number, questionKey: string) =>
    acceptedSubmissions
      .filter(
        (submission) => submission.assignment.module.order === moduleOrder,
      )
      .flatMap((submission) =>
        submission.answers
          .filter((answer) => answer.question.key === questionKey)
          .flatMap((answer) => rows(answer.value)),
      );

  const boundaries = answerRows(1, "analysis_object");
  const segments = answerRows(1, "industry_boundaries");
  const retrospective = answerRows(1, "current_state");
  const metrics = answerRows(1, "key_metrics");
  const participants = answerRows(2, "participants");
  const macros = answerRows(2, "macrotransactions");
  const micros = answerRows(2, "microtransactions");
  const assessments = answerRows(2, "transaction_assessments");

  const segmentCounts = countValues(
    segments.map((row) =>
      row.segment === "Другое" ? row.customSegment : row.segment,
    ),
  );
  const adjacentIndustryCounts = countValues(
    boundaries.map((row) => row.adjacentIndustries),
  );
  const factorCounts = countValues(
    retrospective.map((row) => row.keyFactor),
  );
  const influenceCounts = countValues(
    retrospective.map((row) => row.influence),
  );
  const metricCounts = countValues(metrics.map((row) => row.metric));
  const activityShareCounts = countValues(
    segments.map((row) => row.userActivityShare),
  );
  const economicShareCounts = countValues(
    segments.map((row) => row.economicShare),
  );
  const participantCounts = countValues(
    participants.map((row) => row.name),
  );
  const roleLabels: Record<string, string> = {
    demand: "Сторона спроса",
    supply: "Сторона предложения",
    intermediary: "Посредник",
    government: "Государство",
  };
  const roleCounts = countValues(
    participants.map((row) => roleLabels[String(row.kind)] ?? row.kind),
  );
  const macroCounts = countValues(macros.map((row) => row.name));
  const microCounts = countValues(micros.map((row) => row.name));
  const costSourceCounts = countValues(
    assessments.map((row) => row.costSources),
  );
  const resourceCounts = countValues(
    assessments.map((row) => row.resourceIntensity),
  );
  const costLevelCounts = countValues(
    assessments.map((row) => row.costLevel),
  );
  const highCostActions = countValues(
    assessments
      .filter((row) =>
        ["Высокий", "Очень высокий"].includes(String(row.costLevel)),
      )
      .map((row) => row.micro),
  );

  const acceptedSectionOne = acceptedSubmissions.filter(
    (submission) => submission.assignment.module.order === 1,
  ).length;
  const acceptedSectionTwo = acceptedSubmissions.filter(
    (submission) => submission.assignment.module.order === 2,
  ).length;

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
          ["Принято разделов 1", acceptedSectionOne],
          ["Принято разделов 2", acceptedSectionTwo],
          [
            "Всего принятых модулей",
            memberships.reduce(
              (sum, membership) =>
                sum + membership.user.assignments.length,
              0,
            ),
          ],
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

      <section className="mt-9">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wider text-[#0059C7]">
            Раздел 1
          </p>
          <h2 className="mt-1 text-3xl text-black">
            Текущее состояние отрасли
          </h2>
        </div>
        <div className="mt-5 grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
          <MetricList title="Выбранные сегменты" items={segmentCounts} />
          <MetricList title="Смежные отрасли" items={adjacentIndustryCounts} />
          <MetricList title="Ключевые факторы" items={factorCounts} />
          <MetricList title="Характер влияния" items={influenceCounts} />
          <MetricList title="Приоритетные показатели" items={metricCounts} />
          <MetricList
            title="Доля по пользовательской активности"
            items={activityShareCounts}
          />
          <MetricList
            title="Экономическая доля сегментов"
            items={economicShareCounts}
          />
        </div>
      </section>

      <section className="mt-9">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wider text-[#8125C8]">
            Раздел 2
          </p>
          <h2 className="mt-1 text-3xl text-black">Модель транзакций</h2>
        </div>
        <div className="mt-5 grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
          <MetricList title="Группы участников" items={participantCounts} />
          <MetricList title="Роли участников" items={roleCounts} />
          <MetricList title="Макротранзакции" items={macroCounts} />
          <MetricList title="Повторяющиеся действия" items={microCounts} />
          <MetricList title="Источники издержек" items={costSourceCounts} />
          <MetricList title="Ресурсоёмкость" items={resourceCounts} />
          <MetricList title="Уровень издержек" items={costLevelCounts} />
          <MetricList
            title="Действия с высокими издержками"
            items={highCostActions}
          />
        </div>
      </section>
    </AppShell>
  );
}
