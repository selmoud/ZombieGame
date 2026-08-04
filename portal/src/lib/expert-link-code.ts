import { randomInt } from "node:crypto";
import type { Prisma } from "@/generated/prisma/client";

type ExpertCodeClient = Pick<Prisma.TransactionClient, "user">;

export function normalizeExpertLinkCode(value: string) {
  const code = value.trim().toLowerCase();
  return /^id\d{6}$/.test(code) ? code : null;
}

export function isExpertLinkCodeAttempt(value: string) {
  return /^id/i.test(value.trim());
}

export async function createExpertLinkCode(client: ExpertCodeClient) {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const code = `id${randomInt(100_000, 1_000_000)}`;
    const exists = await client.user.findUnique({
      where: { maxLinkCode: code },
      select: { id: true },
    });
    if (!exists) return code;
  }
  throw new Error("Could not allocate a unique expert link code");
}
