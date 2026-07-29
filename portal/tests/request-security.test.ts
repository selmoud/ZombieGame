import { afterEach, describe, expect, it } from "vitest";
import {
  isSafeJsonValue,
  isTrustedMutationRequest,
  readLimitedJson,
} from "../src/lib/request-security";

const originalAppUrl = process.env.APP_URL;

afterEach(() => {
  if (originalAppUrl === undefined) delete process.env.APP_URL;
  else process.env.APP_URL = originalAppUrl;
});

describe("request security", () => {
  it("accepts same-origin mutations and rejects foreign or missing origins", () => {
    process.env.APP_URL = "https://portal.example.ru";
    expect(
      isTrustedMutationRequest(
        new Request("https://portal.example.ru/api/test", {
          headers: { origin: "https://portal.example.ru" },
        }),
      ),
    ).toBe(true);
    expect(
      isTrustedMutationRequest(
        new Request("https://portal.example.ru/api/test", {
          headers: { origin: "https://attacker.example" },
        }),
      ),
    ).toBe(false);
    expect(
      isTrustedMutationRequest(
        new Request("https://portal.example.ru/api/test"),
      ),
    ).toBe(false);
  });

  it("rejects oversized JSON before parsing", async () => {
    const request = new Request("https://portal.example.ru/api/test", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ value: "x".repeat(128) }),
    });
    await expect(readLimitedJson(request, 32)).resolves.toEqual({
      ok: false,
      error: "PAYLOAD_TOO_LARGE",
    });
  });

  it("rejects deeply nested or excessively long values", () => {
    expect(isSafeJsonValue({ answer: "Краткий ответ" })).toBe(true);
    expect(isSafeJsonValue({ answer: "x".repeat(50_001) })).toBe(false);
    let nested: unknown = "value";
    for (let index = 0; index < 10; index += 1) nested = { nested };
    expect(isSafeJsonValue(nested)).toBe(false);
  });
});
