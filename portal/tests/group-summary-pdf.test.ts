import { describe, expect, it } from "vitest";
import type { AnalyticsSubmission } from "../src/lib/accepted-analytics";
import { createGroupSummaryPdf } from "../src/lib/group-summary-pdf";

function submission(
  moduleOrder: number,
  expertId: string,
  answers: Record<string, unknown>,
): AnalyticsSubmission {
  return {
    assignment: {
      module: { order: moduleOrder },
      user: { id: expertId, fullName: `Эксперт ${expertId}` },
    },
    answers: Object.entries(answers).map(([key, value]) => ({
      question: { key },
      value,
    })),
  };
}

describe("group summary PDF", () => {
  it("creates a deterministic report from accepted analytics data", async () => {
    const pdf = await createGroupSummaryPdf({
      scopeTitle: "Коммуникации",
      scopeKind: "subgroup",
      generatedBy: "Руководитель",
      memberCount: 2,
      moduleCount: 8,
      submissions: [
        submission(1, "1", {
          industry_boundaries: [
            {
              segment: "Онлайн-видео",
              userActivityShare: "Крупная — 25–50%",
              economicShare: "Заметная — 10–25%",
            },
          ],
          key_metrics: [{ metric: "Размер активной аудитории" }],
        }),
        submission(8, "1", {
          target_transactions: [
            {
              macro: "Распространение контента",
              targetShare: "Более 50%",
              targetParticipantShare: "30–50%",
              costReduction: "10–25%",
            },
          ],
          recommendations: [
            {
              direction: "Стандартизация",
              title: "Унифицировать требования",
            },
          ],
        }),
      ],
      economicData: {
        reportingPeriod: "2025",
        gdpShare: 2.4,
        employmentShare: 1.8,
      },
    });

    expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
    expect(pdf.length).toBeGreaterThan(5_000);
  });
});
