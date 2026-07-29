"use client";

import {
  assignSubgroupLeader,
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
  "invalid-leader":
    "Руководителем можно назначить только активного участника этой подгруппы.",
  "leader-updated": "Руководитель подгруппы сохранён.",
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
    experts: number;
    requests: number;
    leaderId: string | null;
    members: Array<{ id: string; fullName: string }>;
  }>;
  status?: string;
}) {
  const isError = [
    "duplicate",
    "invalid",
    "not-found",
    "in-use",
    "invalid-leader",
  ].includes(status ?? "");

  return (
    <section id="subgroups" className="paper mt-7 overflow-hidden rounded-2xl">
      <div className="border-b border-neutral-200 px-6 py-5">
        <h2 className="text-2xl font-bold text-black">Подгруппы</h2>
        <p className="mt-1 text-sm text-neutral-500">
          Этот список используется при регистрации и добавлении эксперта.
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
          <div key={subgroup.id} className="grid gap-3 px-6 py-4 xl:grid-cols-[minmax(20rem,1fr)_minmax(18rem,0.8fr)_10rem_auto] xl:items-end">
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
              <button className="w-28 rounded-xl border border-neutral-300 px-4 py-2.5 text-sm font-semibold text-black hover:bg-neutral-50">
                Сохранить
              </button>
            </form>
            <form action={assignSubgroupLeader}>
              <input type="hidden" name="subgroupId" value={subgroup.id} />
              <label>
                <span className="mb-1.5 block text-xs font-medium text-neutral-500">
                  Руководитель подгруппы
                </span>
                <div className="flex gap-2">
                  <select
                    className="field min-w-0"
                    name="leaderId"
                    defaultValue={subgroup.leaderId ?? ""}
                  >
                    <option value="">Не назначен</option>
                    {subgroup.members.map((member) => (
                      <option key={member.id} value={member.id}>
                        {member.fullName}
                      </option>
                    ))}
                  </select>
                  <button className="rounded-xl border border-[#0059C7] px-3 py-2.5 text-sm font-semibold text-[#0059C7] hover:bg-[#E0EEFF]">
                    Назначить
                  </button>
                </div>
              </label>
            </form>
            <p className="pb-2 text-xs text-neutral-500">
              Экспертов: {subgroup.experts}
              <br />
              Заявок: {subgroup.requests}
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
              <button className="w-28 rounded-xl border border-[#FF9BC5] px-4 py-2.5 text-sm font-semibold text-[#A9004A] hover:bg-[#FFE0ED]">
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
