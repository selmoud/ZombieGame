"use client";

import { useEffect, useState } from "react";

type DraftState = {
  revision: number;
  saveState: "saved" | "saving" | "dirty" | "error";
  status: string;
};

export function DraftSaveButton({
  targetId,
  assignmentId,
  initialRevision,
}: {
  targetId: string;
  assignmentId: string;
  initialRevision: number;
}) {
  const [draftState, setDraftState] = useState<DraftState>({
    revision: initialRevision,
    saveState: "saved",
    status: "DRAFT",
  });

  useEffect(() => {
    function updateDraftState(event: Event) {
      const detail = (event as CustomEvent<DraftState & { assignmentId: string }>)
        .detail;
      if (detail.assignmentId === assignmentId) {
        setDraftState(detail);
      }
    }

    window.addEventListener("draft-state-change", updateDraftState);
    return () =>
      window.removeEventListener("draft-state-change", updateDraftState);
  }, [assignmentId]);

  const readOnly = !["NOT_STARTED", "DRAFT", "NEEDS_REVISION"].includes(
    draftState.status,
  );
  const isDirty = draftState.saveState === "dirty";
  const stateLabel = readOnly
    ? draftState.status === "ACCEPTED"
      ? "Ответ принят"
      : "Ответ отправлен"
    : draftState.saveState === "saving"
      ? "Сохраняем…"
      : isDirty
        ? "Есть изменения"
        : draftState.saveState === "error"
          ? "Ошибка сохранения"
          : "Все изменения сохранены";

  return (
    <div className="space-y-3">
      <section
        className={`rounded-xl border bg-white px-4 py-3 transition ${
          isDirty
            ? "border-[#FF2F86] shadow-[0_0_0_3px_rgba(255,47,134,0.10)]"
            : "border-[#0D78F8]"
        }`}
      >
        <p
          className={`text-xs font-semibold uppercase tracking-wider ${
            isDirty ? "text-[#FF2F86]" : "text-[#0D78F8]"
          }`}
        >
          Состояние черновика
        </p>
        <p
          className={`mt-0.5 text-sm font-semibold ${
            isDirty ? "text-[#FF2F86]" : "text-[#0059C7]"
          }`}
        >
          {stateLabel}
          <span
            className={`ml-2 text-xs font-normal ${
              isDirty ? "text-[#FF2F86]" : "text-[#0D78F8]"
            }`}
          >
            версия {draftState.revision}
          </span>
        </p>
      </section>
      {!readOnly && (
        <button
          type="button"
          onClick={() => document.getElementById(targetId)?.click()}
          className="w-full rounded-xl bg-[#0059C7] px-5 py-3.5 font-bold text-white transition hover:bg-[#00479F]"
        >
          Сохранить черновик
        </button>
      )}
    </div>
  );
}
