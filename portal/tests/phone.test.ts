import { describe, expect, it } from "vitest";
import { normalizePhoneNumber } from "../src/lib/phone";

describe("normalizePhoneNumber", () => {
  it.each([
    ["+7 926 213-95-14", "+79262139514"],
    ["8 (926) 213-95-14", "+79262139514"],
    ["79262139514", "+79262139514"],
  ])("normalizes %s", (input, expected) => {
    expect(normalizePhoneNumber(input)).toBe(expected);
  });

  it.each(["", "+7 123", "+1 202 555 0100", "телефон"])(
    "rejects %s",
    (input) => {
      expect(normalizePhoneNumber(input)).toBeNull();
    },
  );
});
