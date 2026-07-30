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

  it("rejects non-http links", () => {
    const linkQuestion = {
      id: "source",
      key: "source",
      type: "LINK",
      title: "Источник",
      required: true,
      config: {},
    };
    expect(
      validateAnswers([linkQuestion], { source: "javascript:alert(1)" }),
    ).toEqual({
      source: "Укажите полную ссылку, например https://…",
    });
    expect(
      validateAnswers([linkQuestion], { source: "https://example.ru/report" }),
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
          {
            key: "segment",
            title: "Направление",
            type: "suggest",
            required: true,
          },
          {
            key: "customSegment",
            title: "Название направления",
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

  it("rejects duplicate values in unique table columns", () => {
    const uniqueQuestion = {
      id: "participants",
      key: "participants",
      type: "TABLE",
      title: "Участники",
      required: true,
      config: {
        minRows: 1,
        columns: [
          {
            key: "name",
            title: "Группа участников",
            type: "suggest",
            required: true,
            uniqueAcrossRows: true,
          },
        ],
      },
    };

    expect(
      validateAnswers([uniqueQuestion], {
        participants: [
          { name: "Авторы и создатели контента" },
          { name: " авторы и создатели контента " },
        ],
      }),
    ).toEqual({
      participants:
        "Значения в поле «Группа участников» не должны повторяться",
    });
  });

  it("requires an assessment for every source table row", () => {
    const chainQuestion = {
      id: "chain",
      key: "microtransactions",
      type: "TABLE",
      title: "Действия",
      required: true,
      config: {
        minRows: 1,
        columns: [
          { key: "macro", title: "Сценарий", type: "suggest", required: true },
          { key: "name", title: "Действие", type: "suggest", required: true },
        ],
      },
    };
    const assessmentQuestion = {
      id: "assessment",
      key: "transaction_assessments",
      type: "TABLE",
      title: "Оценки",
      required: true,
      config: {
        minRows: 1,
        coverSourceQuestionKey: "microtransactions",
        coverSourceColumns: ["macro", "name"],
        coverTargetColumns: ["macro", "micro"],
        columns: [
          { key: "macro", title: "Сценарий", type: "suggest", required: true },
          { key: "micro", title: "Действие", type: "suggest", required: true },
        ],
      },
    };

    expect(
      validateAnswers([chainQuestion, assessmentQuestion], {
        chain: [
          { macro: "Публикация", name: "Проверка прав" },
          { macro: "Публикация", name: "Проведение расчётов" },
        ],
        assessment: [{ macro: "Публикация", micro: "Проверка прав" }],
      }),
    ).toEqual({
      assessment: "Оцените каждое добавленное действие",
    });
  });

  it("requires at least one action for every macrotransaction", () => {
    const macroQuestion = {
      id: "macros",
      key: "macrotransactions",
      type: "TABLE",
      title: "Сценарии",
      required: true,
      config: {
        minRows: 1,
        columns: [
          { key: "name", title: "Сценарий", type: "short_text", required: true },
        ],
      },
    };
    const microQuestion = {
      id: "micros",
      key: "microtransactions",
      type: "TABLE",
      title: "Действия",
      required: true,
      config: {
        minRows: 1,
        coverSourceQuestionKey: "macrotransactions",
        coverSourceColumns: ["name"],
        coverTargetColumns: ["macro"],
        coverageError: "Добавьте хотя бы одно действие для каждого сценария",
        columns: [
          { key: "macro", title: "Сценарий", type: "suggest", required: true },
          { key: "name", title: "Действие", type: "suggest", required: true },
        ],
      },
    };

    expect(
      validateAnswers([macroQuestion, microQuestion], {
        macros: [{ name: "Публикация" }, { name: "Монетизация" }],
        micros: [{ macro: "Публикация", name: "Проверка прав" }],
      }),
    ).toEqual({
      micros: "Добавьте хотя бы одно действие для каждого сценария",
    });
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

  it("requires table rows to cover configured category values", () => {
    const effectQuestion = {
      id: "effects",
      key: "effects",
      type: "TABLE",
      title: "Эффекты",
      required: true,
      config: {
        minRows: 3,
        requiredColumnValues: {
          columnKey: "category",
          values: ["Экономический", "Социальный", "Бюджетный"],
          error: "Добавьте эффекты всех категорий",
        },
        columns: [
          {
            key: "category",
            title: "Категория",
            type: "select",
            required: true,
          },
        ],
      },
    };

    expect(
      validateAnswers([effectQuestion], {
        effects: [
          { category: "Экономический" },
          { category: "Социальный" },
          { category: "Социальный" },
        ],
      }),
    ).toEqual({ effects: "Добавьте эффекты всех категорий" });
    expect(
      validateAnswers([effectQuestion], {
        effects: [
          { category: "Экономический" },
          { category: "Социальный" },
          { category: "Бюджетный" },
        ],
      }),
    ).toEqual({});
  });
});
