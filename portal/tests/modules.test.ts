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
      title: "Ключевые показатели развития отрасли",
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
        ?.config.columns?.find((column) => column.key === "metric"),
    ).toMatchObject({
      uniqueAcrossRows: true,
      options: expect.any(Array),
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

  it("links transaction participants and scenarios to industry segments", async () => {
    const modules = await loadModuleDefinitions();
    const transactions = modules.find((module) => module.slug === "transactions");

    for (const questionKey of ["participants", "macrotransactions"]) {
      const segmentColumn = transactions?.questions
        .find((question) => question.key === questionKey)
        ?.config.columns?.find((column) => column.key === "segments");

      expect(segmentColumn).toMatchObject({
        type: "multi_suggest",
        contextKey: "industrySegments",
        allowCustom: false,
      });
    }
  });

  it("reuses expert-added participant groups after moderation", async () => {
    const modules = await loadModuleDefinitions();
    const participants = modules
      .find((module) => module.slug === "transactions")
      ?.questions.find((question) => question.key === "participants");
    const groupColumn = participants?.config.columns?.find(
      (column) => column.key === "name",
    );
    const roleColumn = participants?.config.columns?.find(
      (column) => column.key === "kind",
    );

    expect(groupColumn).toMatchObject({
      contextKey: "approvedParticipantGroups",
      sourceQuestionKey: "participants",
      sourceColumnKey: "name",
      sourceLabelSuffix: "(добавлено экспертом)",
      fullWidth: true,
    });
    expect(roleColumn).toMatchObject({
      title: "Типы участия в транзакциях",
      type: "multi_suggest",
      allowCustom: false,
      fullWidth: true,
    });
  });

  it("separates transaction chains from their assessments", async () => {
    const modules = await loadModuleDefinitions();
    const transactions = modules.find((module) => module.slug === "transactions");
    const chain = transactions?.questions.find(
      (question) => question.key === "microtransactions",
    );
    const assessments = transactions?.questions.find(
      (question) => question.key === "transaction_assessments",
    );
    const macros = transactions?.questions.find(
      (question) => question.key === "macrotransactions",
    );
    const actionColumn = assessments?.config.columns?.find(
      (column) => column.key === "micro",
    );

    expect(chain?.config.groupByColumnKey).toBe("macro");
    expect(chain?.config.addRowRequiresColumnKey).toBe("result");
    expect(chain?.config).toMatchObject({
      coverSourceQuestionKey: "macrotransactions",
      coverSourceColumns: ["name"],
      coverTargetColumns: ["macro"],
      coverageError: "Добавьте хотя бы одно действие для каждого сценария",
    });
    expect(assessments?.config).toMatchObject({
      lockRows: true,
      autoRowsFromQuestionKey: "microtransactions",
      autoRowMappings: [
        { sourceColumnKey: "macro", targetColumnKey: "macro" },
        { sourceColumnKey: "name", targetColumnKey: "micro" },
        {
          sourceColumnKey: "actor",
          targetColumnKey: "actor",
          identity: false,
        },
        {
          sourceColumnKey: "executionMode",
          targetColumnKey: "executionMode",
          identity: false,
        },
      ],
      coverSourceQuestionKey: "microtransactions",
      coverSourceColumns: ["macro", "name"],
      coverTargetColumns: ["macro", "micro"],
    });
    expect(actionColumn).toMatchObject({
      type: "readonly",
    });
    expect(
      macros?.config.columns?.find((column) => column.key === "recipient")
        ?.excludeColumnKey,
    ).toBeUndefined();
    expect(
      assessments?.config.columns
        ?.find((column) => column.key === "costSources")
        ?.options?.some(
          (option) => option.value === "Существенных издержек не выявлено",
        ),
    ).toBe(true);
  });
});
