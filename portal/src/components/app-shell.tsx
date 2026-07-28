import Link from "next/link";
import { logout } from "@/lib/auth";

export function AppShell({
  user,
  children,
}: {
  user: { fullName: string; role: string };
  children: React.ReactNode;
}) {
  async function logoutAction() {
    "use server";
    await logout();
  }

  return (
    <div className="min-h-screen">
      <header className="border-b border-white/10 bg-black text-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-5 px-5 py-4 lg:px-8">
          <Link href={user.role === "ADMIN" ? "/admin" : "/dashboard"}>
            <span>
              <span className="block text-sm font-semibold tracking-wide">
                Коммуникации, медиа и развлечения
              </span>
              <span className="block text-xs text-neutral-300">
                Экспертная группа
              </span>
            </span>
          </Link>
          <div className="flex items-center gap-4">
            <div className="hidden text-right sm:block">
              <p className="text-sm font-medium">{user.fullName}</p>
              <p className="text-xs text-neutral-300">
                {user.role === "ADMIN" ? "Администратор" : "Эксперт"}
              </p>
            </div>
            <form action={logoutAction}>
              <button className="rounded-lg border border-white/20 px-3 py-2 text-sm transition hover:bg-white/10">
                Выйти
              </button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-5 py-8 lg:px-8">{children}</main>
    </div>
  );
}
