import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
export {
  createMaxLinkToken,
  hashMaxLinkToken,
  maxBotDeepLink,
  validMaxWebhookSecret,
} from "@/lib/max-bot-security";

const MAX_API_BASE = "https://platform-api2.max.ru";

type NotificationClient = Pick<Prisma.TransactionClient, "maxNotification">;

export async function queueMaxNotification(
  client: NotificationClient,
  input: {
    bindingId: string;
    eventType: string;
    dedupeKey: string;
    text: string;
    linkUrl?: string;
    linkLabel?: string;
  },
) {
  return client.maxNotification.upsert({
    where: { dedupeKey: input.dedupeKey },
    update: {},
    create: input,
  });
}

async function sendMaxMessage(
  maxUserId: bigint,
  notification: {
    text: string;
    linkUrl: string | null;
    linkLabel: string | null;
  },
) {
  const token = process.env.MAX_BOT_TOKEN;
  if (!token) throw new Error("MAX_BOT_TOKEN is not configured");
  const attachments =
    notification.linkUrl && notification.linkLabel
      ? [
          {
            type: "inline_keyboard",
            payload: {
              buttons: [
                [
                  {
                    type: "link",
                    text: notification.linkLabel,
                    url: notification.linkUrl,
                  },
                ],
              ],
            },
          },
        ]
      : undefined;
  const body = JSON.stringify({
    text: notification.text,
    format: "markdown",
    attachments,
    notify: true,
  });
  let lastError: Error = new Error("MAX API request failed");
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    let response: Response | undefined;
    try {
      response = await fetch(
        `${MAX_API_BASE}/messages?user_id=${maxUserId.toString()}`,
        {
          method: "POST",
          headers: {
            Authorization: token,
            "Content-Type": "application/json",
          },
          body,
          signal: AbortSignal.timeout(8_000),
        },
      );
    } catch (error) {
      lastError =
        error instanceof Error ? error : new Error("MAX API network error");
    }
    if (response?.ok) return;
    if (response) {
      lastError = new Error(`MAX API ${response.status}`);
      if (response.status < 500 && response.status !== 429) {
        throw lastError;
      }
    }
    if (attempt < 3) {
      await new Promise((resolve) => setTimeout(resolve, attempt * 500));
    }
  }
  throw lastError;
}

export async function deliverPendingMaxNotifications(limit = 20) {
  if (!process.env.MAX_BOT_TOKEN) return { sent: 0, failed: 0 };
  const pending = await db.maxNotification.findMany({
    where: {
      status: "PENDING",
      nextAttemptAt: { lte: new Date() },
      binding: { enabled: true },
    },
    include: { binding: true },
    orderBy: { createdAt: "asc" },
    take: Math.max(1, Math.min(limit, 50)),
  });
  let sent = 0;
  let failed = 0;
  const handledBindings = new Set<string>();
  for (const notification of pending) {
    if (handledBindings.has(notification.bindingId)) continue;
    handledBindings.add(notification.bindingId);
    try {
      await sendMaxMessage(notification.binding.maxUserId, notification);
      await db.maxNotification.update({
        where: { id: notification.id },
        data: {
          status: "SENT",
          attempts: { increment: 1 },
          sentAt: new Date(),
          lastError: null,
        },
      });
      sent += 1;
    } catch (error) {
      const attempts = notification.attempts + 1;
      const terminal = attempts >= 8;
      const delayMinutes = Math.min(2 ** attempts, 60);
      await db.maxNotification.update({
        where: { id: notification.id },
        data: {
          status: terminal ? "FAILED" : "PENDING",
          attempts,
          nextAttemptAt: new Date(Date.now() + delayMinutes * 60_000),
          lastError:
            error instanceof Error
              ? error.message.slice(0, 500)
              : "Unknown MAX API error",
        },
      });
      failed += 1;
    }
  }
  return { sent, failed };
}

export function portalLink(path = "/dashboard") {
  const base = process.env.APP_URL?.replace(/\/$/, "");
  return base ? `${base}${path}` : undefined;
}
