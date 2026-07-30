export function completedAdminNotificationText(text: string) {
  return text.startsWith("✅ ") ? text : `✅ ${text}`;
}

export function maxAdminNotificationDedupeKey(input: {
  eventType: string;
  entityId: string;
  channelId: string;
  scope?: string | number;
}) {
  return [
    input.eventType,
    input.entityId,
    input.scope === undefined ? null : String(input.scope),
    input.channelId,
  ]
    .filter((part): part is string => Boolean(part))
    .join(":");
}
