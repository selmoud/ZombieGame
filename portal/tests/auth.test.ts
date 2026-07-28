import { afterEach, describe, expect, it } from "vitest";
import { shouldUseSecureCookies } from "../src/lib/session-cookie";

const originalAppUrl = process.env.APP_URL;

afterEach(() => {
  if (originalAppUrl === undefined) {
    delete process.env.APP_URL;
  } else {
    process.env.APP_URL = originalAppUrl;
  }
});

describe("useSecureCookies", () => {
  it("allows a session cookie on the temporary HTTP deployment", () => {
    process.env.APP_URL = "http://152.53.158.128:3000";
    expect(shouldUseSecureCookies()).toBe(false);
  });

  it("enables secure cookies for HTTPS", () => {
    process.env.APP_URL = "https://portal.example.ru";
    expect(shouldUseSecureCookies()).toBe(true);
  });
});
