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
  const subgroupIds = [
    ...new Set(formData.getAll("subgroupIds").map(String).filter(Boolean)),
  ];
  const password = String(formData.get("password") ?? "");
  const passwordConfirmation = String(
    formData.get("passwordConfirmation") ?? "",
  );

  if (fullName.split(" ").length < 2 || !companyName || !subgroupIds.length) {
    return { error: "Укажите фамилию, имя, компанию и хотя бы одну подгруппу." };
  }
  if (password.length < 8) {
    return { error: "Пароль должен содержать не менее 8 символов." };
  }
  if (password !== passwordConfirmation) {
    return { error: "Пароли не совпадают." };
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
      select: { id: true },
    }),
  ]);
  if (existingUser) {
    return { error: "Пользователь с таким именем уже существует. Используйте вход." };
  }
  if (pendingRequest) {
    return { error: "Заявка с таким именем уже ожидает согласования." };
  }
  if (subgroups.length !== subgroupIds.length) {
    return { error: "Одна из выбранных подгрупп больше недоступна." };
  }

  await db.registrationRequest.create({
    data: {
      fullName,
      companyName,
      passwordHash: await hashPassword(password),
      subgroupMemberships: {
        create: subgroups.map((subgroup) => ({ subgroupId: subgroup.id })),
      },
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
