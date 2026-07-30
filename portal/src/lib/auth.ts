import { createHmac, randomBytes, randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { shouldUseSecureCookies } from "@/lib/session-cookie";
import type { UserRole } from "@/generated/prisma/enums";

const SESSION_COOKIE = "portal_session";
const SESSION_DAYS = 7;

export function hashInvitationToken(token: string) {
  const pepper = process.env.INVITATION_TOKEN_PEPPER;
  if (!pepper) {
    throw new Error("INVITATION_TOKEN_PEPPER is not configured");
  }
  return createHmac("sha256", pepper).update(token).digest("hex");
}

export function createInvitationToken() {
  return randomBytes(32).toString("base64url");
}

export async function createSession(userId: string) {
  const id = randomUUID();
  const expiresAt = new Date(
    Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000,
  );
  await db.session.create({ data: { id, userId, expiresAt } });
  const store = await cookies();
  store.set(SESSION_COOKIE, id, {
    httpOnly: true,
    sameSite: "lax",
    secure: shouldUseSecureCookies(),
    path: "/",
    priority: "high",
    expires: expiresAt,
  });
}

export async function getCurrentUser() {
  const sessionId = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!sessionId) return null;

  const session = await db.session.findUnique({
    where: { id: sessionId },
    include: {
      user: {
        include: {
          company: true,
          subgroupMemberships: { include: { subgroup: true } },
          ledSubgroups: {
            select: { id: true, name: true },
            orderBy: { name: "asc" },
          },
        },
      },
    },
  });

  if (
    !session ||
    session.revokedAt ||
    session.expiresAt <= new Date() ||
    !session.user.isActive
  ) {
    return null;
  }
  return session.user;
}

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?recover=1");
  return user;
}

export async function requireRole(...roles: UserRole[]) {
  const user = await requireUser();
  if (!roles.includes(user.role)) redirect("/dashboard");
  return user;
}

export async function logout() {
  const store = await cookies();
  const id = store.get(SESSION_COOKIE)?.value;
  if (id) {
    await db.session
      .update({ where: { id }, data: { revokedAt: new Date() } })
      .catch(() => undefined);
  }
  store.delete(SESSION_COOKIE);
}
