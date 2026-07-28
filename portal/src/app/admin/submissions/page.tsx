import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { statusLabels, statusStyles } from "@/lib/status";

export default async function SubmissionsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const admin = await requireRole("ADMIN");
  const query = await searchParams;
  const company = typeof query.company === "string" ? query.company : "";
  const moduleId = typeof query.module === "string" ? query.module : "";
  const status = typeof query.status === "string" ? query.status : "";
  const subgroup = typeof query.subgroup === "string" ? query.subgroup : "";
  const [submissions, companies, modules, subgroups] = await Promise.all([
    db.submission.findMany({
      where: {
        ...(status ? { status: status as never } : {}),
        assignment: {
          ...(moduleId ? { moduleId } : {}),
          user: {
            ...(company ? { companyId: company } : {}),
            ...(subgroup ? { subgroupId: subgroup } : {}),
          },
        },
      },
      include: {
        assignment: {
          include: { user: { include: { company: true, subgroup: true } }, module: true },
        },
      },
      orderBy: { updatedAt: "desc" },
    }),
    db.company.findMany({ orderBy: { name: "asc" } }),
    db.module.findMany({ orderBy: { order: "asc" } }),
    db.subgroup.findMany({ orderBy: { name: "asc" } }),
  ]);

  return (
    <AppShell user={admin}>
      <Link href="/admin" className="text-sm font-semibold text-[#16877c]">
        ← Обзор
      </Link>
      <div className="mt-5 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-serif text-4xl text-[#183a4a]">Ответы экспертов</h1>
          <p className="mt-2 text-slate-600">Проверка и согласование материалов</p>
        </div>
        <Link
          href="/api/admin/export"
          className="rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-[#183a4a]"
        >
          ↓ Выгрузить XLSX
        </Link>
      </div>

      <form className="paper mt-6 grid gap-3 rounded-2xl p-5 sm:grid-cols-2 xl:grid-cols-5">
        <select className="field" name="company" defaultValue={company}>
          <option value="">Все компании</option>
          {companies.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
        </select>
        <select className="field" name="module" defaultValue={moduleId}>
          <option value="">Все разделы</option>
          {modules.map((item) => <option key={item.id} value={item.id}>{item.order}. {item.title}</option>)}
        </select>
        <select className="field" name="status" defaultValue={status}>
          <option value="">Все статусы</option>
          {Object.entries(statusLabels).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
        <select className="field" name="subgroup" defaultValue={subgroup}>
          <option value="">Все подгруппы</option>
          {subgroups.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
        </select>
        <button className="rounded-xl bg-[#183a4a] px-4 py-3 font-semibold text-white">
          Применить
        </button>
      </form>

      <section className="paper mt-6 overflow-hidden rounded-2xl">
        <div className="border-b border-slate-200 px-6 py-4 text-sm text-slate-500">
          Найдено: {submissions.length}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[56rem] text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-400">
              <tr>
                <th className="px-6 py-3">Эксперт</th>
                <th className="px-6 py-3">Компания</th>
                <th className="px-6 py-3">Раздел</th>
                <th className="px-6 py-3">Подгруппа</th>
                <th className="px-6 py-3">Статус</th>
                <th className="px-6 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {submissions.map((submission) => (
                <tr key={submission.id} className="hover:bg-slate-50/70">
                  <td className="px-6 py-4 font-semibold text-[#183a4a]">
                    {submission.assignment.user.fullName}
                  </td>
                  <td className="px-6 py-4 text-slate-600">
                    {submission.assignment.user.company?.name}
                  </td>
                  <td className="px-6 py-4 text-slate-600">
                    {submission.assignment.module.order}. {submission.assignment.module.title}
                  </td>
                  <td className="px-6 py-4 text-slate-600">
                    {submission.assignment.user.subgroup?.name}
                  </td>
                  <td className="px-6 py-4">
                    <span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusStyles[submission.status]}`}>
                      {statusLabels[submission.status]}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <Link href={`/admin/submissions/${submission.id}`} className="font-semibold text-[#16877c]">
                      Открыть →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!submissions.length && (
          <p className="p-10 text-center text-slate-500">Ответов с такими фильтрами нет.</p>
        )}
      </section>
    </AppShell>
  );
}
