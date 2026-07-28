import { describe, expect, it } from "vitest";
import { validateAnswers } from "../src/lib/answer-validation";

const questions = [
  {
    id: "summary",
    key: "summary",
    type: "LONG_TEXT",
    title: "Вывод",
    required: true,
    config: {},
  },
  {
    id: "effects",
    key: "effects",
    type: "TABLE",
    title: "Эффекты",
    required: true,
    config: {
      minRows: 1,
      columns: [
        { key: "name", title: "Название", type: "short_text", required: true },
      ],
    },
  },
];

describe("validateAnswers", () => {
  it("requires mandatory questions and table rows", () => {
    expect(validateAnswers(questions, {})).toEqual({
      summary: "Заполните обязательное поле",
      effects: "Заполните обязательное поле",
    });
  });

  it("checks mandatory cells", () => {
    expect(
      validateAnswers(questions, {
        summary: "Содержательный вывод",
        effects: [{}],
      }),
    ).toEqual({
      effects: "Заполните обязательные ячейки таблицы",
    });
  });

  it("accepts a complete response", () => {
    expect(
      validateAnswers(questions, {
        summary: "Содержательный вывод",
        effects: [{ name: "Рост производительности" }],
      }),
    ).toEqual({});
  });

  it("requires a conditional table cell only when its option is selected", () => {
    const conditionalQuestion = {
      id: "boundaries",
      key: "boundaries",
      type: "TABLE",
      title: "Границы отрасли",
      required: true,
      config: {
        minRows: 1,
        columns: [
          { key: "segment", title: "Сегмент", type: "suggest", required: true },
          {
            key: "customSegment",
            title: "Название сегмента",
            type: "short_text",
            requiredWhen: { columnKey: "segment", equals: "Другое" },
            visibleWhen: { columnKey: "segment", equals: "Другое" },
          },
        ],
      },
    };

    expect(
      validateAnswers([conditionalQuestion], {
        boundaries: [{ segment: "Другое", customSegment: "" }],
      }),
    ).toEqual({
      boundaries: "Заполните обязательные ячейки таблицы",
    });
    expect(
      validateAnswers([conditionalQuestion], {
        boundaries: [{ segment: "Онлайн-видео", customSegment: "" }],
      }),
    ).toEqual({});
  });

  it("checks number ranges inside table rows", () => {
    const percentageQuestion = {
      id: "boundaries",
      key: "boundaries",
      type: "TABLE",
      title: "Границы отрасли",
      required: true,
      config: {
        minRows: 1,
        columns: [
          {
            key: "gdpShare",
            title: "Доля в ВВП",
            type: "number",
            required: true,
            min: 0,
            max: 100,
          },
        ],
      },
    };

    expect(
      validateAnswers([percentageQuestion], {
        boundaries: [{ gdpShare: "100.1" }],
      }),
    ).toEqual({
      boundaries: "Проверьте числовые значения и допустимый диапазон",
    });
    expect(
      validateAnswers([percentageQuestion], {
        boundaries: [{ gdpShare: "4.7" }],
      }),
    ).toEqual({});
  });
});
