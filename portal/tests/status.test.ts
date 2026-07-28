import { describe, expect, it } from "vitest";
import { statusLabels } from "../src/lib/status";

describe("submission status labels", () => {
  it("shows submitted modules as under moderator review", () => {
    expect(statusLabels.SUBMITTED).toBe("На рассмотрении модератором");
  });
});
