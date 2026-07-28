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

  it("supports conditional fields for multiple selections", () => {
    const conditionalQuestion = {
      id: "transactions",
      key: "transactions",
      type: "TABLE",
      title: "Транзакции",
      required: true,
      config: {
        minRows: 1,
        columns: [
          {
            key: "values",
            title: "Предметы транзакции",
            type: "multi_suggest",
            required: true,
          },
          {
            key: "customValue",
            title: "Другой предмет",
            type: "short_text",
            requiredWhen: { columnKey: "values", includes: "Другое" },
            visibleWhen: { columnKey: "values", includes: "Другое" },
          },
        ],
      },
    };

    expect(
      validateAnswers([conditionalQuestion], {
        transactions: [{ values: ["Контент", "Другое"], customValue: "" }],
      }),
    ).toEqual({
      transactions: "Заполните обязательные ячейки таблицы",
    });
    expect(
      validateAnswers([conditionalQuestion], {
        transactions: [{ values: ["Контент"], customValue: "" }],
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

  it("checks chronological boundaries inside table rows", () => {
    const retrospectiveQuestion = {
      id: "retrospective",
      key: "retrospective",
      type: "TABLE",
      title: "Ретроспективная оценка",
      required: true,
      config: {
        minRows: 1,
        columns: [
          { key: "startYear", title: "Начало", type: "select", required: true },
          {
            key: "endYear",
            title: "Окончание",
            type: "select",
            required: true,
            notBeforeColumnKey: "startYear",
          },
        ],
      },
    };

    expect(
      validateAnswers([retrospectiveQuestion], {
        retrospective: [{ startYear: "2022", endYear: "2020" }],
      }),
    ).toEqual({
      retrospective:
        "Год окончания этапа не может быть раньше года начала",
    });
    expect(
      validateAnswers([retrospectiveQuestion], {
        retrospective: [{ startYear: "2020", endYear: "2022" }],
      }),
    ).toEqual({});
  });
});
