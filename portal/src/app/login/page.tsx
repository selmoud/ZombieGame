import Link from "next/link";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/login-form";
import { getCurrentUser } from "@/lib/auth";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await getCurrentUser();
  if (user) redirect(user.role === "ADMIN" ? "/admin" : "/dashboard");
  const query = await searchParams;
  const admin = query.role === "admin";

  return (
    <main className="grid min-h-screen place-items-center px-5 py-12">
      <section className="paper w-full max-w-md rounded-3xl p-8 sm:p-10">
        <Link href="/" className="text-sm font-bold text-[#0059C7]">
          ← На стартовую страницу
        </Link>
        <p className="mt-8 text-sm font-bold uppercase tracking-wider text-[#0059C7]">
          {admin ? "Администратор" : "Эксперт"}
        </p>
        <h1 className="mt-2 text-3xl font-bold text-[#000000]">
          Вход на портал
        </h1>
        <p className="mt-3 leading-7 text-neutral-600">
          Введите имя и пароль, указанные при регистрации.
        </p>
        <LoginForm />
      </section>
    </main>
  );
}
