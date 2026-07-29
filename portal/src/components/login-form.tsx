"use client";

import { useActionState } from "react";
import { loginWithPassword, type LoginState } from "@/app/public-actions";

const initialState: LoginState = {};

export function LoginForm() {
  const [state, action, pending] = useActionState(
    loginWithPassword,
    initialState,
  );
  return (
    <form action={action} className="mt-7 flex flex-col gap-4">
      {state.error && (
        <p className="rounded-lg bg-[#FFE0ED] p-3 text-sm text-[#A9004A]">
          {state.error}
        </p>
      )}
      <label className="block">
        <span className="mb-1.5 block text-xs font-medium text-neutral-600">
          Фамилия Имя
        </span>
        <input
          className="field"
          name="fullName"
          autoComplete="username"
          required
        />
      </label>
      <label className="block">
        <span className="mb-1.5 block text-xs font-medium text-neutral-600">
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
        className="w-full rounded-xl bg-[#0059C7] px-5 py-3.5 font-bold text-white hover:bg-[#00479F] disabled:opacity-60"
      >
        {pending ? "Входим…" : "Войти"}
      </button>
    </form>
  );
}
