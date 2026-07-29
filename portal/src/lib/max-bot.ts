import type { Prisma } from "@/generated/prisma/client";
import { resolve4 } from "node:dns/promises";
import { request as httpsRequest } from "node:https";
import { db } from "@/lib/db";
export {
  createMaxLinkToken,
  hashMaxLinkToken,
  maxBotDeepLink,
  validMaxWebhookSecret,
} from "@/lib/max-bot-security";

const MAX_API_HOST = "platform-api2.max.ru";

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
  maxChatId: bigint,
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
  const addresses = await resolve4(MAX_API_HOST).catch(() => []);
  const candidates: Array<string | undefined> = addresses.length
    ? [...new Set(addresses)].slice(0, 3)
    : [undefined];
  let lastError: Error = new Error("MAX API request failed");
  for (let attempt = 0; attempt < candidates.length; attempt += 1) {
    const address = candidates[attempt];
    let status: number | undefined;
    try {
      status = await new Promise<number>((resolve, reject) => {
        const request = httpsRequest(
          {
            protocol: "https:",
            hostname: address ?? MAX_API_HOST,
            servername: MAX_API_HOST,
            port: 443,
            path: `/messages?chat_id=${maxChatId.toString()}`,
            method: "POST",
            headers: {
              Authorization: token,
              Host: MAX_API_HOST,
              "Content-Type": "application/json",
              "Content-Length": Buffer.byteLength(body),
            },
            timeout: 8_000,
          },
          (response) => {
            response.resume();
            response.on("end", () => resolve(response.statusCode ?? 0));
          },
        );
        request.on("timeout", () => {
          request.destroy(new Error("MAX API connection timed out"));
        });
        request.on("error", reject);
        request.end(body);
      });
    } catch (error) {
      lastError =
        error instanceof Error ? error : new Error("MAX API network error");
    }
    if (status && status >= 200 && status < 300) return;
    if (status) {
      lastError = new Error(`MAX API ${status}`);
      if (status < 500 && status !== 429) {
        throw lastError;
      }
    }
    if (attempt < candidates.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, (attempt + 1) * 500));
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
      await sendMaxMessage(notification.binding.maxChatId, notification);
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
