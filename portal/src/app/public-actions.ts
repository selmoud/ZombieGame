"use server";

import { redirect } from "next/navigation";
import { createSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { hashPassword, verifyPassword } from "@/lib/password";

export type RegistrationState = {
  error?: string;
  success?: boolean;
};

export async function submitRegistration(
  _previousState: RegistrationState,
  formData: FormData,
): Promise<RegistrationState> {
  const fullName = String(formData.get("fullName") ?? "")
    .trim()
    .replace(/\s+/g, " ");
  const companyName = String(formData.get("company") ?? "").trim();
  const subgroupId = String(formData.get("subgroupId") ?? "");
  const password = String(formData.get("password") ?? "");
  const passwordConfirmation = String(
    formData.get("passwordConfirmation") ?? "",
  );

  if (fullName.split(" ").length < 2 || !companyName || !subgroupId) {
    return { error: "Укажите фамилию, имя, компанию и подгруппу." };
  }
  if (password.length < 8) {
    return { error: "Пароль должен содержать не менее 8 символов." };
  }
  if (password !== passwordConfirmation) {
    return { error: "Пароли не совпадают." };
  }

  const [existingUser, pendingRequest, subgroup] = await Promise.all([
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
    db.subgroup.findUnique({
      where: { id: subgroupId },
      select: { id: true },
    }),
  ]);
  if (existingUser) {
    return { error: "Пользователь с таким именем уже существует. Используйте вход." };
  }
  if (pendingRequest) {
    return { error: "Заявка с таким именем уже ожидает согласования." };
  }
  if (!subgroup) {
    return { error: "Выбранная подгруппа больше недоступна." };
  }

  await db.registrationRequest.create({
    data: {
      fullName,
      companyName,
      subgroupId: subgroup.id,
      passwordHash: await hashPassword(password),
    },
  });
  return { success: true };
}

export type LoginState = { error?: string };

export async function loginWithPassword(
  _previousState: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const fullName = String(formData.get("fullName") ?? "")
    .trim()
    .replace(/\s+/g, " ");
  const password = String(formData.get("password") ?? "");
  const users = await db.user.findMany({
    where: {
      fullName: { equals: fullName, mode: "insensitive" },
      isActive: true,
      passwordHash: { not: null },
    },
  });

  for (const user of users) {
    if (user.passwordHash && (await verifyPassword(password, user.passwordHash))) {
      await createSession(user.id);
      redirect(user.role === "ADMIN" ? "/admin" : "/dashboard");
    }
  }
  return { error: "Неверное имя, пароль или заявка ещё не согласована." };
}
