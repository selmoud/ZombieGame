"use client";

import { useActionState, useState } from "react";
import {
  deleteExpert,
  resetExpertPassword,
  type ResetExpertPasswordState,
} from "@/app/admin/actions";

const initialPasswordState: ResetExpertPasswordState = {};

export function ExpertCard({
  id,
  fullName,
  company,
  subgroup,
  progress,
  isActive,
  hasPassword,
}: {
  id: string;
  fullName: string;
  company: string;
  subgroup: string;
  progress: string;
  isActive: boolean;
  hasPassword: boolean;
}) {
  const [showPassword, setShowPassword] = useState(false);
  const [state, action, pending] = useActionState(
    resetExpertPassword,
    initialPasswordState,
  );

  return (
    <article className="px-6 py-5">
      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-5">
        <DataItem label="ФИО">
          <span className="font-bold text-black">{fullName}</span>
          <span className="mt-1 block text-xs text-neutral-400">
            {isActive ? "Доступ активен" : "Ожидает входа"}
          </span>
        </DataItem>
        <DataItem label="Компания">{company}</DataItem>
        <DataItem label="Пароль">
          <span className="font-mono tracking-widest">
            {hasPassword ? "••••••••" : "не задан"}
          </span>
        </DataItem>
        <DataItem label="Подгруппа">{subgroup}</DataItem>
        <DataItem label="Прогресс">{progress}</DataItem>
      </div>

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
