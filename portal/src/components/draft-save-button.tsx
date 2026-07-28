"use client";

export function DraftSaveButton({ targetId }: { targetId: string }) {
  return (
    <button
      type="button"
      onClick={() => document.getElementById(targetId)?.click()}
      className="w-full rounded-xl bg-[#0059C7] px-5 py-3.5 font-bold text-white transition hover:bg-[#00479F]"
    >
      Сохранить черновик
    </button>
  );
}
