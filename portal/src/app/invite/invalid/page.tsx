import Link from "next/link";

export default function InvalidInvitationPage() {
  return (
    <main className="grid min-h-screen place-items-center px-5">
      <section className="paper w-full max-w-lg rounded-3xl p-10 text-center">
        <p className="text-5xl">↗</p>
        <h1 className="mt-5 font-serif text-3xl text-[#183a4a]">
          Ссылка больше не действует
        </h1>
        <p className="mt-4 leading-7 text-slate-600">
          Возможно, приглашение уже было использовано или отозвано. Запросите
          новую ссылку у администратора рабочей группы.
        </p>
        <Link
          href="/"
          className="mt-7 inline-block rounded-xl border border-slate-300 px-5 py-3 font-semibold text-[#183a4a]"
        >
          На главную
        </Link>
      </section>
    </main>
  );
}
