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
    expect(industry.questions.slice(0, 2).map((question) => question.key)).toEqual([
      "industry_boundaries",
      "analysis_object",
    ]);
    expect(industry.questions[0].config.columns?.map((column) => column.type)).toEqual([
      "readonly",
      "suggest",
      "multi_suggest",
    ]);
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
