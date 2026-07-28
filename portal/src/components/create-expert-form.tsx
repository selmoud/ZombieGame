"use client";

import { useActionState, useState } from "react";
import {
  createExpert,
  type CreateExpertState,
} from "@/app/admin/actions";

const initialState: CreateExpertState = {};

export function CreateExpertForm({
  subgroups,
}: {
  subgroups: Array<{ id: string; name: string }>;
}) {
  const [state, action, pending] = useActionState(createExpert, initialState);
  const [showPassword, setShowPassword] = useState(false);

  return (
    <>
      {state.success && (
        <div className="mb-5 rounded-xl border border-[#7EE0EC] bg-[#DDF8FB] p-4">
          <p className="font-semibold text-[#004E57]">
            Эксперт {state.expert} добавлен
          </p>
          <p className="mt-1 text-xs leading-5 text-[#00616C]">
            Он может сразу войти с указанными именем и паролем.
          </p>
        </div>
      )}
      {state.error && (
        <p className="mb-4 rounded-lg bg-[#FFE0ED] p-3 text-sm text-[#A9004A]">
          {state.error}
        </p>
      )}
      <form action={action} className="grid gap-4 md:grid-cols-2">
        <label>
          <span className="mb-1.5 block text-xs font-medium text-neutral-600">
            Фамилия Имя
          </span>
          <input
            className="field"
            name="fullName"
            placeholder="Иванов Иван"
            autoComplete="name"
            required
          />
        </label>
        <label>
          <span className="mb-1.5 block text-xs font-medium text-neutral-600">
            Компания
          </span>
          <input
            className="field"
            name="company"
            placeholder="Название организации"
            autoComplete="organization"
            required
          />
        </label>
        <label>
          <span className="mb-1.5 block text-xs font-medium text-neutral-600">
            Подгруппа
          </span>
          <select
            className="field"
            name="subgroupId"
            defaultValue=""
            required
          >
            <option value="" disabled>
              Выберите подгруппу
            </option>
            {subgroups.map((subgroup) => (
              <option key={subgroup.id} value={subgroup.id}>
                {subgroup.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="mb-1.5 block text-xs font-medium text-neutral-600">
            Пароль
          </span>
          <input
            className="field"
            name="password"
            type={showPassword ? "text" : "password"}
            minLength={8}
            autoComplete="new-password"
            required
          />
        </label>
        <label className="md:col-start-2">
          <span className="mb-1.5 block text-xs font-medium text-neutral-600">
            Повторите пароль
          </span>
          <input
            className="field"
            name="passwordConfirmation"
            type={showPassword ? "text" : "password"}
            minLength={8}
            autoComplete="new-password"
            required
          />
        </label>
        <label className="flex items-center gap-2 text-sm text-neutral-600 md:col-span-2">
          <input
            type="checkbox"
            checked={showPassword}
            onChange={(event) => setShowPassword(event.target.checked)}
          />
          Показать пароль
        </label>
        <div className="md:col-span-2">
          <button
            disabled={pending}
            className="w-full rounded-xl bg-[#0059C7] px-4 py-3 font-semibold text-white hover:bg-[#00479F] disabled:opacity-60 md:w-auto md:min-w-56"
          >
            {pending ? "Добавляем…" : "Добавить эксперта"}
          </button>
        </div>
      </form>
    </>
  );
}
