import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { CreateExpertForm } from "@/components/create-expert-form";
import { ExpertCard } from "@/components/expert-card";
import { SubgroupManager } from "@/components/subgroup-manager";
import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatSubgroups } from "@/lib/subgroups";
import {
  approveRegistration,
  rejectRegistration,
  saveMinistryEconomicData,
  sendRegistrationMessage,
} from "./actions";

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const admin = await requireRole("ADMIN");
  const query = await searchParams;
  const [users, companies, registrations, subgroups, economicData] =
    await Promise.all([
    db.user.findMany({
      where: { role: { in: ["EXPERT", "LEAD"] } },
      include: {
        company: true,
        subgroupMemberships: { include: { subgroup: true } },
        assignments: { include: { submission: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    db.company.count({
      where: { users: { some: { role: { in: ["EXPERT", "LEAD"] } } } },
    }),
    db.registrationRequest.findMany({
      where: { status: "PENDING" },
      select: {
        id: true,
        fullName: true,
        companyName: true,
        experienceSummary: true,
        expertiseReason: true,
        maxBotBinding: { select: { enabled: true } },
        messages: {
          select: {
            id: true,
            direction: true,
            text: true,
            createdAt: true,
            adminAuthor: { select: { fullName: true } },
          },
          orderBy: { createdAt: "asc" },
        },
        subgroupMemberships: { include: { subgroup: true } },
      },
      orderBy: { createdAt: "asc" },
    }),
    db.subgroup.findMany({
      include: {
        leader: { select: { id: true, fullName: true } },
        userMemberships: {
          where: {
            user: {
              role: { in: ["EXPERT", "LEAD"] },
              isActive: true,
            },
          },
          include: {
            user: { select: { id: true, fullName: true } },
          },
          orderBy: { user: { fullName: "asc" } },
        },
        _count: {
          select: {
            userMemberships: {
              where: { user: { role: { in: ["EXPERT", "LEAD"] } } },
            },
            registrationMemberships: {
              where: { registrationRequest: { status: "PENDING" } },
            },
          },
        },
      },
      orderBy: { name: "asc" },
    }),
    db.ministryEconomicData.findUnique({
      where: { industry: "Коммуникации, медиа и развлечения" },
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
      <div className="flex flex-col">
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
        <div className="flex flex-wrap gap-3">
          <Link
            href="/admin/analytics"
            className="rounded-xl border border-[#0059C7] bg-white px-4 py-3 text-sm font-semibold text-[#0059C7] hover:bg-[#E0EEFF]"
          >
            Сводная аналитика
          </Link>
          <a
            href="/api/reports/summary?scope=all"
            className="rounded-xl border border-[#0059C7] bg-white px-4 py-3 text-sm font-semibold text-[#0059C7] hover:bg-[#E0EEFF]"
          >
            Итоговый PDF
          </a>
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

      <section
        id="economic-data"
        className="paper order-last mt-7 overflow-hidden rounded-2xl"
      >
        <div className="border-b border-neutral-200 px-6 py-5">
          <p className="text-sm font-semibold uppercase tracking-wider text-[#8125C8]">
            Данные Минэкономразвития
          </p>
          <h2 className="mt-2 text-2xl font-bold text-black">
            Место отрасли в экономике
          </h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-neutral-500">
            Эти данные дополняют экспертные оценки раздела 1 и не относятся к
            ответам отдельного эксперта. Доли указываются в процентах.
          </p>
        </div>
        {query.economy && (
          <p
            className={`border-b px-6 py-3 text-sm ${
              query.economy === "saved"
                ? "border-[#7EE0EC] bg-[#DDF8FB] text-[#00616C]"
                : "border-[#FF9BC5] bg-[#FFE0ED] text-[#A9004A]"
            }`}
          >
            {query.economy === "saved"
              ? "Макроэкономические данные сохранены."
              : "Проверьте доли: допустимы значения от 0 до 100%."}
          </p>
        )}
        <form action={saveMinistryEconomicData} className="grid gap-5 p-6 lg:grid-cols-3">
          <label>
            <span className="mb-1.5 block text-xs font-medium text-neutral-600">
              Отчётный период
            </span>
            <input
              className="field"
              name="reportingPeriod"
              defaultValue={economicData?.reportingPeriod ?? ""}
              placeholder="Например, 2025 год"
            />
          </label>
          {[
            ["gdpShare", "Доля отрасли в ВВП, %", economicData?.gdpShare],
            ["gvaShare", "Доля отрасли в ВДС, %", economicData?.gvaShare],
            [
              "employmentShare",
              "Доля в общей структуре занятости, %",
              economicData?.employmentShare,
            ],
          ].map(([name, label, value]) => (
            <label key={String(name)}>
              <span className="mb-1.5 block text-xs font-medium text-neutral-600">
                {String(label)}
              </span>
              <input
                className="field"
                name={String(name)}
                type="number"
                min="0"
                max="100"
                step="0.01"
                defaultValue={value === null || value === undefined ? "" : String(value)}
              />
            </label>
          ))}
          <label>
            <span className="mb-1.5 block text-xs font-medium text-neutral-600">
              Инвестиционная активность и привлекательность
            </span>
            <select
              className="field"
              name="investmentActivity"
              defaultValue={economicData?.investmentActivity ?? ""}
            >
              <option value="">Не заполнено</option>
              {[
                "Очень высокая",
                "Высокая",
                "Средняя",
                "Низкая",
                "Очень низкая",
                "Затрудняюсь оценить",
              ].map((value) => (
                <option key={value}>{value}</option>
              ))}
            </select>
          </label>
          <label>
            <span className="mb-1.5 block text-xs font-medium text-neutral-600">
              Производительность труда относительно среднероссийской
            </span>
            <select
              className="field"
              name="productivityComparison"
              defaultValue={economicData?.productivityComparison ?? ""}
            >
              <option value="">Не заполнено</option>
              {[
                "Значительно выше",
                "Выше",
                "Сопоставима",
                "Ниже",
                "Значительно ниже",
                "Затрудняюсь оценить",
              ].map((value) => (
                <option key={value}>{value}</option>
              ))}
            </select>
          </label>
          <label className="lg:col-span-3">
            <span className="mb-1.5 block text-xs font-medium text-neutral-600">
              Источник
            </span>
            <textarea
              className="field min-h-24"
              name="source"
              defaultValue={economicData?.source ?? ""}
              placeholder="Название источника, ссылка, период и дата публикации"
            />
          </label>
          <label className="lg:col-span-3">
            <span className="mb-1.5 block text-xs font-medium text-neutral-600">
              Комментарий
            </span>
            <textarea
              className="field min-h-24"
              name="comment"
              defaultValue={economicData?.comment ?? ""}
              placeholder="Методика расчёта, ограничения сопоставимости или пояснение"
            />
          </label>
          <div className="lg:col-span-3">
            <button className="rounded-xl bg-[#0059C7] px-5 py-3 font-semibold text-white hover:bg-[#00479F]">
              Сохранить данные
            </button>
          </div>
        </form>
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
                : query.registration === "message-sent"
                  ? "Сообщение отправлено эксперту в MAX."
                  : query.registration === "message-unavailable"
                    ? "Эксперт ещё не подключил бот MAX. Отправить сообщение пока нельзя."
                    : query.registration === "message-invalid"
                      ? "Введите сообщение длиной до 2000 символов."
                : query.registration === "duplicate"
                  ? "Пользователь с такими ФИО уже существует."
                  : "Заявка уже была обработана."}
          </p>
        )}
        <div className="divide-y divide-neutral-100">
          {registrations.map((request) => (
            <div
              key={request.id}
              id={`registration-${request.id}`}
              className="grid gap-4 px-6 py-5 lg:grid-cols-[1fr_1fr_1fr_auto]"
            >
              <div>
                <p className="text-xs uppercase tracking-wider text-neutral-400">
                  Фамилия и имя
                </p>
                <p className="mt-1 font-bold text-[#000000]">
                  {request.fullName}
                </p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wider text-neutral-400">
                  Организация
                </p>
                <p className="mt-1 font-medium text-neutral-700">
                  {request.companyName}
                </p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wider text-neutral-400">
                  Подгруппы
                </p>
                <p className="mt-1 font-medium text-neutral-700">
                  {formatSubgroups(request.subgroupMemberships)}
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
              {(request.experienceSummary || request.expertiseReason) && (
                <div className="grid gap-4 rounded-xl bg-neutral-50 p-4 lg:col-span-4 lg:grid-cols-2">
                  <div>
                    <p className="text-xs uppercase tracking-wider text-neutral-400">
                      Опыт работы
                    </p>
                    <p className="mt-1 text-sm leading-6 text-neutral-700">
                      {request.experienceSummary ?? "—"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wider text-neutral-400">
                      Основание для включения в экспертную группу
                    </p>
                    <p className="mt-1 text-sm leading-6 text-neutral-700">
                      {request.expertiseReason ?? "—"}
                    </p>
                  </div>
                </div>
              )}
              <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-4 lg:col-span-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-bold text-[#000000]">
                      Переписка с экспертом
                    </p>
                    <p className="mt-1 text-sm text-neutral-500">
                      Уточняйте данные заявки до её согласования.
                    </p>
                  </div>
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-semibold ${
                      request.maxBotBinding?.enabled
                        ? "bg-[#E0EEFF] text-[#0059C7]"
                        : "bg-neutral-200 text-neutral-600"
                    }`}
                  >
                    {request.maxBotBinding?.enabled
                      ? "MAX подключён"
                      : "MAX не подключён"}
                  </span>
                </div>
                {request.messages.length > 0 && (
                  <div className="mt-4 grid gap-2">
                    {request.messages.map((message) => (
                      <div
                        key={message.id}
                        className={`max-w-3xl rounded-xl px-4 py-3 text-sm ${
                          message.direction === "ADMIN_TO_EXPERT"
                            ? "ml-auto bg-[#E0EEFF] text-[#003A82]"
                            : "border border-[#7BE3ED] bg-white text-neutral-800"
                        }`}
                      >
                        <div className="mb-1 flex flex-wrap items-center justify-between gap-3 text-xs font-semibold opacity-70">
                          <span>
                            {message.direction === "ADMIN_TO_EXPERT"
                              ? message.adminAuthor?.fullName ?? "Администратор"
                              : request.fullName}
                          </span>
                          <time>
                            {message.createdAt.toLocaleString("ru-RU", {
                              timeZone: "Europe/Moscow",
                              day: "2-digit",
                              month: "2-digit",
                              year: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </time>
                        </div>
                        <p className="whitespace-pre-wrap leading-6">
                          {message.text}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
                <form
                  action={sendRegistrationMessage}
                  className="mt-4 flex flex-col gap-3 lg:flex-row lg:items-end"
                >
                  <input type="hidden" name="requestId" value={request.id} />
                  <label className="min-w-0 flex-1">
                    <span className="mb-1.5 block text-xs font-medium text-neutral-600">
                      Сообщение эксперту
                    </span>
                    <textarea
                      className="field min-h-24 resize-y"
                      name="message"
                      maxLength={2000}
                      required
                      disabled={!request.maxBotBinding?.enabled}
                      placeholder={
                        request.maxBotBinding?.enabled
                          ? "Например: уточните вашу должность и опыт работы в отрасли"
                          : "Эксперт ещё не подключил бот MAX"
                      }
                    />
                  </label>
                  <button
                    disabled={!request.maxBotBinding?.enabled}
                    className="rounded-xl bg-[#0059C7] px-5 py-3 font-semibold text-white hover:bg-[#00479F] disabled:cursor-not-allowed disabled:bg-neutral-300"
                  >
                    Отправить в MAX
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
        subgroups={subgroups.map((subgroup) => ({
          id: subgroup.id,
          name: subgroup.name,
          experts: subgroup._count.userMemberships,
          requests: subgroup._count.registrationMemberships,
          leaderId: subgroup.leaderId,
          members: subgroup.userMemberships.map(({ user }) => user),
        }))}
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
            const accepted = user.assignments.filter(
              (item) => item.submission?.status === "ACCEPTED",
            ).length;
            return (
              <ExpertCard
                key={user.id}
                id={user.id}
                fullName={user.fullName}
                company={user.company?.name ?? "—"}
                subgroup={formatSubgroups(user.subgroupMemberships)}
                progress={`${accepted}/${user.assignments.length}`}
                isActive={user.isActive}
                hasPassword={Boolean(user.passwordHash)}
                experienceSummary={user.experienceSummary}
                expertiseReason={user.expertiseReason}
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

      </div>
    </AppShell>
  );
}
