"use server";

import { redirect } from "next/navigation";
import { createSession, hashInvitationToken } from "@/lib/auth";
import { db } from "@/lib/db";

export async function acceptInvitation(formData: FormData) {
  const token = String(formData.get("token") ?? "");
  const invitation = await db.invitationToken.findUnique({
    where: { tokenHash: hashInvitationToken(token) },
    include: { user: true },
  });

  if (
    !invitation ||
    invitation.usedAt ||
    invitation.revokedAt ||
    invitation.expiresAt <= new Date()
  ) {
    redirect("/invite/invalid");
  }

  await db.$transaction([
    db.invitationToken.update({
      where: { id: invitation.id },
      data: { usedAt: new Date() },
    }),
    db.user.update({
      where: { id: invitation.userId },
      data: { isActive: true, activatedAt: invitation.user.activatedAt ?? new Date() },
    }),
  ]);
  await createSession(invitation.userId);
  redirect(invitation.user.role === "ADMIN" ? "/admin" : "/dashboard");
}
