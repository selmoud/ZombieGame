import type { SubmissionStatus } from "@/generated/prisma/enums";

export const statusLabels: Record<SubmissionStatus, string> = {
  NOT_STARTED: "Не начато",
  DRAFT: "Черновик",
  SUBMITTED: "Отправлено",
  NEEDS_REVISION: "На доработке",
  ACCEPTED: "Принято",
};

export const statusStyles: Record<SubmissionStatus, string> = {
  NOT_STARTED: "bg-slate-100 text-slate-600",
  DRAFT: "bg-amber-50 text-amber-700",
  SUBMITTED: "bg-blue-50 text-blue-700",
  NEEDS_REVISION: "bg-rose-50 text-rose-700",
  ACCEPTED: "bg-emerald-50 text-emerald-700",
};
