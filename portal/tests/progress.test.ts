import { describe, expect, it } from "vitest";
import { acceptedModuleProgress } from "../src/lib/progress";

describe("accepted module progress", () => {
  it("counts only accepted modules as completed", () => {
    const result = acceptedModuleProgress([
      { submission: { status: "ACCEPTED" } },
      { submission: { status: "SUBMITTED" } },
      { submission: { status: "DRAFT" } },
      { submission: { status: "NOT_STARTED" } },
    ]);

    expect(result).toEqual({ accepted: 1, total: 4, percent: 25 });
  });
});
