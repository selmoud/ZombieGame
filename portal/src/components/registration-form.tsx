"use client";

import Link from "next/link";
import Image from "next/image";
import QRCode from "qrcode";
import { useActionState, useEffect, useState } from "react";
import {
  submitRegistration,
  type RegistrationState,
} from "@/app/public-actions";

const initialState: RegistrationState = {};

export function RegistrationForm({
  subgroups,
}: {
  subgroups: Array<{ id: string; name: string }>;
}) {
  const [state, action, pending] = useActionState(
    submitRegistration,
    initialState,
  );
  const [qrCode, setQrCode] = useState("");

  useEffect(() => {
    if (!state.maxBotLink) {
      return;
    }
    QRCode.toDataURL(state.maxBotLink, {
      width: 240,
      margin: 1,
      color: { dark: "#000000", light: "#FFFFFF" },
      errorCorrectionLevel: "M",
    }).then(setQrCode).catch(() => setQrCode(""));
  }, [state.maxBotLink]);

  if (state.success) {
    return (
      <div className="rounded-2xl border border-[#7EE0EC] bg-[#DDF8FB] p-6">
        <p className="text-lg font-bold text-[#004E57]">
          Заявка отправлена
        </p>
        <p className="mt-2 leading-7 text-[#00616C]">
          Администратор проверит данные.
        </p>
        {state.maxBotLink && (
          <div className="mt-5 rounded-xl bg-white p-4 text-center">
            <p className="font-semibold text-black">
              Подключите уведомления в MAX
            </p>
            <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-neutral-600">
              Бот сообщит о согласовании заявки и результатах проверки модулей.
            </p>
            {qrCode && (
              <Image
                src={qrCode}
                alt="QR-код для подключения бота в MAX"
                className="mx-auto mt-4 size-52"
                width={208}
                height={208}
                unoptimized
              />
            )}
            <a
              href={state.maxBotLink}
              target="_blank"
              rel="noreferrer"
              className="mt-4 inline-flex rounded-xl bg-[#0059C7] px-5 py-3 text-sm font-semibold text-white"
            >
              Открыть бота в MAX
            </a>
          </div>
        )}
      </div>
    );
  }

  return (
    <>
      <div>
        <p className="text-sm font-semibold uppercase tracking-wider text-[#8125C8]">
          Регистрация
        </p>
        <h2 className="mt-3 text-3xl font-bold text-black">Подать заявку</h2>
        <p className="mt-4 leading-7 text-neutral-600">
          Заполните данные. После согласования администратором вы сможете войти
          и приступить к работе.
        </p>
      </div>
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
          autoComplete="name"
          placeholder="Иванов Иван"
          required
        />
      </label>
      <label className="block">
        <span className="mb-1.5 block text-xs font-medium text-neutral-600">
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
      <fieldset>
        <legend className="text-xs font-medium text-neutral-600">
          Подгруппы
        </legend>
        <p className="mt-1 text-xs text-neutral-500">
          Можно выбрать несколько вариантов
        </p>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
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
      <label className="block">
        <span className="mb-1.5 block text-xs font-medium text-neutral-600">
          Придумайте пароль
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
        <span className="mb-1.5 block text-xs font-medium text-neutral-600">
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
        className="w-full rounded-xl bg-[#0059C7] px-5 py-3.5 font-bold text-white transition hover:bg-[#00479F] disabled:opacity-60"
      >
        {pending ? "Отправляем…" : "Отправить"}
      </button>
      <Link
        href="/login?role=admin"
        className="block rounded-xl border border-neutral-300 px-5 py-3.5 text-center font-bold text-[#000000] transition hover:bg-neutral-50"
      >
        Войти как администратор
      </Link>
      <p className="pt-1 text-center text-sm text-neutral-500">
        Уже зарегистрированы?{" "}
        <Link href="/login" className="font-bold text-[#0059C7]">
          Войти
        </Link>
      </p>
      </form>
    </>
  );
}
