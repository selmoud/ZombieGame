import { after } from "next/server";
import { randomUUID } from "node:crypto";
import { db } from "@/lib/db";
import {
  deliverPendingMaxNotifications,
  hashMaxLinkToken,
  portalLink,
  queueMaxNotification,
  validMaxWebhookSecret,
} from "@/lib/max-bot";
import { readLimitedJson } from "@/lib/request-security";

export const runtime = "nodejs";

const pendingRegistrationGreeting =
  'Добрый день! Ваша заявка на регистрацию на портале экспертной группы «Коммуникации, медиа и развлечения» принята и находится на рассмотрении. Пожалуйста, дождитесь уведомления о результате проверки.\n\nДанный бот будет присылать уведомления о статусе рассмотрения ваших заявок на портале и информировать о статусе прохождения экспертных модулей. Также он будет направлять сообщения-напоминания по понедельникам и четвергам.';

type MaxUpdate = {
  update_type?: string;
  timestamp?: number;
  payload?: string | null;
  chat_id?: number | string;
  user?: { user_id?: number | string; is_bot?: boolean };
  message?: {
    body?: { text?: string };
    sender?: { user_id?: number | string; is_bot?: boolean };
  };
};

function maxId(value: unknown) {
  if (
    (typeof value === "number" && Number.isSafeInteger(value)) ||
    (typeof value === "string" && /^\d{1,19}$/.test(value))
  ) {
    return BigInt(value);
  }
  return null;
}

async function handleBotStarted(update: MaxUpdate) {
  const payload = typeof update.payload === "string" ? update.payload : "";
  const userId = maxId(update.user?.user_id);
  const chatId = maxId(update.chat_id);
  if (!userId || !chatId) return;

  const existing = await db.maxBotBinding.findUnique({
    where: { maxUserId: userId },
    include: { registrationRequest: true },
  });
  if (existing) {
    await db.$transaction(async (tx) => {
      await tx.maxBotBinding.update({
        where: { id: existing.id },
        data: { enabled: true, maxChatId: chatId },
      });
      await tx.maxNotification.deleteMany({
        where: { bindingId: existing.id, status: "PENDING" },
      });
      const request = existing.registrationRequest;
      if (request) {
        const accessGranted =
          request.status === "APPROVED" && Boolean(request.approvedUserId);
        const rejected = request.status === "REJECTED";
        await queueMaxNotification(tx, {
          bindingId: existing.id,
          eventType: "BOT_RESTARTED",
          dedupeKey: `bot-restarted:${existing.id}:${update.timestamp ?? "unknown"}`,
          text: accessGranted
            ? "Добрый день! Доступ к порталу открыт. Вы можете войти с указанными при регистрации ФИО и паролем."
            : rejected
              ? "Добрый день! Заявка не согласована. Для уточнения или исправления данных обратитесь к администратору рабочей группы."
              : pendingRegistrationGreeting,
          linkUrl: accessGranted ? portalLink("/login") : undefined,
          linkLabel: accessGranted ? "Войти на портал" : undefined,
        });
      }
    });
    if (!existing.registrationRequest) {
      await queueStatus(userId);
    }
    return;
  }

  if (!payload || payload.length > 128) return;

  const token = await db.maxLinkToken.findFirst({
    where: {
      tokenHash: hashMaxLinkToken(payload),
      usedAt: null,
      expiresAt: { gt: new Date() },
    },
    include: {
      registrationRequest: true,
    },
  });
  if (!token) return;

  await db.$transaction(async (tx) => {
    const request = token.registrationRequest;
    const binding = await tx.maxBotBinding.create({
      data: {
        maxUserId: userId,
        maxChatId: chatId,
        ...(request.status === "APPROVED" && request.approvedUserId
          ? { userId: request.approvedUserId }
          : { registrationRequestId: request.id }),
      },
    });
    await tx.maxLinkToken.update({
      where: { id: token.id },
      data: { usedAt: new Date() },
    });
    const accessGranted =
      request.status === "APPROVED" && Boolean(request.approvedUserId);
    const rejected = request.status === "REJECTED";
    await queueMaxNotification(tx, {
      bindingId: binding.id,
      eventType: accessGranted
        ? "ACCESS_GRANTED"
        : rejected
          ? "REGISTRATION_REJECTED"
          : "REGISTRATION_LINKED",
      dedupeKey: `max-link:${token.id}`,
      text: accessGranted
          ? "Доступ к порталу открыт. Вы можете войти с указанными при регистрации ФИО и паролем."
          : rejected
            ? "Заявка не согласована. Для уточнения или исправления данных обратитесь к администратору рабочей группы."
          : pendingRegistrationGreeting,
      linkUrl: accessGranted ? portalLink("/login") : undefined,
      linkLabel: accessGranted ? "Войти на портал" : undefined,
    });
  });
}

async function queueStatus(maxUserId: bigint) {
  const binding = await db.maxBotBinding.findUnique({
    where: { maxUserId },
    include: {
      registrationRequest: true,
      user: {
        include: {
          assignments: {
            include: { submission: true },
          },
        },
      },
    },
  });
  if (!binding || !binding.enabled) return;
  let text = "Бот не связан с активной заявкой.";
  let linkUrl: string | undefined;
  if (binding.registrationRequest) {
    text =
      binding.registrationRequest.status === "REJECTED"
        ? "Заявка не согласована. Для уточнения данных обратитесь к администратору рабочей группы."
        : "Заявка ожидает проверки администратором.";
  } else if (binding.user) {
    const assignments = binding.user.assignments;
    const accepted = assignments.filter(
      (item) => item.submission?.status === "ACCEPTED",
    ).length;
    const review = assignments.filter(
      (item) => item.submission?.status === "SUBMITTED",
    ).length;
    const revision = assignments.filter(
      (item) => item.submission?.status === "NEEDS_REVISION",
    ).length;
    text = `Доступ открыт.\nПринято модулей: **${accepted} из ${assignments.length}**.${review ? `\nНа рассмотрении: ${review}.` : ""}${revision ? `\nТребуют доработки: ${revision}.` : ""}`;
    linkUrl = portalLink("/dashboard");
  }
  await queueMaxNotification(db, {
    bindingId: binding.id,
    eventType: "STATUS_REQUESTED",
    dedupeKey: `status:${binding.id}:${randomUUID()}`,
    text,
    linkUrl,
    linkLabel: linkUrl ? "Открыть портал" : undefined,
  });
}

async function handleMessage(update: MaxUpdate) {
  if (update.message?.sender?.is_bot) return;
  const userId = maxId(
    update.message?.sender?.user_id ?? update.user?.user_id,
  );
  if (!userId) return;
  const text = update.message?.body?.text?.trim().toLowerCase() ?? "";
  if (text === "/status" || text === "статус") {
    await queueStatus(userId);
  } else if (text === "/start" || text === "/help" || text === "помощь") {
    const binding = await db.maxBotBinding.findUnique({
      where: { maxUserId: userId },
    });
    if (!binding?.enabled) return;
    await queueMaxNotification(db, {
      bindingId: binding.id,
      eventType: "HELP_REQUESTED",
      dedupeKey: `help:${binding.id}:${randomUUID()}`,
      text: "Я сообщаю о согласовании заявки и результатах проверки экспертных модулей.\n\n/status — проверить текущий статус\n/help — показать эту справку",
      linkUrl: portalLink("/dashboard"),
      linkLabel: "Открыть портал",
    });
  }
}

export async function POST(request: Request) {
  if (
    !validMaxWebhookSecret(
      request.headers.get("x-max-bot-api-secret"),
    )
  ) {
    return Response.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }
  const parsed = await readLimitedJson<MaxUpdate>(request, 64 * 1024);
  if (!parsed.ok) {
    return Response.json({ error: parsed.error }, { status: 400 });
  }
  const update = parsed.value;
  try {
    if (update.update_type === "bot_started") {
      await handleBotStarted(update);
    } else if (update.update_type === "bot_stopped") {
      const userId = maxId(update.user?.user_id);
      if (userId) {
        await db.maxBotBinding.updateMany({
          where: { maxUserId: userId },
          data: { enabled: false },
        });
      }
    } else if (update.update_type === "message_created") {
      await handleMessage(update);
    }
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "P2002"
    ) {
      return Response.json({ success: true });
    }
    console.error("MAX webhook processing failed");
    return Response.json({ error: "PROCESSING_FAILED" }, { status: 500 });
  }
  after(() => deliverPendingMaxNotifications(10));
  return Response.json({ success: true });
}
