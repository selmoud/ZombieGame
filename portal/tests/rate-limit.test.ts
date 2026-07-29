import { beforeEach, describe, expect, it } from "vitest";
import {
  clearAllRateLimitsForTests,
  consumeRateLimit,
} from "../src/lib/rate-limit";

describe("rate limiting", () => {
  beforeEach(() => clearAllRateLimitsForTests());

  it("blocks requests after the configured limit", () => {
    expect(consumeRateLimit("login:user", 2, 60_000, 1_000).allowed).toBe(true);
    expect(consumeRateLimit("login:user", 2, 60_000, 1_001).allowed).toBe(true);
    expect(consumeRateLimit("login:user", 2, 60_000, 1_002).allowed).toBe(false);
  });

  it("opens a new window after expiration", () => {
    consumeRateLimit("login:user", 1, 1_000, 1_000);
    expect(consumeRateLimit("login:user", 1, 1_000, 2_001).allowed).toBe(true);
  });
});
