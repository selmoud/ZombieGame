"use client";

import { useActionState, useState } from "react";
import {
  deleteExpert,
  resetExpertPassword,
  updateExpertCompany,
  type ResetExpertPasswordState,
  type UpdateExpertCompanyState,
} from "@/app/admin/actions";

const initialPasswordState: ResetExpertPasswordState = {};
const initialCompanyState: UpdateExpertCompanyState = {};

export function ExpertCard({
  id,
  fullName,
  phoneNumber,
  company,
  subgroup,
  progress,
  isActive,
  maxConnected,
  hasPassword,
  experienceSummary,
  expertiseReason,
}: {
  id: string;
  fullName: string;
  phoneNumber?: string | null;
  company: string;
  subgroup: string;
  progress: string;
  isActive: boolean;
  maxConnected: boolean;
  hasPassword: boolean;
  experienceSummary?: string | null;
  expertiseReason?: string | null;
}) {
  const [showPassword, setShowPassword] = useState(false);
  const [state, action, pending] = useActionState(
    resetExpertPassword,
    initialPasswordState,
  );
  const [companyState, companyAction, companyPending] = useActionState(
    updateExpertCompany,
    initialCompanyState,
  );

  return (
    <article className="px-6 py-5">
      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-[1.1fr_0.9fr_1.7fr_0.9fr_1.1fr_0.7fr]">
        <DataItem label="ФИО">
          <span className="font-bold text-black">{fullName}</span>
          <span className="mt-1 block text-xs text-neutral-400">
            {isActive ? "Доступ активен" : "Ожидает входа"}
          </span>
          <span
            className={`mt-2 inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
              maxConnected
                ? "bg-[#E0EEFF] text-[#0059C7]"
                : "bg-neutral-100 text-neutral-500"
            }`}
          >
            {maxConnected ? "MAX подключён" : "MAX не подключён"}
          </span>
        </DataItem>
        <DataItem label="Телефон">
          {phoneNumber ? (
            <a className="font-medium text-[#0059C7]" href={`tel:${phoneNumber}`}>
              {phoneNumber}
            </a>
          ) : (
            "—"
          )}
        </DataItem>
        <DataItem label="Организация">
          <form action={companyAction} className="flex items-center gap-2">
            <input type="hidden" name="userId" value={id} />
            <input
              className="field min-w-0 py-2"
              name="company"
              defaultValue={company === "—" ? "" : company}
              maxLength={160}
              aria-label={`Организация эксперта ${fullName}`}
              required
            />
            <button
              disabled={companyPending}
              className="shrink-0 rounded-lg border border-neutral-300 px-3 py-2 text-xs font-bold text-black hover:bg-neutral-50 disabled:opacity-60"
            >
              {companyPending ? "…" : "Сохранить"}
            </button>
          </form>
          {companyState.error && (
            <span className="mt-1 block text-xs text-[#A9004A]">
              {companyState.error}
            </span>
          )}
          {companyState.success && (
            <span className="mt-1 block text-xs text-[#00616C]">
              Организация сохранена
            </span>
          )}
        </DataItem>
        <DataItem label="Пароль">
          <span className="font-mono tracking-widest">
            {hasPassword ? "••••••••" : "не задан"}
          </span>
        </DataItem>
        <DataItem label="Подгруппы">{subgroup}</DataItem>
        <DataItem label="Прогресс">{progress}</DataItem>
      </div>

      {(experienceSummary || expertiseReason) && (
        <div className="mt-4 grid gap-4 rounded-xl bg-neutral-50 p-4 md:grid-cols-2">
          <DataItem label="Опыт работы">{experienceSummary ?? "—"}</DataItem>
          <DataItem label="Экспертный профиль">{expertiseReason ?? "—"}</DataItem>
        </div>
      )}

      <div className="mt-5 flex flex-wrap items-center justify-between gap-4 border-t border-neutral-100 pt-4">
        <label className="flex cursor-pointer items-center gap-2 text-sm font-medium text-[#0059C7]">
          <input
            type="checkbox"
            checked={showPassword}
            onChange={(event) => setShowPassword(event.target.checked)}
          />
          Показать управление паролем
        </label>
        <form
          action={deleteExpert}
          onSubmit={(event) => {
            if (
              !window.confirm(
                `Удалить эксперта «${fullName}» вместе со всеми его ответами?`,
              )
            ) {
              event.preventDefault();
            }
          }}
        >
          <input type="hidden" name="userId" value={id} />
          <button className="rounded-lg border border-[#FF9BC5] px-4 py-2 text-sm font-bold text-[#A9004A] hover:bg-[#FFE0ED]">
            Удалить эксперта
          </button>
        </form>
      </div>

      {showPassword && (
        <form
          action={action}
          className="mt-4 grid gap-3 rounded-xl bg-neutral-50 p-4 md:grid-cols-[1fr_1fr_auto]"
        >
          <input type="hidden" name="userId" value={id} />
          <label>
            <span className="mb-1.5 block text-xs font-medium text-neutral-600">
              Новый пароль
            </span>
            <input
              className="field"
              type="text"
              name="password"
              minLength={8}
              autoComplete="new-password"
              required
            />
          </label>
          <label>
            <span className="mb-1.5 block text-xs font-medium text-neutral-600">
              Повторите пароль
            </span>
            <input
              className="field"
              type="text"
              name="passwordConfirmation"
              minLength={8}
              autoComplete="new-password"
              required
            />
          </label>
          <button
            disabled={pending}
            className="self-end rounded-xl bg-[#8125C8] px-4 py-3 font-bold text-white disabled:opacity-60"
          >
            {pending ? "Сохраняем…" : "Задать пароль"}
          </button>
          <p className="text-xs leading-5 text-neutral-500 md:col-span-3">
            Исходный пароль нельзя показать: он хранится в защищённом виде.
            Здесь можно задать новый пароль.
          </p>
          {state.error && (
            <p className="text-sm text-[#A9004A] md:col-span-3">{state.error}</p>
          )}
          {state.success && (
            <p className="text-sm text-[#00616C] md:col-span-3">
              Новый пароль сохранён. Старые сеансы эксперта завершены.
            </p>
          )}
        </form>
      )}
    </article>
  );
}

function DataItem({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wider text-neutral-400">
        {label}
      </p>
      <div className="mt-1 text-sm text-neutral-700">{children}</div>
    </div>
  );
}
