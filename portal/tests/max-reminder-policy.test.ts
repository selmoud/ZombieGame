import { describe, expect, it } from "vitest";
import { reminderProgress } from "../src/lib/max-reminder-policy";

describe("MAX reminder policy", () => {
  it("reminds an expert who can continue an unfinished module", () => {
    expect(reminderProgress(["ACCEPTED", "DRAFT", null])).toEqual({
      accepted: 1,
      total: 3,
    });
  });

  it("does not remind while the current module is with a moderator", () => {
    expect(reminderProgress(["ACCEPTED", "SUBMITTED", null])).toBeNull();
  });

  it("does not remind after every module is accepted", () => {
    expect(reminderProgress(["ACCEPTED", "ACCEPTED"])).toBeNull();
  });

  it("does not remind a user without module assignments", () => {
    expect(reminderProgress([])).toBeNull();
  });
});
