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
      attachmentBaseUrl: "https://portal.example/api/attachments",
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

  it("adds a server attachment link", async () => {
    const pdf = await createSubmissionPdf({
      moduleOrder: 1,
      moduleTitle: "Текущее состояние отрасли",
      expertName: "Иванов Иван",
      companyName: "Тест",
      subgroupName: "Коммуникации",
      statusLabel: "На рассмотрении модератором",
      attachmentBaseUrl: "https://portal.example/api/attachments",
      questions: [
        {
          title: "Подтверждающие материалы",
          config: {},
          value: { id: "attachment-123", name: "исследование.pdf" },
        },
      ],
    });

    expect(pdf.toString("latin1")).toContain(
      "https://portal.example/api/attachments/attachment-123",
    );
  });
});
