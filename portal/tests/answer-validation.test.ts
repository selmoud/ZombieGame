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
});
