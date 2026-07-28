import { describe, expect, it } from "vitest";
import { synchronizeAutomaticTableRows } from "../src/lib/auto-table-rows";

const questions = [
  {
    id: "chain",
    key: "microtransactions",
    config: {
      columns: [
        { key: "macro", type: "short_text" },
        { key: "name", type: "short_text" },
        { key: "actor", type: "short_text" },
      ],
    },
  },
  {
    id: "assessments",
    key: "transaction_assessments",
    config: {
      autoRowsFromQuestionKey: "microtransactions",
      autoRowMappings: [
        { sourceColumnKey: "macro", targetColumnKey: "macro" },
        { sourceColumnKey: "name", targetColumnKey: "micro" },
        {
          sourceColumnKey: "actor",
          targetColumnKey: "actor",
          identity: false,
        },
      ],
      columns: [
        { key: "macro", type: "readonly" },
        { key: "micro", type: "readonly" },
        { key: "actor", type: "readonly" },
        { key: "frequency", type: "select" },
        { key: "costSources", type: "multi_suggest" },
      ],
    },
  },
];

describe("automatic table rows", () => {
  it("creates target rows and keeps an existing assessment", () => {
    const result = synchronizeAutomaticTableRows(questions, {
      chain: [
        { macro: "Публикация", name: "Проверка прав", actor: "Редакция" },
        { macro: "Публикация", name: "Расчёт", actor: "Платформа" },
      ],
      assessments: [
        {
          macro: "Публикация",
          micro: "Проверка прав",
          actor: "Редакция",
          frequency: "Высокая",
        },
      ],
    });

    expect(result.assessments).toEqual([
      {
        macro: "Публикация",
        micro: "Проверка прав",
        actor: "Редакция",
        frequency: "Высокая",
        costSources: [],
      },
      {
        macro: "Публикация",
        micro: "Расчёт",
        actor: "Платформа",
        frequency: "",
        costSources: [],
      },
    ]);
  });

  it("removes an assessment when its source action is removed", () => {
    const result = synchronizeAutomaticTableRows(questions, {
      chain: [{ macro: "Публикация", name: "Расчёт", actor: "Платформа" }],
      assessments: [
        { macro: "Публикация", micro: "Проверка прав", frequency: "Высокая" },
        { macro: "Публикация", micro: "Расчёт", frequency: "Средняя" },
      ],
    });

    expect(result.assessments).toEqual([
      {
        macro: "Публикация",
        micro: "Расчёт",
        actor: "Платформа",
        frequency: "Средняя",
        costSources: [],
      },
    ]);
  });
});
