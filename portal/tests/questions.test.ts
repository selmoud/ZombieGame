import { describe, expect, it } from "vitest";
import { isQuestionHidden } from "../src/lib/questions";

describe("question visibility", () => {
  it("hides only questions explicitly marked as hidden", () => {
    expect(isQuestionHidden({ hidden: true })).toBe(true);
    expect(isQuestionHidden({ hidden: false })).toBe(false);
    expect(isQuestionHidden({})).toBe(false);
    expect(isQuestionHidden(null)).toBe(false);
  });
});
