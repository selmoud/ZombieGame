import { redirect } from "next/navigation";
import { RegistrationForm } from "@/components/registration-form";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";

export default async function Home() {
  const user = await getCurrentUser();
  if (user) redirect(user.role === "ADMIN" ? "/admin" : "/dashboard");
  const subgroups = await db.subgroup.findMany({
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  return (
    <main className="relative grid min-h-screen place-items-center overflow-hidden px-5 py-12">
      <div className="absolute left-[-8rem] top-[-10rem] size-96 rounded-full bg-[#8125C8]/15 blur-3xl" />
      <section className="paper relative w-full max-w-5xl overflow-hidden rounded-3xl">
        <div className="grid lg:grid-cols-[1.15fr_0.85fr]">
          <div className="relative overflow-hidden bg-[#0D78F8] px-8 py-12 text-white sm:px-12">
            <div className="absolute -bottom-24 -right-24 size-72 rounded-full bg-[#8125C8]/30" />
            <span className="relative inline-flex rounded-full bg-white px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-black">
              Экспертная группа
            </span>
            <h1 className="relative mt-8 max-w-xl text-4xl font-bold leading-tight sm:text-5xl">
              Коммуникации, медиа и развлечения
            </h1>
            <p className="relative mt-6 max-w-lg text-lg leading-8 text-white/90">
              Единое пространство для работы экспертов по развитию цифровых
              платформ Российской Федерации
            </p>
          </div>
          <div className="flex flex-col px-8 py-12 sm:px-12">
            <RegistrationForm subgroups={subgroups} />
          </div>
        </div>
      </section>
    </main>
  );
}
