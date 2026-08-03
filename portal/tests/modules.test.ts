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
      required: false,
      fullWidth: true,
    });
    expect(
      boundaries?.config.columns?.find(
        (column) => column.key === "adjacentIndustries",
      ),
    ).toMatchObject({ required: false });
    expect(segments).toMatchObject({
      order: 2,
      title: "Направления отрасли",
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
      segments?.config.columns
        ?.find((column) => column.key === "segment")
        ?.options?.map((option) => option.value),
    ).toContain("Электронная коммерция");
    expect(
      industry.questions.find(
        (question) => question.key === "segment_assessment_file",
      ),
    ).toMatchObject({
      order: 5,
      type: "file",
      title: "Материалы к экспертной оценке отрасли и направлений",
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

  it("builds the state and market assessment from accepted transaction data", async () => {
    const modules = await loadModuleDefinitions();
    const stateMarket = modules.find((module) => module.slug === "state-market");

    expect(stateMarket?.questions.map((question) => question.key)).toEqual([
      "state_functions",
      "interaction_formats",
      "platforms",
      "platform_penetration",
      "network_effects",
      "state_market_materials",
    ]);
    expect(
      stateMarket?.questions.find(
        (question) => question.key === "state_functions",
      ),
    ).toMatchObject({
      required: true,
      config: {
        minRows: 1,
        maxRows: 12,
      },
    });
    expect(
      stateMarket?.questions
        .find((question) => question.key === "state_functions")
        ?.config.columns?.find((column) => column.key === "macros"),
    ).toMatchObject({
      type: "multi_suggest",
      contextKey: "macroTransactions",
      allowCustom: false,
    });
    expect(
      stateMarket?.questions.find((question) => question.key === "platforms"),
    ).toMatchObject({
      config: {
        minRows: 1,
        maxRows: 15,
      },
    });
    expect(
      stateMarket?.questions
        .find((question) => question.key === "platforms")
        ?.config.columns?.find((column) => column.key === "segments"),
    ).toMatchObject({
      type: "multi_suggest",
      contextKey: "industrySegments",
      allowCustom: false,
      required: true,
    });
    const penetration = stateMarket?.questions.find(
      (question) => question.key === "platform_penetration",
    );
    expect(penetration?.config.lockRows).toBe(true);
    expect(
      penetration?.config.columns
        ?.find((column) => column.key === "share")
        ?.options?.map((option) => option.value),
    ).toEqual(
      expect.arrayContaining([
        "Менее 5% — формирование платформ",
        "Более 50% — доминирование платформ",
      ]),
    );
    expect(
      stateMarket?.questions
        .find((question) => question.key === "network_effects")
        ?.config,
    ).toMatchObject({
      minRows: 1,
      maxRows: 5,
    });
    expect(
      stateMarket?.questions
        .find((question) => question.key === "network_effects")
        ?.config.columns?.find((column) => column.key === "platform"),
    ).toMatchObject({
      sourceQuestionKey: "platforms",
      sourceColumnKey: "name",
      uniqueAcrossRows: true,
    });
  });

  it("builds architecture around accepted platforms and participants", async () => {
    const modules = await loadModuleDefinitions();
    const architecture = modules.find(
      (module) => module.slug === "architecture",
    );

    expect(architecture?.questions.map((question) => question.key)).toEqual([
      "data_access",
      "service_access",
      "user_access",
      "architecture_materials",
    ]);
    expect(
      architecture?.questions.some(
        (question) => question.key === "target_2036",
      ),
    ).toBe(false);

    for (const questionKey of ["data_access", "service_access"]) {
      expect(
        architecture?.questions
          .find((question) => question.key === questionKey)
          ?.config.columns?.find((column) => column.key === "platforms"),
      ).toMatchObject({
        type: "multi_suggest",
        contextKey: "acceptedPlatforms",
        allowCustom: false,
        required: true,
      });
    }
    expect(
      architecture?.questions
        .find((question) => question.key === "user_access")
        ?.config.columns?.find((column) => column.key === "platform"),
    ).toMatchObject({
      type: "suggest",
      contextKey: "acceptedPlatforms",
      allowCustom: false,
      required: true,
    });
    expect(
      architecture?.questions
        .find((question) => question.key === "user_access")
        ?.config.columns?.find((column) => column.key === "participants"),
    ).toMatchObject({
      contextKey: "participantGroups",
      allowCustom: false,
      required: true,
    });
  });

  it("uses one prioritized barrier register linked to previous findings", async () => {
    const modules = await loadModuleDefinitions();
    const barriers = modules.find((module) => module.slug === "barriers");

    expect(barriers?.questions.map((question) => question.key)).toEqual([
      "barriers",
      "barrier_materials",
    ]);
    expect(
      barriers?.questions.some(
        (question) => question.key === "target_2036",
      ),
    ).toBe(false);
    expect(barriers?.questions[0]).toMatchObject({
      title: "Реестр барьеров",
      required: true,
      config: {
        minRows: 1,
        maxRows: 15,
        sortableRows: true,
        numberRows: true,
      },
    });
    expect(
      barriers?.questions[0].config.columns?.find(
        (column) => column.key === "priorEvidence",
      ),
    ).toMatchObject({
      type: "multi_suggest",
      contextKey: "priorConstraints",
      allowCustom: true,
    });
    expect(
      barriers?.questions[0].config.columns?.find(
        (column) => column.key === "expectedResult",
      ),
    ).toMatchObject({
      required: true,
      type: "long_text",
    });
    expect(
      barriers?.questions[0].config.columns?.find(
        (column) => column.key === "technologyType",
      ),
    ).toMatchObject({
      visibleWhen: {
        columnKey: "category",
        equals: "Технологический",
      },
      requiredWhen: {
        columnKey: "category",
        equals: "Технологический",
      },
    });
    expect(
      barriers?.questions[0].config.columns?.find(
        (column) => column.key === "otherType",
      ),
    ).toMatchObject({
      type: "suggest",
      allowCustom: true,
      options: [{ value: "Другой", label: "Другой" }],
      visibleWhen: {
        columnKey: "category",
        equals: "Иной",
      },
      requiredWhen: {
        columnKey: "category",
        equals: "Иной",
      },
    });
  });

  it("lets experts prioritize effects without forcing every category", async () => {
    const modules = await loadModuleDefinitions();
    const effects = modules.find((module) => module.slug === "effects");

    expect(effects?.questions.map((question) => question.key)).toEqual([
      "effects",
      "effect_materials",
    ]);
    expect(
      effects?.questions.some((question) => question.key === "assumptions"),
    ).toBe(false);
    expect(effects?.questions[0]).toMatchObject({
      required: true,
      config: {
        minRows: 3,
        maxRows: 15,
        sortableRows: true,
      },
    });
    expect(effects?.questions[0].config.requiredColumnValues).toBeUndefined();
    expect(
      effects?.questions[0].config.columns?.find(
        (column) => column.key === "quantitativeEstimate",
      ),
    ).toMatchObject({
      visibleWhen: {
        columnKey: "assessmentFormat",
        equals: "Количественная оценка",
      },
      requiredWhen: {
        columnKey: "assessmentFormat",
        equals: "Количественная оценка",
      },
    });
    expect(
      effects?.questions[0].config.columns?.find(
        (column) => column.key === "relatedBarriers",
      ),
    ).toMatchObject({
      contextKey: "acceptedBarriers",
      allowCustom: false,
    });
  });

  it("assesses international expansion for inherited Russian platforms", async () => {
    const modules = await loadModuleDefinitions();
    const international = modules.find(
      (module) => module.slug === "international",
    );

    expect(international?.questions.map((question) => question.key)).toEqual([
      "international_platforms",
      "international_materials",
    ]);
    expect(
      international?.questions.some(
        (question) =>
          question.key === "state_support" || question.key === "target_2036",
      ),
    ).toBe(false);
    expect(international?.questions[0]).toMatchObject({
      required: true,
      config: {
        minRows: 1,
        maxRows: 15,
        lockRows: true,
      },
    });
    expect(
      international?.questions[0].config.columns?.find(
        (column) => column.key === "platform",
      ),
    ).toMatchObject({
      type: "readonly",
      required: true,
    });
    expect(
      international?.questions[0].config.columns?.find(
        (column) => column.key === "countries",
      ),
    ).toMatchObject({
      visibleWhen: { columnKey: "presence", equals: "Да" },
      requiredWhen: { columnKey: "presence", equals: "Да" },
    });
    expect(
      international?.questions[0].config.columns?.find(
        (column) => column.key === "relatedEffects",
      ),
    ).toMatchObject({
      contextKey: "acceptedEffects",
      allowCustom: false,
    });
  });

  it("builds the final target model from accepted findings", async () => {
    const modules = await loadModuleDefinitions();
    const targetState = modules.find(
      (module) => module.slug === "target-state",
    );

    expect(targetState?.questions.map((question) => question.key)).toEqual([
      "target_transactions",
      "target_model",
      "recommendations",
      "disagreements",
      "final_materials",
    ]);
    expect(
      targetState?.questions.some((question) => question.key === "priorities"),
    ).toBe(false);
    expect(targetState?.questions[0]).toMatchObject({
      required: true,
      config: {
        minRows: 1,
        maxRows: 15,
        lockRows: true,
      },
    });
    expect(
      targetState?.questions[0].config.columns?.find(
        (column) => column.key === "targetParticipantShare",
      ),
    ).toMatchObject({
      type: "select",
      required: true,
    });
    expect(targetState?.questions[1]).toMatchObject({
      required: true,
      config: {
        minRows: 3,
        maxRows: 3,
        lockRows: true,
      },
    });
    expect(
      targetState?.questions[1].config.columns?.find(
        (column) => column.key === "linkedBarriers",
      ),
    ).toMatchObject({
      contextKey: "acceptedBarriers",
      allowCustom: false,
      requiredWhenAny: [
        {
          columnKey: "dimension",
          equals: "Распределение ролей государства и рынка",
        },
        {
          columnKey: "dimension",
          equals: "Архитектура доступа к данным, сервисам и платформам",
        },
      ],
    });
    expect(
      targetState?.questions[1].config.columns?.find(
        (column) => column.key === "linkedEffects",
      ),
    ).toMatchObject({
      contextKey: "acceptedEffects",
      allowCustom: false,
    });
    expect(
      targetState?.questions[1].config.columns?.find(
        (column) => column.key === "internationalConstraints",
      ),
    ).toMatchObject({
      contextKey: "internationalConstraints",
      requiredWhen: {
        columnKey: "dimension",
        equals: "Международное развитие российских платформ",
      },
    });
    expect(targetState?.questions[2]).toMatchObject({
      required: true,
      config: {
        minRows: 3,
        maxRows: 10,
        sortableRows: true,
      },
    });
    expect(
      targetState?.questions[2].config.columns?.find(
        (column) => column.key === "internationalPlatforms",
      ),
    ).toMatchObject({
      contextKey: "russianPlatforms",
      requiredWhen: {
        columnKey: "direction",
        equals: "Международная экспансия",
      },
    });
    expect(
      targetState?.questions[2].config.columns?.find(
        (column) => column.key === "internationalConstraints",
      ),
    ).toMatchObject({
      contextKey: "internationalConstraints",
      requiredWhen: {
        columnKey: "direction",
        equals: "Международная экспансия",
      },
    });
    expect(targetState?.questions[3]).toMatchObject({
      required: false,
      config: { minRows: 0 },
    });
  });
});
