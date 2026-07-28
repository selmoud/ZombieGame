"use client";

import { useEffect, useState } from "react";

type DraftState = {
  saveState: "saved" | "saving" | "dirty" | "error";
  saveError?: string;
  status: string;
};

export function DraftStatus({
  assignmentId,
  initialStatus,
}: {
  assignmentId: string;
  initialStatus: string;
}) {
  const [draftState, setDraftState] = useState<DraftState>({
    saveState: "saved",
    status: initialStatus,
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
  const hasError = draftState.saveState === "error";
  const isHighlighted = isDirty || hasError;
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
          : "Изменения сохранены";

  return (
    <section
      className={`rounded-xl border bg-white px-4 py-3 transition ${
        isHighlighted
          ? "border-[#FF2F86] shadow-[0_0_0_3px_rgba(255,47,134,0.10)]"
          : "border-[#0D78F8]"
      }`}
    >
      <p
        className={`text-xs font-semibold uppercase tracking-wider ${
          isHighlighted ? "text-[#FF2F86]" : "text-[#0D78F8]"
        }`}
      >
        Статус
      </p>
      <p
        className={`mt-0.5 text-sm font-semibold ${
          isHighlighted ? "text-[#FF2F86]" : "text-[#0059C7]"
        }`}
      >
        {stateLabel}
      </p>
      {hasError && draftState.saveError && (
        <p className="mt-2 text-xs leading-5 text-[#A9004A]">
          {draftState.saveError}
        </p>
      )}
    </section>
  );
}
