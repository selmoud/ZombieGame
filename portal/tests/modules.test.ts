import { describe, expect, it } from "vitest";
import { loadModuleDefinitions } from "../src/lib/modules";

describe("module definitions", () => {
  it("loads eight ordered YAML modules", async () => {
    const modules = await loadModuleDefinitions();
    expect(modules).toHaveLength(8);
    expect(modules.map((item) => item.order)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(modules.every((item) => item.questions.length > 0)).toBe(true);
  });

  it("separates industry boundaries from industry segments", async () => {
    const [industry] = await loadModuleDefinitions();
    expect(industry.questions.map((question) => question.key)).toEqual([
      "industry_boundaries",
      "segment_assessment_file",
      "analysis_object",
      "current_state",
      "key_metrics",
    ]);
    const boundaries = industry.questions.find((question) => question.key === "analysis_object");
    const segments = industry.questions.find(
      (question) => question.key === "industry_boundaries",
    );

    expect(boundaries).toMatchObject({
      order: 1,
      title: "Границы отрасли",
      config: {
        fixedRows: 1,
      },
    });
    expect(boundaries?.config.columns?.map((column) => column.type)).toEqual([
      "readonly",
      "multi_suggest",
      "long_text",
    ]);
    expect(
      boundaries?.config.columns?.find(
        (column) => column.key === "intersectionAssessment",
      ),
    ).toMatchObject({
      required: true,
      fullWidth: true,
    });
    expect(segments).toMatchObject({
      order: 2,
      title: "Сегменты отрасли",
    });
    expect(segments?.config.columns?.map((column) => column.type)).toEqual([
      "readonly",
      "suggest",
      "short_text",
      "multi_suggest",
      "select",
      "select",
      "long_text",
    ]);
    expect(
      segments?.config.columns?.find(
        (column) => column.key === "assessmentRationale",
      ),
    ).toMatchObject({
      required: true,
      fullWidth: true,
    });
    expect(
      industry.questions.find(
        (question) => question.key === "segment_assessment_file",
      ),
    ).toMatchObject({
      order: 5,
      type: "file",
      title: "Материалы к экспертной оценке отрасли и сегментов",
      required: false,
    });
    expect(
      industry.questions.find((question) => question.key === "current_state"),
    ).toMatchObject({
      order: 3,
      type: "table",
      config: {
        minRows: 1,
        addRowLabel: "Добавить этап",
      },
    });
    const retrospective = industry.questions.find(
      (question) => question.key === "current_state",
    );
    expect(
      retrospective?.config.columns
        ?.filter((column) => ["startYear", "endYear"].includes(column.key))
        .every((column) =>
          column.options?.some((option) => option.value === "2026"),
      ),
    ).toBe(true);
    expect(
      industry.questions.find((question) => question.key === "key_metrics"),
    ).toMatchObject({
      order: 4,
      title: "Ключевые показатели развития отрасли до 2036 года",
      required: true,
      config: {
        minRows: 3,
        maxRows: 5,
        addRowLabel: "Добавить показатель",
        sortableRows: true,
      },
    });
    expect(
      industry.questions
        .find((question) => question.key === "key_metrics")
        ?.config.columns?.find((column) => column.key === "metric")?.options,
    ).toHaveLength(10);
  });

  it("supports searchable and linked table fields", async () => {
    const modules = await loadModuleDefinitions();
    const transactions = modules.find((module) => module.slug === "transactions");
    const microtransactions = transactions?.questions.find(
      (question) => question.key === "microtransactions",
    );
    const macroColumn = microtransactions?.config.columns?.find(
      (column) => column.key === "macro",
    );

    expect(macroColumn).toMatchObject({
      type: "suggest",
      sourceQuestionKey: "macrotransactions",
      sourceColumnKey: "name",
    });
  });
});
