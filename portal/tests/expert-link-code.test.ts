import { describe, expect, it } from "vitest";
import {
  isExpertLinkCodeAttempt,
  normalizeExpertLinkCode,
} from "../src/lib/expert-link-code";

describe("expert MAX link codes", () => {
  it.each(["id567821", "ID567821", " id567821 "])(
    "normalizes %s",
    (input) => {
      expect(normalizeExpertLinkCode(input)).toBe("id567821");
    },
  );

  it.each(["id123", "id1234567", "id12a456", "567821"])(
    "rejects malformed code %s",
    (input) => {
      expect(normalizeExpertLinkCode(input)).toBeNull();
    },
  );

  it("recognizes an attempted code", () => {
    expect(isExpertLinkCodeAttempt("ID123")).toBe(true);
    expect(isExpertLinkCodeAttempt("статус")).toBe(false);
  });
});
