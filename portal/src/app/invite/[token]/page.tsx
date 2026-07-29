import { acceptInvitation } from "./actions";

export default async function InvitationPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  return (
    <main className="grid min-h-screen place-items-center px-5">
      <section className="paper w-full max-w-lg rounded-3xl p-8 text-center sm:p-12">
        <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-[#0059C7] text-2xl font-bold text-white">
          36
        </span>
        <p className="mt-7 text-sm font-semibold uppercase tracking-wider text-[#0059C7]">
          Персональное приглашение
        </p>
        <h1 className="mt-3 text-3xl text-[#000000]">
          Добро пожаловать в рабочую группу
        </h1>
        <p className="mt-4 leading-7 text-neutral-600">
          После подтверждения откроется ваш личный кабинет. Повторная
          регистрация не потребуется, вводить пароль также не нужно.
        </p>
        <form action={acceptInvitation} className="mt-8">
          <input type="hidden" name="token" value={token} />
          <button className="w-full rounded-xl bg-[#0059C7] px-5 py-3.5 font-semibold text-white transition hover:bg-[#00479F]">
            Открыть личный кабинет
          </button>
        </form>
        <p className="mt-5 text-xs leading-5 text-neutral-500">
          Ссылка одноразовая и предназначена только для вас.
        </p>
      </section>
    </main>
  );
}
