import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { CreateExpertForm } from "@/components/create-expert-form";
import { ExpertCard } from "@/components/expert-card";
import { SubgroupManager } from "@/components/subgroup-manager";
import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { approveRegistration, rejectRegistration } from "./actions";

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const admin = await requireRole("ADMIN");
  const query = await searchParams;
  const [users, companies, registrations, subgroups] = await Promise.all([
    db.user.findMany({
      where: { role: { in: ["EXPERT", "LEAD"] } },
      include: {
        company: true,
        subgroup: true,
        assignments: { include: { submission: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    db.company.count({
      where: { users: { some: { role: { in: ["EXPERT", "LEAD"] } } } },
    }),
    db.registrationRequest.findMany({
      where: { status: "PENDING" },
      include: { subgroup: true },
      orderBy: { createdAt: "asc" },
    }),
    db.subgroup.findMany({
      include: {
        _count: {
          select: {
            users: {
              where: { role: { in: ["EXPERT", "LEAD"] } },
            },
            registrationRequests: {
              where: { status: "PENDING" },
            },
          },
        },
      },
      orderBy: { name: "asc" },
    }),
  ]);
  const completedExperts = users.filter(
    (user) =>
      user.assignments.length > 0 &&
      user.assignments.every(
        (assignment) => assignment.submission?.status === "ACCEPTED",
      ),
  ).length;

  return (
    <AppShell user={admin}>
      <div className="flex flex-wrap items-end justify-between gap-5">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wider text-[#8125C8]">
            Административная панель
          </p>
          <h1 className="mt-2 text-4xl text-[#000000]">
            Рабочая группа
          </h1>
          <p className="mt-2 text-neutral-600">
            Эксперты, ответы и подготовка материалов доклада.
          </p>
        </div>
        <div className="flex gap-3">
          <Link
            href="/api/admin/export"
            className="rounded-xl border border-neutral-300 bg-white px-4 py-3 text-sm font-semibold text-[#000000] hover:bg-neutral-50"
          >
            ↓ Скачать XLSX
          </Link>
          <Link
            href="/admin/submissions"
            className="rounded-xl bg-[#0059C7] px-4 py-3 text-sm font-semibold text-white hover:bg-[#00479F]"
          >
            Все ответы
          </Link>
        </div>
      </div>

      <section className="mt-7 grid gap-4 sm:grid-cols-3">
        {[
          ["Компаний", companies],
          ["Экспертов", users.length],
          ["Завершили прохождение", completedExperts],
        ].map(([label, value]) => (
          <div key={label} className="paper rounded-2xl p-6">
            <p className="text-sm text-neutral-500">{label}</p>
            <p className="mt-2 text-4xl text-[#000000]">{value}</p>
          </div>
        ))}
      </section>

      <section className="paper mt-7 overflow-hidden rounded-2xl">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-200 px-6 py-5">
          <div>
            <h2 className="text-2xl font-bold text-[#000000]">
              Заявки на регистрацию
            </h2>
            <p className="mt-1 text-sm text-neutral-500">
              Ожидают согласования: {registrations.length}
            </p>
          </div>
          <span className="rounded-full bg-[#F1E5FB] px-3 py-1 text-xs font-bold text-[#6815A8]">
            Пароли защищены и не отображаются
          </span>
        </div>
        {query.registration && (
          <p className="border-b border-neutral-100 bg-neutral-50 px-6 py-3 text-sm text-neutral-600">
            {query.registration === "approved"
              ? "Заявка согласована, кабинет эксперта создан."
              : query.registration === "rejected"
                ? "Заявка отклонена."
                : query.registration === "duplicate"
                  ? "Пользователь с таким именем уже существует."
                  : "Заявка уже была обработана."}
          </p>
        )}
        <div className="divide-y divide-neutral-100">
          {registrations.map((request) => (
            <div
              key={request.id}
              className="grid gap-4 px-6 py-5 lg:grid-cols-[1fr_1fr_1fr_auto]"
            >
              <div>
                <p className="text-xs uppercase tracking-wider text-neutral-400">
                  Фамилия Имя
                </p>
                <p className="mt-1 font-bold text-[#000000]">
                  {request.fullName}
                </p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wider text-neutral-400">
                  Компания
                </p>
                <p className="mt-1 font-medium text-neutral-700">
                  {request.companyName}
                </p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wider text-neutral-400">
                  Подгруппа
                </p>
                <p className="mt-1 font-medium text-neutral-700">
                  {request.subgroup?.name ?? "Коммуникации"}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <form action={approveRegistration}>
                  <input type="hidden" name="requestId" value={request.id} />
                  <button className="rounded-lg bg-[#0059C7] px-4 py-2.5 text-sm font-bold text-white">
                    Согласовать
                  </button>
                </form>
                <form action={rejectRegistration}>
                  <input type="hidden" name="requestId" value={request.id} />
                  <button className="rounded-lg border border-[#FF9BC5] px-4 py-2.5 text-sm font-bold text-[#A9004A]">
                    Отклонить
                  </button>
                </form>
              </div>
            </div>
          ))}
          {!registrations.length && (
            <p className="px-6 py-9 text-center text-sm text-neutral-500">
              Новых заявок нет.
            </p>
          )}
        </div>
      </section>

      <SubgroupManager
        subgroups={subgroups}
        status={typeof query.subgroup === "string" ? query.subgroup : undefined}
      />

      <section className="paper mt-7 overflow-hidden rounded-2xl">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-200 px-6 py-5">
          <div>
            <h2 className="text-2xl text-[#000000]">Эксперты</h2>
            <p className="mt-1 text-sm text-neutral-500">
              Данные, доступ и прогресс участников
            </p>
          </div>
          {query.expert && (
            <span
              className={`rounded-full px-3 py-1 text-xs font-bold ${
                query.expert === "deleted"
                  ? "bg-[#DDF8FB] text-[#00616C]"
                  : "bg-[#FFE0ED] text-[#A9004A]"
              }`}
            >
              {query.expert === "deleted"
                ? "Эксперт удалён"
                : "Эксперт не найден"}
            </span>
          )}
        </div>
        <div className="divide-y divide-neutral-100">
          {users.map((user) => {
            const touched = user.assignments.filter(
              (item) => item.submission?.status !== "NOT_STARTED",
            ).length;
            return (
              <ExpertCard
                key={user.id}
                id={user.id}
                fullName={user.fullName}
                company={user.company?.name ?? "—"}
                subgroup={user.subgroup?.name ?? "—"}
                progress={`${touched}/${user.assignments.length}`}
                isActive={user.isActive}
                hasPassword={Boolean(user.passwordHash)}
              />
            );
          })}
          {!users.length && (
            <p className="px-6 py-9 text-center text-sm text-neutral-500">
              Экспертов пока нет.
            </p>
          )}
        </div>
      </section>

      <section className="paper mt-7 rounded-2xl p-6">
        <div className="max-w-3xl">
          <h2 className="text-2xl text-[#000000]">
            Добавить эксперта
          </h2>
          <p className="mt-2 text-sm leading-6 text-neutral-500">
            Заполните те же данные, что эксперт указывает при самостоятельной
            регистрации. Все восемь разделов будут назначены автоматически.
          </p>
          <div className="mt-5">
            <CreateExpertForm
              subgroups={subgroups.map(({ id, name }) => ({ id, name }))}
            />
          </div>
        </div>
      </section>

    </AppShell>
  );
}
