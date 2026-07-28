import { describe, expect, it } from "vitest";
import { createSubmissionPdf } from "../src/lib/submission-pdf";

describe("submission PDF", () => {
  it("creates a PDF with Cyrillic submission content", async () => {
    const pdf = await createSubmissionPdf({
      moduleOrder: 1,
      moduleTitle: "Текущее состояние отрасли",
      expertName: "Иванов Иван",
      companyName: "Тест",
      subgroupName: "Коммуникации",
      statusLabel: "Черновик",
      questions: [
        {
          title: "Границы отрасли",
          config: {
            options: [
              { value: "trade", label: "Торговля" },
              { value: "finance", label: "Финансы" },
            ],
          },
          value: ["trade", "finance"],
        },
      ],
    });

    expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
    expect(pdf.length).toBeGreaterThan(1_000);
  });
});
