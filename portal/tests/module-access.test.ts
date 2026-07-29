import { describe, expect, it } from "vitest";
import { isModuleUnlockedFromAssignments } from "../src/lib/module-access";

const assignment = (order: number, status: string) => ({
  module: { order },
  submission: { status },
});

describe("sequential module access", () => {
  it("opens the first assigned module", () => {
    expect(
      isModuleUnlockedFromAssignments(
        [assignment(1, "NOT_STARTED"), assignment(2, "NOT_STARTED")],
        1,
      ),
    ).toBe(true);
  });

  it("opens the next module only after all previous modules are accepted", () => {
    expect(
      isModuleUnlockedFromAssignments(
        [assignment(1, "SUBMITTED"), assignment(2, "NOT_STARTED")],
        2,
      ),
    ).toBe(false);
    expect(
      isModuleUnlockedFromAssignments(
        [assignment(1, "ACCEPTED"), assignment(2, "NOT_STARTED")],
        2,
      ),
    ).toBe(true);
  });

  it("keeps later modules locked if any earlier module is not accepted", () => {
    expect(
      isModuleUnlockedFromAssignments(
        [
          assignment(1, "ACCEPTED"),
          assignment(2, "NEEDS_REVISION"),
          assignment(3, "NOT_STARTED"),
        ],
        3,
      ),
    ).toBe(false);
  });

  it("keeps a later module locked if a previous assignment is missing", () => {
    expect(
      isModuleUnlockedFromAssignments(
        [assignment(1, "ACCEPTED"), assignment(3, "NOT_STARTED")],
        3,
      ),
    ).toBe(false);
  });

  it("opens every assigned module when the personal override is enabled", () => {
    expect(
      isModuleUnlockedFromAssignments(
        [
          assignment(1, "NOT_STARTED"),
          assignment(2, "NOT_STARTED"),
          assignment(8, "NOT_STARTED"),
        ],
        8,
        true,
      ),
    ).toBe(true);
  });
});
