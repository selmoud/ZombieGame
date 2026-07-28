import Link from "next/link";
import { logout } from "@/lib/auth";

export function AppShell({
  user,
  children,
  mode,
}: {
  user: {
    fullName: string;
    role: string;
    ledSubgroups?: Array<{ id: string; name: string }>;
  };
  children: React.ReactNode;
  mode?: "expert" | "lead" | "admin";
}) {
  async function logoutAction() {
    "use server";
    await logout();
  }

  const currentMode =
    mode ?? (user.role === "ADMIN" ? "admin" : "expert");
  const hasLeaderMode = Boolean(user.ledSubgroups?.length);
  const homeHref =
    currentMode === "admin"
      ? "/admin"
      : currentMode === "lead"
        ? "/lead"
        : "/dashboard";

  return (
    <div className="min-h-screen">
      <header className="border-b border-white/10 bg-black text-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-5 px-5 py-4 lg:px-8">
          <Link href={homeHref}>
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
            {user.role !== "ADMIN" && hasLeaderMode && (
              <nav className="flex rounded-xl border border-white/20 p-1">
                <Link
                  href="/dashboard"
                  className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${
                    currentMode === "expert"
                      ? "bg-white text-black"
                      : "text-white hover:bg-white/10"
                  }`}
                >
                  Эксперт
                </Link>
                <Link
                  href="/lead"
                  className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${
                    currentMode === "lead"
                      ? "bg-white text-black"
                      : "text-white hover:bg-white/10"
                  }`}
                >
                  Руководитель
                </Link>
              </nav>
            )}
            <div className="hidden text-right sm:block">
              <p className="text-sm font-medium">{user.fullName}</p>
              <p className="text-xs text-neutral-300">
                {currentMode === "admin"
                  ? "Администратор"
                  : currentMode === "lead"
                    ? "Руководитель подгруппы"
                    : "Эксперт"}
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
