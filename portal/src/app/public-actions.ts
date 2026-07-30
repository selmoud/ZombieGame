"use server";

import { redirect } from "next/navigation";
import { createSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { hashPassword, verifyPassword } from "@/lib/password";
import {
  createMaxLinkToken,
  hashMaxLinkToken,
  maxAdminNotificationText,
  maxBotDeepLink,
  portalLink,
  queueMaxAdminNotification,
} from "@/lib/max-bot";
import {
  clearRateLimit,
  consumeRateLimit,
} from "@/lib/rate-limit";

const dummyPasswordHash = hashPassword("invalid-login-placeholder");
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const REGISTRATION_WINDOW_MS = 60 * 60 * 1000;

function normalizeSingleLine(value: FormDataEntryValue | null) {
  return String(value ?? "")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

export type RegistrationState = {
  error?: string;
  success?: boolean;
  maxBotLink?: string;
};

export async function submitRegistration(
  _previousState: RegistrationState,
  formData: FormData,
): Promise<RegistrationState> {
  const fullName = normalizeSingleLine(formData.get("fullName"));
  const companyName = normalizeSingleLine(formData.get("company"));
  const subgroupIds = [
    ...new Set(formData.getAll("subgroupIds").map(String).filter(Boolean)),
  ];
  const password = String(formData.get("password") ?? "");
  const passwordConfirmation = String(
    formData.get("passwordConfirmation") ?? "",
  );

  if (
    fullName.length > 120 ||
    companyName.length > 160 ||
    fullName.split(" ").length < 2 ||
    !companyName ||
    !subgroupIds.length ||
    subgroupIds.length > 10
  ) {
    return { error: "Укажите фамилию, имя, компанию и хотя бы одну подгруппу." };
  }
  if (password.length < 8 || password.length > 128) {
    return { error: "Пароль должен содержать не менее 8 символов." };
  }
  if (password !== passwordConfirmation) {
    return { error: "Пароли не совпадают." };
  }
  const normalizedName = fullName.toLocaleLowerCase("ru");
  const globalLimit = consumeRateLimit(
    "registration:global",
    30,
    REGISTRATION_WINDOW_MS,
  );
  const identityLimit = consumeRateLimit(
    `registration:${normalizedName}`,
    2,
    REGISTRATION_WINDOW_MS,
  );
  if (!globalLimit.allowed || !identityLimit.allowed) {
    return {
      error:
        "Слишком много заявок. Подождите и повторите попытку позднее.",
    };
  }

  const [existingUser, pendingRequest, subgroups] = await Promise.all([
    db.user.findFirst({
      where: { fullName: { equals: fullName, mode: "insensitive" } },
      select: { id: true },
    }),
    db.registrationRequest.findFirst({
      where: {
        fullName: { equals: fullName, mode: "insensitive" },
        status: "PENDING",
      },
      select: { id: true },
    }),
    db.subgroup.findMany({
      where: { id: { in: subgroupIds } },
      select: { id: true, name: true },
    }),
  ]);
  if (existingUser) {
    return { error: "Пользователь с такими ФИО уже существует. Используйте вход." };
  }
  if (pendingRequest) {
    return { error: "Заявка с такими ФИО уже ожидает согласования." };
  }
  if (subgroups.length !== subgroupIds.length) {
    return { error: "Одна из выбранных подгрупп больше недоступна." };
  }

  const maxLinkToken =
    process.env.MAX_BOT_USERNAME && process.env.MAX_LINK_TOKEN_PEPPER
      ? createMaxLinkToken()
      : null;
  const passwordHash = await hashPassword(password);
  await db.$transaction(async (tx) => {
    const registration = await tx.registrationRequest.create({
      data: {
        fullName,
        companyName,
        passwordHash,
        subgroupMemberships: {
          create: subgroups.map((subgroup) => ({ subgroupId: subgroup.id })),
        },
        ...(maxLinkToken
          ? {
              maxLinkToken: {
                create: {
                  tokenHash: hashMaxLinkToken(maxLinkToken),
                  expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
                },
              },
            }
          : {}),
      },
    });
    await queueMaxAdminNotification(tx, {
      eventType: "ADMIN_REGISTRATION_PENDING",
      entityType: "REGISTRATION",
      entityId: registration.id,
      text: maxAdminNotificationText.registration({
        fullName,
        companyName,
        subgroupNames: subgroups.map(({ name }) => name),
      }),
      linkUrl: portalLink(`/admin#registration-${registration.id}`),
      linkLabel: "Перейти к заявке",
    });
  });
  return {
    success: true,
    maxBotLink: maxLinkToken
      ? (maxBotDeepLink(maxLinkToken) ?? undefined)
      : undefined,
  };
}

export type LoginState = { error?: string };

export async function loginWithPassword(
  _previousState: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const fullName = normalizeSingleLine(formData.get("fullName"));
  const password = String(formData.get("password") ?? "");
  const normalizedName = fullName.toLocaleLowerCase("ru");
  const globalLimit = consumeRateLimit(
    "login:global",
    100,
    LOGIN_WINDOW_MS,
  );
  const identityLimit = consumeRateLimit(
    `login:${normalizedName}`,
    5,
    LOGIN_WINDOW_MS,
  );
  if (
    !globalLimit.allowed ||
    !identityLimit.allowed ||
    fullName.length > 120 ||
    password.length > 128
  ) {
    return {
      error:
        "Слишком много попыток входа. Подождите 15 минут и повторите попытку.",
    };
  }
  const user = await db.user.findFirst({
    where: {
      fullName: { equals: fullName, mode: "insensitive" },
      isActive: true,
      passwordHash: { not: null },
    },
    select: { id: true, role: true, passwordHash: true },
  });

  const passwordHash = user?.passwordHash ?? (await dummyPasswordHash);
  const validPassword = await verifyPassword(password, passwordHash);
  if (user && validPassword) {
    clearRateLimit(`login:${normalizedName}`);
    await createSession(user.id);
    redirect(user.role === "ADMIN" ? "/admin" : "/dashboard");
  }
  return { error: "Неверные ФИО, пароль или заявка ещё не согласована." };
}
