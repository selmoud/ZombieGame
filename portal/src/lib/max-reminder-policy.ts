export const completedModulesMessage =
  "Благодарим Вас за вклад в развитие цифровой экономики и цифровых платформ. Ожидайте информацию в чатах рабочей группы.";

export function reminderProgress(statuses: Array<string | null>) {
  if (!statuses.length) return null;
  const accepted = statuses.filter((status) => status === "ACCEPTED").length;
  const current = statuses.find((status) => status !== "ACCEPTED");
  if (current === undefined || current === "SUBMITTED") return null;
  return { accepted, total: statuses.length };
}
