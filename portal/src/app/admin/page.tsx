import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { CreateExpertForm } from "@/components/create-expert-form";
import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { statusLabels, statusStyles } from "@/lib/status";
import { approveRegistration, rejectRegistration } from "./actions";

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const admin = await requireRole("ADMIN");
  const query = await searchParams;
  const [users, submissions, companies, registrations] = await Promise.all([
    db.user.findMany({
      where: { role: { in: ["EXPERT", "LEAD"] } },
      include: {
        company: true,
        subgroup: true,
        assignments: { include: { submission: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    db.submission.findMany({
      include: {
        assignment: { include: { user: true, module: true } },
      },
      orderBy: { updatedAt: "desc" },
      take: 6,
    }),
    db.company.count(),
    db.registrationRequest.findMany({
      where: { status: "PENDING" },
      orderBy: { createdAt: "asc" },
    }),
  ]);
  const submittedCount = submissions.filter((item) =>
    ["SUBMITTED", "ACCEPTED"].includes(item.status),
  ).length;

  return (
    <AppShell user={admin}>
      <div className="flex flex-wrap items-end justify-between gap-5">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wider text-[#2d6f91]">
            Административная панель
          </p>
          <h1 className="mt-2 text-4xl text-[#243e52]">
            Рабочая группа
          </h1>
          <p className="mt-2 text-slate-600">
            Эксперты, ответы и подготовка материалов доклада.
          </p>
        </div>
        <div className="flex gap-3">
          <Link
            href="/api/admin/export"
            className="rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-[#243e52] hover:bg-slate-50"
          >
            ↓ Скачать XLSX
          </Link>
          <Link
            href="/admin/submissions"
            className="rounded-xl bg-[#2d6f91] px-4 py-3 text-sm font-semibold text-white hover:bg-[#255b78]"
          >
            Все ответы
          </Link>
        </div>
      </div>

      <section className="mt-7 grid gap-4 sm:grid-cols-3">
        {[
          ["Экспертов", users.length],
          ["Компаний", companies],
          ["Готово к работе", submittedCount],
        ].map(([label, value]) => (
          <div key={label} className="paper rounded-2xl p-6">
            <p className="text-sm text-slate-500">{label}</p>
            <p className="mt-2 text-4xl text-[#243e52]">{value}</p>
          </div>
        ))}
      </section>

      <section className="paper mt-7 overflow-hidden rounded-2xl">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-6 py-5">
          <div>
            <h2 className="text-2xl font-bold text-[#243e52]">
              Заявки на регистрацию
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Ожидают согласования: {registrations.length}
            </p>
          </div>
          <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-bold text-amber-700">
            Пароли защищены и не отображаются
          </span>
        </div>
        {query.registration && (
          <p className="border-b border-slate-100 bg-slate-50 px-6 py-3 text-sm text-slate-600">
            {query.registration === "approved"
              ? "Заявка согласована, кабинет эксперта создан."
              : query.registration === "rejected"
                ? "Заявка отклонена."
                : query.registration === "duplicate"
                  ? "Пользователь с таким именем уже существует."
                  : "Заявка уже была обработана."}
          </p>
        )}
        <div className="divide-y divide-slate-100">
          {registrations.map((request) => (
            <div
              key={request.id}
              className="grid gap-4 px-6 py-5 lg:grid-cols-[1fr_1fr_auto]"
            >
              <div>
                <p className="text-xs uppercase tracking-wider text-slate-400">
                  Фамилия Имя
                </p>
                <p className="mt-1 font-bold text-[#243e52]">
                  {request.fullName}
                </p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wider text-slate-400">
                  Компания
                </p>
                <p className="mt-1 font-medium text-slate-700">
                  {request.companyName}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <form action={approveRegistration}>
                  <input type="hidden" name="requestId" value={request.id} />
                  <button className="rounded-lg bg-[#2d6f91] px-4 py-2.5 text-sm font-bold text-white">
                    Согласовать
                  </button>
                </form>
                <form action={rejectRegistration}>
                  <input type="hidden" name="requestId" value={request.id} />
                  <button className="rounded-lg border border-rose-200 px-4 py-2.5 text-sm font-bold text-rose-700">
                    Отклонить
                  </button>
                </form>
              </div>
            </div>
          ))}
          {!registrations.length && (
            <p className="px-6 py-9 text-center text-sm text-slate-500">
              Новых заявок нет.
            </p>
          )}
        </div>
      </section>

      <div className="mt-7 grid gap-6 xl:grid-cols-[minmax(0,1fr)_23rem]">
        <section className="paper overflow-hidden rounded-2xl">
          <div className="flex items-center justify-between border-b border-slate-200 px-6 py-5">
            <div>
              <h2 className="text-2xl text-[#243e52]">Эксперты</h2>
              <p className="mt-1 text-sm text-slate-500">Участники и прогресс</p>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[42rem] text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-400">
                <tr>
                  <th className="px-6 py-3 font-semibold">ФИО</th>
                  <th className="px-6 py-3 font-semibold">Компания</th>
                  <th className="px-6 py-3 font-semibold">Подгруппа</th>
                  <th className="px-6 py-3 font-semibold">Прогресс</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {users.map((user) => {
                  const touched = user.assignments.filter(
                    (item) => item.submission?.status !== "NOT_STARTED",
                  ).length;
                  return (
                    <tr key={user.id}>
                      <td className="px-6 py-4 font-semibold text-[#243e52]">
                        {user.fullName}
                        <span className="mt-0.5 block text-xs font-normal text-slate-400">
                          {user.isActive ? "Приглашение принято" : "Ожидает входа"}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-slate-600">{user.company?.name}</td>
                      <td className="px-6 py-4 text-slate-600">{user.subgroup?.name}</td>
                      <td className="px-6 py-4 text-slate-600">
                        {touched}/{user.assignments.length}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        <section className="paper rounded-2xl p-6">
          <h2 className="text-2xl text-[#243e52]">
            Добавить эксперта
          </h2>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            Эксперту будут назначены все восемь разделов.
          </p>
          <div className="mt-5">
            <CreateExpertForm />
          </div>
        </section>
      </div>

      <section className="paper mt-7 rounded-2xl p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl text-[#243e52]">Последние ответы</h2>
          <Link href="/admin/submissions" className="text-sm font-semibold text-[#2d6f91]">
            Смотреть все →
          </Link>
        </div>
        <div className="mt-4 grid gap-3">
          {submissions.map((submission) => (
            <Link
              key={submission.id}
              href={`/admin/submissions/${submission.id}`}
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 p-4 hover:border-[#2d6f91]/50"
            >
              <div>
                <p className="font-semibold text-[#243e52]">
                  {submission.assignment.user.fullName}
                </p>
                <p className="mt-1 text-sm text-slate-500">
                  {submission.assignment.module.title}
                </p>
              </div>
              <span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusStyles[submission.status]}`}>
                {statusLabels[submission.status]}
              </span>
            </Link>
          ))}
        </div>
      </section>
    </AppShell>
  );
}
