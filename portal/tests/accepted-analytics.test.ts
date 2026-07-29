import { describe, expect, it } from "vitest";
import {
  buildAcceptedAnalytics,
  type AnalyticsSubmission,
} from "../src/lib/accepted-analytics";

function submission(
  moduleOrder: number,
  expert: string,
  answers: Record<string, unknown>,
): AnalyticsSubmission {
  return {
    assignment: {
      module: { order: moduleOrder },
      user: { id: expert, fullName: expert },
    },
    answers: Object.entries(answers).map(([key, value]) => ({
      question: { key },
      value,
    })),
  };
}

describe("accepted analytics", () => {
  it("does not treat the activity/economy gap as expert disagreement", () => {
    const result = buildAcceptedAnalytics([
      submission(1, "Эксперт 1", {
        industry_boundaries: [
          {
            segment: "Онлайн-видео",
            userActivityShare: "Крупная — 25–50%",
            economicShare: "Небольшая — 5–10%",
          },
        ],
      }),
      submission(1, "Эксперт 2", {
        industry_boundaries: [
          {
            segment: "Онлайн-видео",
            userActivityShare: "Крупная — 25–50%",
            economicShare: "Небольшая — 5–10%",
          },
        ],
      }),
    ]);

    expect(result.segmentComparison[0]).toMatchObject({
      activity: "Крупная — 25–50%",
      economy: "Небольшая — 5–10%",
      agreement: "Высокая",
      responses: 2,
    });
  });

  it("ranks manual, costly and poorly standardized actions higher", () => {
    const result = buildAcceptedAnalytics([
      submission(2, "Эксперт", {
        transaction_assessments: [
          {
            macro: "Размещение рекламы",
            micro: "Ручная проверка",
            frequency: "Очень высокая",
            repeatability: "Очень высокая",
            standardization: "Очень низкая",
            resourceIntensity: "Очень высокая",
            costLevel: "Очень высокий",
            executionMode: "Полностью вручную",
            costSources: ["Ручные проверки"],
          },
          {
            macro: "Размещение рекламы",
            micro: "Автоматическая оплата",
            frequency: "Низкая",
            repeatability: "Низкая",
            standardization: "Очень высокая",
            resourceIntensity: "Очень низкая",
            costLevel: "Очень низкий",
            executionMode: "Полностью автоматизировано",
          },
        ],
      }),
    ]);

    expect(result.actionPriorities.map((item) => item.name)).toEqual([
      "Ручная проверка",
      "Автоматическая оплата",
    ]);
    expect(result.actionPriorities[0].priority).toBe("Высокий");
    expect(result.actionPriorities[1].priority).toBe("Низкий");
  });

  it("uses the entered name for a custom retrospective factor", () => {
    const result = buildAcceptedAnalytics([
      submission(1, "Эксперт", {
        current_state: [
          {
            startYear: "2024",
            endYear: "2026",
            keyFactor: "Другое",
            customFactor: "Рост генеративного контента",
            influence: "Позитивное влияние",
          },
        ],
      }),
    ]);

    expect(result.factors[0]).toMatchObject({
      factor: "Рост генеративного контента",
      period: "2024–2026",
      positive: 1,
    });
  });
});
