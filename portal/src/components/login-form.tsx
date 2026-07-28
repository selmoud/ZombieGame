"use client";

import { useActionState } from "react";
import { loginWithPassword, type LoginState } from "@/app/public-actions";

const initialState: LoginState = {};

export function LoginForm({ admin }: { admin: boolean }) {
  const [state, action, pending] = useActionState(
    loginWithPassword,
    initialState,
  );
  return (
    <form action={action} className="mt-7 space-y-4">
      {state.error && (
        <p className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700">
          {state.error}
        </p>
      )}
      <label>
        <span className="mb-1.5 block text-xs font-medium text-slate-600">
          Фамилия Имя
        </span>
        <input
          className="field"
          name="fullName"
          autoComplete="username"
          defaultValue={admin ? "Тимофей Мальцев" : ""}
          required
        />
      </label>
      <label>
        <span className="mb-1.5 block text-xs font-medium text-slate-600">
          Пароль
        </span>
        <input
          className="field"
          name="password"
          type="password"
          autoComplete="current-password"
          required
        />
      </label>
      <button
        disabled={pending}
        className="w-full rounded-xl bg-[#16877c] px-5 py-3.5 font-bold text-white hover:bg-[#0e655e] disabled:opacity-60"
      >
        {pending ? "Входим…" : "Войти"}
      </button>
    </form>
  );
}
