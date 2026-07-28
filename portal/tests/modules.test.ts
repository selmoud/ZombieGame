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
    const boundaries = industry.questions.find((question) => question.key === "analysis_object");
    const segments = industry.questions.find(
      (question) => question.key === "industry_boundaries",
    );

    expect(boundaries).toMatchObject({
      order: 1,
      title: "Границы отрасли",
    });
    expect(boundaries?.config.columns?.map((column) => column.type)).toEqual([
      "readonly",
      "multi_suggest",
      "number",
      "number",
      "select",
      "long_text",
      "select",
      "long_text",
    ]);
    expect(segments).toMatchObject({
      order: 2,
      title: "Сегменты отрасли",
    });
    expect(segments?.config.columns?.map((column) => column.type)).toEqual([
      "readonly",
      "suggest",
      "short_text",
      "multi_suggest",
      "multi_suggest",
      "select",
      "select",
      "long_text",
    ]);
    expect(
      industry.questions.find(
        (question) => question.key === "segment_assessment_file",
      ),
    ).toMatchObject({
      order: 3,
      type: "file",
      required: false,
    });
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
