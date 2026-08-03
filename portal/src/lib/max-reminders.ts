import { db } from "@/lib/db";
import { queueMaxNotification, portalLink } from "@/lib/max-bot";
import {
  completedModulesMessage,
  reminderProgress,
} from "@/lib/max-reminder-policy";

function moscowDateKey(date: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Moscow",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const value = Object.fromEntries(
    parts.map((part) => [part.type, part.value]),
  );
  return `${value.year}-${value.month}-${value.day}`;
}

export async function queueScheduledMaxReminders(now = new Date()) {
  const users = await db.user.findMany({
    where: {
      isActive: true,
      role: { notIn: ["ADMIN", "SUPERVISOR"] },
      maxBotBinding: { is: { enabled: true } },
    },
    select: {
      id: true,
      maxBotBinding: { select: { id: true } },
      assignments: {
        where: { module: { isActive: true } },
        orderBy: { module: { order: "asc" } },
        select: { submission: { select: { status: true } } },
      },
    },
  });
  const dateKey = moscowDateKey(now);
  let queued = 0;
  let skipped = 0;

  for (const user of users) {
    const statuses = user.assignments.map(
      (assignment) => assignment.submission?.status ?? null,
    );
    const bindingId = user.maxBotBinding?.id;
    if (!bindingId || !statuses.length) {
      skipped += 1;
      continue;
    }
    if (statuses.every((status) => status === "ACCEPTED")) {
      await queueMaxNotification(db, {
        bindingId,
        eventType: "ALL_MODULES_ACCEPTED",
        dedupeKey: `all-modules-completed:${user.id}`,
        text: completedModulesMessage,
      });
      queued += 1;
      continue;
    }
    const progress = reminderProgress(statuses);
    if (!progress) {
      skipped += 1;
      continue;
    }
    const result = await queueMaxNotification(db, {
      bindingId,
      eventType: "MODULE_REMINDER",
      dedupeKey: `module-reminder:${user.id}:${dateKey}`,
      text: `Напоминаем о работе с экспертными модулями.\n\nПринято модулей: **${progress.accepted} из ${progress.total}**. Пожалуйста, продолжите заполнение на портале.`,
      linkUrl: portalLink("/dashboard"),
      linkLabel: "Открыть портал",
    });
    if (result.status === "PENDING" && result.attempts === 0) {
      queued += 1;
    } else {
      skipped += 1;
    }
  }

  return { queued, skipped };
}
