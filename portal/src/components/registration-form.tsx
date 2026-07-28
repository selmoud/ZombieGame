"use client";

import Link from "next/link";
import { useActionState } from "react";
import {
  submitRegistration,
  type RegistrationState,
} from "@/app/public-actions";

const initialState: RegistrationState = {};

export function RegistrationForm() {
  const [state, action, pending] = useActionState(
    submitRegistration,
    initialState,
  );

  if (state.success) {
    return (
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6">
        <p className="text-lg font-bold text-emerald-900">
          Заявка отправлена
        </p>
        <p className="mt-2 leading-7 text-emerald-800">
          Администратор проверит данные. После согласования вы сможете войти с
          указанными именем и паролем.
        </p>
        <Link
          href="/login"
          className="mt-5 inline-block font-bold text-[#2d6f91]"
        >
          Перейти ко входу →
        </Link>
      </div>
    );
  }

  return (
    <form action={action} className="flex flex-col gap-4">
      {state.error && (
        <p className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700">
          {state.error}
        </p>
      )}
      <label className="block">
        <span className="mb-1.5 block text-xs font-medium text-slate-600">
          Фамилия Имя
        </span>
        <input
          className="field"
          name="fullName"
          autoComplete="name"
          placeholder="Иванов Иван"
          required
        />
      </label>
      <label className="block">
        <span className="mb-1.5 block text-xs font-medium text-slate-600">
          Компания
        </span>
        <input
          className="field"
          name="company"
          autoComplete="organization"
          placeholder="Название организации"
          required
        />
      </label>
      <label className="block">
        <span className="mb-1.5 block text-xs font-medium text-slate-600">
          Пароль
        </span>
        <input
          className="field"
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={8}
          required
        />
      </label>
      <label className="block">
        <span className="mb-1.5 block text-xs font-medium text-slate-600">
          Повторите пароль
        </span>
        <input
          className="field"
          name="passwordConfirmation"
          type="password"
          autoComplete="new-password"
          minLength={8}
          required
        />
      </label>
      <button
        disabled={pending}
        className="w-full rounded-xl bg-[#2d6f91] px-5 py-3.5 font-bold text-white transition hover:bg-[#255b78] disabled:opacity-60"
      >
        {pending ? "Отправляем…" : "Отправить"}
      </button>
      <Link
        href="/login?role=admin"
        className="block rounded-xl border border-slate-300 px-5 py-3.5 text-center font-bold text-[#243e52] transition hover:bg-slate-50"
      >
        Войти как администратор
      </Link>
      <p className="pt-1 text-center text-sm text-slate-500">
        Уже зарегистрированы?{" "}
        <Link href="/login" className="font-bold text-[#2d6f91]">
          Войти
        </Link>
      </p>
    </form>
  );
}
