import { describe, expect, it } from "vitest";
import {
  canDownloadSubmissionResults,
  statusLabels,
} from "../src/lib/status";

describe("submission status labels", () => {
  it("shows submitted modules as under moderator review", () => {
    expect(statusLabels.SUBMITTED).toBe("На рассмотрении модератором");
  });

  it("allows result downloads only after submission", () => {
    expect(canDownloadSubmissionResults("NOT_STARTED")).toBe(false);
    expect(canDownloadSubmissionResults("DRAFT")).toBe(false);
    expect(canDownloadSubmissionResults("NEEDS_REVISION")).toBe(false);
    expect(canDownloadSubmissionResults("SUBMITTED")).toBe(true);
    expect(canDownloadSubmissionResults("ACCEPTED")).toBe(true);
  });
});
