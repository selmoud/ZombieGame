import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";

export default async function Home() {
  const user = await getCurrentUser();
  if (user) redirect(user.role === "ADMIN" ? "/admin" : "/dashboard");

  return (
    <main className="relative grid min-h-screen place-items-center overflow-hidden px-5 py-12">
      <div className="absolute left-[-8rem] top-[-10rem] size-96 rounded-full bg-[#16877c]/10 blur-3xl" />
      <section className="paper relative w-full max-w-5xl overflow-hidden rounded-3xl">
        <div className="grid lg:grid-cols-[1.15fr_0.85fr]">
          <div className="bg-[#173b4b] px-8 py-12 text-white sm:px-12 sm:py-16">
            <span className="inline-flex rounded-full border border-white/20 px-3 py-1 text-xs uppercase tracking-[0.18em] text-emerald-100">
              Рабочая группа
            </span>
            <h1 className="mt-8 max-w-xl text-4xl leading-tight sm:text-5xl">
              Стратегия развития цифровых платформ
            </h1>
            <p className="mt-6 max-w-lg text-lg leading-8 text-slate-300">
              Единое пространство для экспертных позиций в коммуникациях,
              медиа и развлечениях с горизонтом до 2036 года.
            </p>
            <div className="mt-10 grid gap-4 text-sm text-slate-200 sm:grid-cols-3">
              {["8 разделов", "Черновики", "Единый итог"].map((label, index) => (
                <div key={label} className="border-l border-[#35aa9f] pl-3">
                  <span className="block text-xl font-semibold text-white">
                    {index === 0 ? "01" : `0${index + 1}`}
                  </span>
                  {label}
                </div>
              ))}
            </div>
          </div>
          <div className="flex flex-col justify-center px-8 py-12 sm:px-12">
            <p className="text-sm font-semibold uppercase tracking-wider text-[#16877c]">
              Вход на портал
            </p>
            <h2 className="mt-3 text-3xl text-[#183a4a]">
              Используйте персональную ссылку
            </h2>
            <p className="mt-4 leading-7 text-slate-600">
              Регистрация и пароль не нужны. Откройте ссылку из приглашения
              рабочей группы.
            </p>
            <div className="mt-8 rounded-xl bg-[#f0eadc] p-4 text-sm text-slate-700">
              Для демонстрации доступны две тестовые роли.
            </div>
            <div className="mt-5 grid gap-3">
              <Link
                href="/invite/demo-expert"
                className="rounded-xl bg-[#16877c] px-5 py-3.5 text-center font-semibold text-white transition hover:bg-[#0e655e]"
              >
                Войти как эксперт
              </Link>
              <Link
                href="/invite/demo-admin"
                className="rounded-xl border border-slate-300 px-5 py-3.5 text-center font-semibold text-[#183a4a] transition hover:bg-slate-50"
              >
                Войти как администратор
              </Link>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
