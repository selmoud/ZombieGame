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
            Он может сразу войти с указанными ФИО и паролем.
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
            Фамилия и имя
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
        <fieldset className="md:col-span-2">
          <legend className="text-xs font-medium text-neutral-600">
            Подгруппы
          </legend>
          <p className="mt-1 text-xs text-neutral-500">
            Можно выбрать несколько вариантов
          </p>
          <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {subgroups.map((subgroup) => (
              <label
                key={subgroup.id}
                className="flex cursor-pointer items-center gap-2 rounded-xl border border-neutral-300 px-3 py-2.5 text-sm text-neutral-700 has-checked:border-[#0D78F8] has-checked:bg-[#E0EEFF] has-checked:text-[#0059C7]"
              >
                <input
                  type="checkbox"
                  name="subgroupIds"
                  value={subgroup.id}
                  className="size-4 accent-[#0059C7]"
                />
                {subgroup.name}
              </label>
            ))}
          </div>
        </fieldset>
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
