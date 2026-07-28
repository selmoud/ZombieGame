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
      <header className="border-b border-white/10 bg-[#173b4b] text-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-5 px-5 py-4 lg:px-8">
          <Link href={user.role === "ADMIN" ? "/admin" : "/dashboard"} className="flex items-center gap-3">
            <span className="grid size-10 place-items-center rounded-xl bg-[#16877c] font-serif text-xl font-bold">
              36
            </span>
            <span>
              <span className="block text-sm font-semibold tracking-wide">
                Стратегия платформ
              </span>
              <span className="block text-xs text-slate-300">
                Экспертная группа · 2036
              </span>
            </span>
          </Link>
          <div className="flex items-center gap-4">
            <div className="hidden text-right sm:block">
              <p className="text-sm font-medium">{user.fullName}</p>
              <p className="text-xs text-slate-300">
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
