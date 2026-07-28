"use client";

import { useActionState } from "react";
import {
  createExpert,
  type CreateExpertState,
} from "@/app/admin/actions";

const initialState: CreateExpertState = {};

export function CreateExpertForm() {
  const [state, action, pending] = useActionState(createExpert, initialState);

  return (
    <>
      {state.link && (
        <div className="mb-5 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
          <p className="font-semibold text-emerald-900">
            Приглашение для {state.expert} создано
          </p>
          <p className="mt-1 text-xs leading-5 text-emerald-800">
            Скопируйте ссылку сейчас: после обновления страницы она скроется.
          </p>
          <input
            className="field mt-3 font-mono text-xs"
            value={state.link}
            readOnly
            onFocus={(event) => event.currentTarget.select()}
          />
        </div>
      )}
      {state.error && (
        <p className="mb-4 rounded-lg bg-rose-50 p-3 text-sm text-rose-700">
          {state.error}
        </p>
      )}
      <form action={action} className="space-y-4">
        {[
          ["fullName", "ФИО *", "Иванов Иван Иванович"],
          ["company", "Компания *", "Название организации"],
          ["position", "Должность", "Директор по развитию"],
          ["subgroup", "Подгруппа *", "Медиа и контент"],
        ].map(([name, label, placeholder]) => (
          <label key={name}>
            <span className="mb-1.5 block text-xs font-medium text-slate-600">
              {label}
            </span>
            <input className="field" name={name} placeholder={placeholder} />
          </label>
        ))}
        <button
          disabled={pending}
          className="w-full rounded-xl bg-[#2d6f91] px-4 py-3 font-semibold text-white hover:bg-[#255b78] disabled:opacity-60"
        >
          {pending ? "Создаём…" : "Создать приглашение"}
        </button>
      </form>
    </>
  );
}
