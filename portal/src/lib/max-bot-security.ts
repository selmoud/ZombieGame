import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

export function createMaxLinkToken() {
  return randomBytes(32).toString("base64url");
}

export function hashMaxLinkToken(token: string) {
  const pepper = process.env.MAX_LINK_TOKEN_PEPPER;
  if (!pepper) throw new Error("MAX_LINK_TOKEN_PEPPER is not configured");
  return createHmac("sha256", pepper).update(token).digest("hex");
}

export function maxBotDeepLink(token: string) {
  const username = process.env.MAX_BOT_USERNAME?.replace(/^@/, "").trim();
  return username
    ? `https://max.ru/${encodeURIComponent(username)}?start=${encodeURIComponent(token)}`
    : null;
}

export function validMaxWebhookSecret(candidate: string | null) {
  const expected = process.env.MAX_WEBHOOK_SECRET;
  if (!candidate || !expected) return false;
  const left = Buffer.from(candidate);
  const right = Buffer.from(expected);
  return left.length === right.length && timingSafeEqual(left, right);
}
