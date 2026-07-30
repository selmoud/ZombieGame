import type { Prisma } from "@/generated/prisma/client";
import { resolve4 } from "node:dns/promises";
import { request as httpsRequest } from "node:https";
import { db } from "@/lib/db";
import {
  completedAdminNotificationText,
  maxAdminNotificationDedupeKey,
} from "@/lib/max-admin-notification-policy";
export {
  createMaxLinkToken,
  hashMaxLinkToken,
  maxBotDeepLink,
  validMaxWebhookSecret,
} from "@/lib/max-bot-security";

const MAX_API_HOST = "platform-api2.max.ru";
const DELIVERY_LEASE_MS = 10 * 60 * 1000;

type NotificationClient = Pick<Prisma.TransactionClient, "maxNotification">;
type AdminNotificationClient = Pick<
  Prisma.TransactionClient,
  | "maxAdminChannel"
  | "maxAdminNotification"
  | "registrationRequest"
  | "submission"
>;
type MaxApiResponse = { status: number; body: string };

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

function adminRegistrationText(input: {
  fullName: string;
  companyName: string;
  subgroupNames: string[];
}) {
  return [
    "Новая заявка на вступление",
    "",
    `ФИО: ${input.fullName}`,
    `Организация: ${input.companyName}`,
    `Подгруппы: ${input.subgroupNames.join(", ") || "не указаны"}`,
  ].join("\n");
}

function adminSubmissionText(input: {
  fullName: string;
  moduleTitle: string;
}) {
  return [
    "Новый модуль на проверку",
    "",
    `Эксперт: ${input.fullName}`,
    `Модуль: ${input.moduleTitle}`,
  ].join("\n");
}

export async function queueMaxAdminNotification(
  client: AdminNotificationClient,
  input: {
    eventType: string;
    entityType: "REGISTRATION" | "SUBMISSION";
    entityId: string;
    dedupeScope?: string | number;
    text: string;
    linkUrl?: string;
    linkLabel?: string;
  },
) {
  const channels = await client.maxAdminChannel.findMany({
    where: { enabled: true },
    select: { id: true },
  });
  if (!channels.length) return { count: 0 };
  return client.maxAdminNotification.createMany({
    data: channels.map(({ id: channelId }) => ({
      channelId,
      eventType: input.eventType,
      entityType: input.entityType,
      entityId: input.entityId,
      dedupeKey: maxAdminNotificationDedupeKey({
        eventType: input.eventType,
        entityId: input.entityId,
        scope: input.dedupeScope,
        channelId,
      }),
      text: input.text,
      linkUrl: input.linkUrl,
      linkLabel: input.linkLabel,
    })),
    skipDuplicates: true,
  });
}

export async function resolveMaxAdminNotification(
  client: AdminNotificationClient,
  input: {
    entityType: "REGISTRATION" | "SUBMISSION";
    entityId: string;
  },
) {
  const where = {
    entityType: input.entityType,
    entityId: input.entityId,
  };
  const resolvedAt = new Date();
  const [unsent, inFlight, sent] = await Promise.all([
    client.maxAdminNotification.updateMany({
      where: { ...where, status: { in: ["PENDING", "FAILED"] } },
      data: { status: "RESOLVED", resolvedAt },
    }),
    client.maxAdminNotification.updateMany({
      where: { ...where, status: "SENDING" },
      data: { status: "RESOLVE_AFTER_SEND", resolvedAt },
    }),
    client.maxAdminNotification.updateMany({
      where: { ...where, status: "SENT" },
      data: {
        status: "RESOLUTION_PENDING",
        nextAttemptAt: resolvedAt,
        lastError: null,
      },
    }),
  ]);
  return {
    unsent: unsent.count,
    inFlight: inFlight.count,
    sent: sent.count,
  };
}

export async function registerMaxAdminChannel(
  client: AdminNotificationClient,
  maxChatId: bigint,
) {
  await client.maxAdminChannel.updateMany({
    where: { enabled: true, NOT: { maxChatId } },
    data: { enabled: false },
  });
  const channel = await client.maxAdminChannel.upsert({
    where: { maxChatId },
    update: { enabled: true },
    create: { maxChatId },
  });
  const [registrations, submissions] = await Promise.all([
    client.registrationRequest.findMany({
      where: { status: "PENDING" },
      include: {
        subgroupMemberships: { include: { subgroup: true } },
      },
    }),
    client.submission.findMany({
      where: { status: "SUBMITTED" },
      include: {
        assignment: { include: { module: true, user: true } },
      },
    }),
  ]);
  await client.maxAdminNotification.createMany({
    data: [
      ...registrations.map((request) => ({
        channelId: channel.id,
        eventType: "ADMIN_REGISTRATION_PENDING",
        entityType: "REGISTRATION",
        entityId: request.id,
        dedupeKey: maxAdminNotificationDedupeKey({
          eventType: "ADMIN_REGISTRATION_PENDING",
          entityId: request.id,
          channelId: channel.id,
        }),
        text: adminRegistrationText({
          fullName: request.fullName,
          companyName: request.companyName,
          subgroupNames: request.subgroupMemberships.map(
            ({ subgroup }) => subgroup.name,
          ),
        }),
        linkUrl: portalLink(`/admin#registration-${request.id}`),
        linkLabel: "Перейти к заявке",
      })),
      ...submissions.map((submission) => ({
        channelId: channel.id,
        eventType: "ADMIN_SUBMISSION_PENDING",
        entityType: "SUBMISSION",
        entityId: submission.id,
        dedupeKey: maxAdminNotificationDedupeKey({
          eventType: "ADMIN_SUBMISSION_PENDING",
          entityId: submission.id,
          scope: submission.revision,
          channelId: channel.id,
        }),
        text: adminSubmissionText({
          fullName: submission.assignment.user.fullName,
          moduleTitle: submission.assignment.module.title,
        }),
        linkUrl: portalLink(`/admin/submissions/${submission.id}`),
        linkLabel: "Перейти к заявке",
      })),
    ],
    skipDuplicates: true,
  });
  return channel;
}

export async function disableMaxAdminChannel(
  client: Pick<Prisma.TransactionClient, "maxAdminChannel">,
  maxChatId: bigint,
) {
  return client.maxAdminChannel.updateMany({
    where: { maxChatId },
    data: { enabled: false },
  });
}

export const maxAdminNotificationText = {
  registration: adminRegistrationText,
  submission: adminSubmissionText,
};

async function requestMaxApi(
  method: "POST" | "PUT",
  path: string,
  body: string,
) {
  const token = process.env.MAX_BOT_TOKEN;
  if (!token) throw new Error("MAX_BOT_TOKEN is not configured");
  const addresses = await resolve4(MAX_API_HOST).catch(() => []);
  const resolvedCandidates: Array<string | undefined> = addresses.length
    ? [...new Set(addresses)].slice(0, 3)
    : [undefined];
  // A fresh connection to the first address often succeeds after a transient
  // reset affecting the initial pass through the MAX edge nodes.
  const candidates = [...resolvedCandidates, resolvedCandidates[0]];
  let lastError: Error = new Error("MAX API request failed");
  for (let attempt = 0; attempt < candidates.length; attempt += 1) {
    const address = candidates[attempt];
    let result: MaxApiResponse | undefined;
    try {
      result = await new Promise<MaxApiResponse>((resolve, reject) => {
        const request = httpsRequest(
          {
            protocol: "https:",
            hostname: address ?? MAX_API_HOST,
            servername: MAX_API_HOST,
            port: 443,
            path,
            method,
            headers: {
              Authorization: token,
              Host: MAX_API_HOST,
              "Content-Type": "application/json",
              "Content-Length": Buffer.byteLength(body),
            },
            timeout: 6_000,
          },
          (response) => {
            const chunks: Buffer[] = [];
            response.on("data", (chunk: Buffer) => chunks.push(chunk));
            response.on("end", () =>
              resolve({
                status: response.statusCode ?? 0,
                body: Buffer.concat(chunks).toString("utf8"),
              }),
            );
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
    if (result && result.status >= 200 && result.status < 300) return result;
    if (result?.status) {
      lastError = new Error(`MAX API ${result.status}`);
      if (result.status < 500 && result.status !== 429) {
        throw lastError;
      }
    }
    if (attempt < candidates.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, (attempt + 1) * 500));
    }
  }
  throw lastError;
}

async function sendMaxMessage(
  maxChatId: bigint,
  notification: {
    text: string;
    linkUrl: string | null;
    linkLabel: string | null;
  },
) {
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
  const result = await requestMaxApi(
    "POST",
    `/messages?chat_id=${maxChatId.toString()}`,
    JSON.stringify({
      text: notification.text,
      format: "markdown",
      attachments,
      notify: true,
    }),
  );
  try {
    const payload = JSON.parse(result.body) as {
      message?: { body?: { mid?: unknown } };
    };
    return typeof payload.message?.body?.mid === "string"
      ? payload.message.body.mid
      : null;
  } catch {
    return null;
  }
}

async function hideMaxMessageButtons(messageId: string, text: string) {
  await requestMaxApi(
    "PUT",
    `/messages?message_id=${encodeURIComponent(messageId)}`,
    JSON.stringify({
      text,
      format: "markdown",
      attachments: [],
      notify: false,
    }),
  );
}

async function deliverPendingMaxAdminNotifications(limit = 20) {
  const pending = await db.maxAdminNotification.findMany({
    where: {
      status: {
        in: ["PENDING", "SENDING", "RESOLUTION_PENDING", "RESOLVING"],
      },
      nextAttemptAt: { lte: new Date() },
      channel: { enabled: true },
    },
    include: { channel: true },
    orderBy: { createdAt: "asc" },
    take: Math.max(1, Math.min(limit, 50)),
  });
  let sent = 0;
  let resolved = 0;
  let failed = 0;
  for (const notification of pending) {
    const resolving = ["RESOLUTION_PENDING", "RESOLVING"].includes(
      notification.status,
    );
    const claimed = await db.maxAdminNotification.updateMany({
      where: {
        id: notification.id,
        status: notification.status,
        nextAttemptAt: { lte: new Date() },
      },
      data: {
        status: resolving ? "RESOLVING" : "SENDING",
        nextAttemptAt: new Date(Date.now() + DELIVERY_LEASE_MS),
      },
    });
    if (!claimed.count) continue;
    try {
      if (resolving) {
        if (notification.maxMessageId) {
          await hideMaxMessageButtons(
            notification.maxMessageId,
            completedAdminNotificationText(notification.text),
          );
        }
        await db.maxAdminNotification.update({
          where: { id: notification.id },
          data: {
            status: "RESOLVED",
            resolvedAt: new Date(),
            attempts: { increment: 1 },
            lastError: null,
          },
        });
        resolved += 1;
        continue;
      }
      const maxMessageId = await sendMaxMessage(
        notification.channel.maxChatId,
        notification,
      );
      const delivered = await db.maxAdminNotification.updateMany({
        where: { id: notification.id, status: "SENDING" },
        data: {
          status: "SENT",
          attempts: { increment: 1 },
          sentAt: new Date(),
          lastError: null,
          maxMessageId,
        },
      });
      if (!delivered.count) {
        await db.maxAdminNotification.updateMany({
          where: { id: notification.id, status: "RESOLVE_AFTER_SEND" },
          data: {
            status: "RESOLUTION_PENDING",
            attempts: { increment: 1 },
            sentAt: new Date(),
            nextAttemptAt: new Date(),
            lastError: null,
            maxMessageId,
          },
        });
      }
      sent += 1;
    } catch (error) {
      const attempts = notification.attempts + 1;
      const terminal = attempts >= 8;
      const delayMinutes = Math.min(2 ** attempts, 60);
      const current = await db.maxAdminNotification.findUnique({
        where: { id: notification.id },
        select: { status: true },
      });
      if (current?.status === "RESOLVE_AFTER_SEND") {
        await db.maxAdminNotification.update({
          where: { id: notification.id },
          data: {
            status: "RESOLVED",
            resolvedAt: new Date(),
            attempts,
            lastError: null,
          },
        });
        resolved += 1;
        continue;
      }
      await db.maxAdminNotification.update({
        where: { id: notification.id },
        data: {
          status: terminal
            ? "FAILED"
            : resolving
              ? "RESOLUTION_PENDING"
              : "PENDING",
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
  return { sent, resolved, failed };
}

export async function deliverPendingMaxNotifications(limit = 20) {
  if (!process.env.MAX_BOT_TOKEN) return { sent: 0, failed: 0 };
  const pending = await db.maxNotification.findMany({
    where: {
      status: { in: ["PENDING", "SENDING"] },
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
    const claimed = await db.maxNotification.updateMany({
      where: {
        id: notification.id,
        status: notification.status,
        nextAttemptAt: { lte: new Date() },
      },
      data: {
        status: "SENDING",
        nextAttemptAt: new Date(Date.now() + DELIVERY_LEASE_MS),
      },
    });
    if (!claimed.count) continue;
    handledBindings.add(notification.bindingId);
    try {
      const maxMessageId = await sendMaxMessage(
        notification.binding.maxChatId,
        notification,
      );
      await db.maxNotification.update({
        where: { id: notification.id },
        data: {
          status: "SENT",
          attempts: { increment: 1 },
          sentAt: new Date(),
          lastError: null,
          maxMessageId,
        },
      });
      const previousWithButtons = await db.maxNotification.findFirst({
        where: {
          bindingId: notification.bindingId,
          id: { not: notification.id },
          status: "SENT",
          linkUrl: { not: null },
          NOT: { linkLabel: "Войти на портал" },
          maxMessageId: { not: null },
          buttonsHiddenAt: null,
        },
        orderBy: { sentAt: "desc" },
      });
      if (previousWithButtons?.maxMessageId) {
        try {
          await hideMaxMessageButtons(
            previousWithButtons.maxMessageId,
            previousWithButtons.text,
          );
          await db.maxNotification.update({
            where: { id: previousWithButtons.id },
            data: { buttonsHiddenAt: new Date() },
          });
        } catch (error) {
          console.error(
            "Failed to hide buttons on an older MAX message",
            error,
          );
        }
      }
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
  const admin = await deliverPendingMaxAdminNotifications(limit);
  return { sent, failed, admin };
}

export function portalLink(path = "/dashboard") {
  const base = process.env.APP_URL?.replace(/\/$/, "");
  return base ? `${base}${path}` : undefined;
}
