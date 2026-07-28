import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { statusLabels, statusStyles } from "@/lib/status";
import { formatSubgroups } from "@/lib/subgroups";

export default async function SubmissionsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const admin = await requireRole("ADMIN");
  const query = await searchParams;
  const company = typeof query.company === "string" ? query.company : "";
  const moduleId = typeof query.module === "string" ? query.module : "";
  const status =
    typeof query.status === "string" ? query.status : "SUBMITTED";
  const subgroup = typeof query.subgroup === "string" ? query.subgroup : "";
  const [submissions, companies, modules, subgroups] = await Promise.all([
    db.submission.findMany({
      where: {
        ...(status ? { status: status as never } : {}),
        assignment: {
          ...(moduleId ? { moduleId } : {}),
          user: {
            ...(company ? { companyId: company } : {}),
            ...(subgroup
              ? {
                  subgroupMemberships: {
                    some: { subgroupId: subgroup },
                  },
                }
              : {}),
          },
        },
      },
      include: {
        assignment: {
          include: {
            user: {
              include: {
                company: true,
                subgroupMemberships: { include: { subgroup: true } },
              },
            },
            module: true,
          },
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
      <Link href="/admin" className="text-sm font-semibold text-[#0059C7]">
        ← Обзор
      </Link>
      <div className="mt-5 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-4xl text-[#000000]">Ответы экспертов</h1>
          <p className="mt-2 text-neutral-600">Проверка и согласование материалов</p>
        </div>
        <Link
          href="/api/admin/export"
          className="rounded-xl border border-neutral-300 bg-white px-4 py-3 text-sm font-semibold text-[#000000]"
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
          <option value="SUBMITTED">Требуют решения</option>
          {Object.entries(statusLabels)
            .filter(([value]) => value !== "SUBMITTED")
            .map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
            ))}
        </select>
        <select className="field" name="subgroup" defaultValue={subgroup}>
          <option value="">Все подгруппы</option>
          {subgroups.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
        </select>
        <button className="rounded-xl bg-[#000000] px-4 py-3 font-semibold text-white">
          Применить
        </button>
      </form>
      {status === "SUBMITTED" && (
        <p className="mt-3 text-sm text-neutral-500">
          По умолчанию показаны только ответы, по которым требуется решение
          администратора.
        </p>
      )}

      <section className="paper mt-6 overflow-hidden rounded-2xl">
        <div className="border-b border-neutral-200 px-6 py-4 text-sm text-neutral-500">
          Найдено: {submissions.length}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[56rem] text-left text-sm">
            <thead className="bg-neutral-50 text-xs uppercase tracking-wider text-neutral-400">
              <tr>
                <th className="px-6 py-3">Эксперт</th>
                <th className="px-6 py-3">Компания</th>
                <th className="px-6 py-3">Раздел</th>
                <th className="px-6 py-3">Подгруппы</th>
                <th className="px-6 py-3">Статус</th>
                <th className="px-6 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {submissions.map((submission) => (
                <tr key={submission.id} className="hover:bg-neutral-50/70">
                  <td className="px-6 py-4 font-semibold text-[#000000]">
                    {submission.assignment.user.fullName}
                  </td>
                  <td className="px-6 py-4 text-neutral-600">
                    {submission.assignment.user.company?.name}
                  </td>
                  <td className="px-6 py-4 text-neutral-600">
                    {submission.assignment.module.order}. {submission.assignment.module.title}
                  </td>
                  <td className="px-6 py-4 text-neutral-600">
                    {formatSubgroups(
                      submission.assignment.user.subgroupMemberships,
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusStyles[submission.status]}`}>
                      {statusLabels[submission.status]}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center justify-end gap-4">
                      <a
                        href={`/api/assignments/${submission.assignmentId}/pdf`}
                        className="font-semibold text-[#8125C8]"
                      >
                        Скачать PDF
                      </a>
                      <Link href={`/admin/submissions/${submission.id}`} className="font-semibold text-[#0059C7]">
                      Открыть →
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!submissions.length && (
          <p className="p-10 text-center text-neutral-500">Ответов с такими фильтрами нет.</p>
        )}
      </section>
    </AppShell>
  );
}
