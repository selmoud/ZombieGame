"use server";

import { redirect } from "next/navigation";
import { createSession, hashInvitationToken } from "@/lib/auth";
import { db } from "@/lib/db";

export async function acceptInvitation(formData: FormData) {
  const token = String(formData.get("token") ?? "");
  if (!token || token.length > 128) {
    redirect("/invite/invalid");
  }
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

  const claimed = await db.$transaction(async (tx) => {
    const now = new Date();
    const result = await tx.invitationToken.updateMany({
      where: {
        id: invitation.id,
        usedAt: null,
        revokedAt: null,
        expiresAt: { gt: now },
      },
      data: { usedAt: now },
    });
    if (result.count !== 1) return false;
    await tx.user.update({
      where: { id: invitation.userId },
      data: {
        isActive: true,
        activatedAt: invitation.user.activatedAt ?? now,
      },
    });
    return true;
  });
  if (!claimed) redirect("/invite/invalid");
  await createSession(invitation.userId);
  redirect(invitation.user.role === "ADMIN" ? "/admin" : "/dashboard");
}
