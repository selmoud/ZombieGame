export function completedAdminNotificationText(text: string) {
  return text.startsWith("✅ ") ? text : `✅ ${text}`;
}
