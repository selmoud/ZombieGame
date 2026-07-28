"use client";

import {
  createSubgroup,
  deleteSubgroup,
  renameSubgroup,
} from "@/app/admin/actions";

const messages: Record<string, string> = {
  created: "Подгруппа добавлена.",
  updated: "Название подгруппы сохранено.",
  deleted: "Подгруппа удалена.",
  duplicate: "Подгруппа с таким названием уже существует.",
  invalid: "Укажите название длиной до 80 символов.",
  "not-found": "Подгруппа не найдена.",
  "in-use":
    "Нельзя удалить подгруппу: в ней есть эксперты или ожидающие заявки.",
};

export function SubgroupManager({
  subgroups,
  status,
}: {
  subgroups: Array<{
    id: string;
    name: string;
    _count: { users: number; registrationRequests: number };
  }>;
  status?: string;
}) {
  const isError = ["duplicate", "invalid", "not-found", "in-use"].includes(
    status ?? "",
  );

  return (
    <section id="subgroups" className="paper mt-7 overflow-hidden rounded-2xl">
      <div className="border-b border-neutral-200 px-6 py-5">
        <h2 className="text-2xl font-bold text-black">Подгруппы</h2>
        <p className="mt-1 text-sm text-neutral-500">
          Этот список используется в регистрации и при добавлении эксперта.
        </p>
      </div>
      {status && messages[status] && (
        <p
          className={`border-b px-6 py-3 text-sm ${
            isError
              ? "border-[#FF9BC5] bg-[#FFE0ED] text-[#A9004A]"
              : "border-[#7EE0EC] bg-[#DDF8FB] text-[#00616C]"
          }`}
        >
          {messages[status]}
        </p>
      )}
      <div className="divide-y divide-neutral-100">
        {subgroups.map((subgroup) => (
          <div
            key={subgroup.id}
            className="flex flex-col gap-3 px-6 py-4 lg:flex-row lg:items-center"
          >
            <form
              action={renameSubgroup}
              className="flex flex-1 flex-col gap-3 sm:flex-row"
            >
              <input type="hidden" name="id" value={subgroup.id} />
              <input
                className="field"
                name="name"
                defaultValue={subgroup.name}
                maxLength={80}
                required
              />
              <button className="rounded-xl border border-neutral-300 px-4 py-2.5 text-sm font-bold text-black hover:bg-neutral-50">
                Сохранить
              </button>
            </form>
            <p className="text-xs text-neutral-500 lg:w-48">
              Экспертов: {subgroup._count.users}
              <br />
              Заявок: {subgroup._count.registrationRequests}
            </p>
            <form
              action={deleteSubgroup}
              onSubmit={(event) => {
                if (
                  !window.confirm(
                    `Удалить подгруппу «${subgroup.name}»?`,
                  )
                ) {
                  event.preventDefault();
                }
              }}
            >
              <input type="hidden" name="id" value={subgroup.id} />
              <button className="rounded-xl border border-[#FF9BC5] px-4 py-2.5 text-sm font-bold text-[#A9004A] hover:bg-[#FFE0ED]">
                Удалить
              </button>
            </form>
          </div>
        ))}
      </div>
      <form
        action={createSubgroup}
        className="flex flex-col gap-3 border-t border-neutral-200 bg-neutral-50 px-6 py-5 sm:flex-row"
      >
        <input
          className="field"
          name="name"
          placeholder="Название новой подгруппы"
          maxLength={80}
          required
        />
        <button className="rounded-xl bg-[#8125C8] px-5 py-3 font-bold text-white">
          Добавить подгруппу
        </button>
      </form>
    </section>
  );
}
