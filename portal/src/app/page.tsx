import { redirect } from "next/navigation";
import { RegistrationForm } from "@/components/registration-form";
import { getCurrentUser } from "@/lib/auth";

export default async function Home() {
  const user = await getCurrentUser();
  if (user) redirect(user.role === "ADMIN" ? "/admin" : "/dashboard");

  return (
    <main className="relative grid min-h-screen place-items-center overflow-hidden px-5 py-12">
      <div className="absolute left-[-8rem] top-[-10rem] size-96 rounded-full bg-[#2d6f91]/10 blur-3xl" />
      <section className="paper relative w-full max-w-5xl overflow-hidden rounded-3xl">
        <div className="grid lg:grid-cols-[1.15fr_0.85fr]">
          <div className="bg-[#18354a] px-8 py-12 text-white sm:px-12 sm:py-16">
            <span className="inline-flex rounded-full border border-white/20 px-3 py-1 text-xs uppercase tracking-[0.18em] text-emerald-100">
              Экспертная группа
            </span>
            <h1 className="mt-8 max-w-xl text-4xl leading-tight sm:text-5xl">
              Коммуникации, медиа и развлечения
            </h1>
            <p className="mt-6 max-w-lg text-lg leading-8 text-slate-300">
              Единое пространство для работы экспертов по развитию цифровых
              платформ Российской Федерации
            </p>
          </div>
          <div className="flex flex-col justify-center px-8 py-12 sm:px-12">
            <p className="text-sm font-semibold uppercase tracking-wider text-[#2d6f91]">
              Регистрация
            </p>
            <h2 className="mt-3 text-3xl text-[#243e52]">
              Подать заявку
            </h2>
            <p className="mt-4 leading-7 text-slate-600">
              Заполните данные. После согласования администратором вы сможете
              войти и приступить к работе.
            </p>
            <div className="mt-7">
              <RegistrationForm />
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
