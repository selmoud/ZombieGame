import { afterEach, describe, expect, it } from "vitest";
import {
  hashMaxLinkToken,
  maxBotDeepLink,
  validMaxWebhookSecret,
} from "../src/lib/max-bot-security";
import {
  completedAdminNotificationText,
  maxAdminNotificationDedupeKey,
} from "../src/lib/max-admin-notification-policy";

const original = {
  MAX_LINK_TOKEN_PEPPER: process.env.MAX_LINK_TOKEN_PEPPER,
  MAX_BOT_USERNAME: process.env.MAX_BOT_USERNAME,
  MAX_WEBHOOK_SECRET: process.env.MAX_WEBHOOK_SECRET,
};

afterEach(() => {
  for (const [key, value] of Object.entries(original)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

describe("MAX bot security helpers", () => {
  it("hashes one-time link tokens without storing the raw token", () => {
    process.env.MAX_LINK_TOKEN_PEPPER = "a".repeat(32);
    expect(hashMaxLinkToken("opaque-token")).toMatch(/^[0-9a-f]{64}$/);
    expect(hashMaxLinkToken("opaque-token")).not.toContain("opaque-token");
  });

  it("builds a MAX deep link from the configured public username", () => {
    process.env.MAX_BOT_USERNAME = "@expert_group_bot";
    expect(maxBotDeepLink("one-time token")).toBe(
      "https://max.ru/expert_group_bot?start=one-time%20token",
    );
  });

  it("validates the webhook secret exactly", () => {
    process.env.MAX_WEBHOOK_SECRET = "secret-value";
    expect(validMaxWebhookSecret("secret-value")).toBe(true);
    expect(validMaxWebhookSecret("secret-valuE")).toBe(false);
    expect(validMaxWebhookSecret(null)).toBe(false);
  });
});

describe("MAX administrator channel notifications", () => {
  it("marks a completed request with a green check", () => {
    expect(completedAdminNotificationText("Новая заявка")).toBe(
      "✅ Новая заявка",
    );
  });

  it("does not duplicate the completion mark", () => {
    expect(completedAdminNotificationText("✅ Новая заявка")).toBe(
      "✅ Новая заявка",
    );
  });

  it("separates repeated submission revisions without duplicating one revision", () => {
    expect(
      maxAdminNotificationDedupeKey({
        eventType: "ADMIN_SUBMISSION_PENDING",
        entityId: "submission",
        scope: 26,
        channelId: "channel",
      }),
    ).toBe("ADMIN_SUBMISSION_PENDING:submission:26:channel");
  });
});
