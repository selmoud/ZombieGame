import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "../src/lib/password";

describe("password hashing", () => {
  it("verifies the correct password and rejects another one", async () => {
    const hash = await hashPassword("НадёжныйПароль2036");
    expect(hash).not.toContain("НадёжныйПароль2036");
    await expect(verifyPassword("НадёжныйПароль2036", hash)).resolves.toBe(true);
    await expect(verifyPassword("ДругойПароль", hash)).resolves.toBe(false);
  });
});
