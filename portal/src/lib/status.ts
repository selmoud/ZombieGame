import type { SubmissionStatus } from "@/generated/prisma/enums";

export const statusLabels: Record<SubmissionStatus, string> = {
  NOT_STARTED: "Не начато",
  DRAFT: "Черновик",
  SUBMITTED: "На рассмотрении модератором",
  NEEDS_REVISION: "На доработке",
  ACCEPTED: "Принято",
};

export const statusStyles: Record<SubmissionStatus, string> = {
  NOT_STARTED: "bg-[#F4F4F4] text-neutral-600",
  DRAFT: "bg-[#F1E5FB] text-[#6815A8]",
  SUBMITTED: "bg-[#E0EEFF] text-[#0059C7]",
  NEEDS_REVISION: "bg-[#FFE0ED] text-[#C80058]",
  ACCEPTED: "bg-[#DDF8FB] text-[#00616C]",
};
