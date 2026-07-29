export type AnalyticsSubmission = {
  assignment: {
    module: { order: number };
    user?: { id: string; fullName: string };
  };
  answers: Array<{
    value: unknown;
    question: { key: string };
  }>;
};

type AnswerRow = Record<string, unknown> & {
  expertName?: string;
  submissionIndex?: number;
};

const SHARE_LABELS = [
  "—",
  "Нишевая — менее 5%",
  "Небольшая — 5–10%",
  "Заметная — 10–25%",
  "Крупная — 25–50%",
  "Доминирующая — более 50%",
];

const PLATFORM_SHARE_LABELS = [
  "—",
  "Менее 5%",
  "5–15%",
  "15–30%",
  "30–50%",
  "Более 50%",
];

function rows(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value)
    ? value.filter(
        (row): row is Record<string, unknown> =>
          typeof row === "object" && row !== null && !Array.isArray(row),
      )
    : [];
}

function text(value: unknown) {
  return String(value ?? "").trim();
}

export function deduplicateAnalyticsSubmissions(
  submissions: AnalyticsSubmission[],
) {
  const seen = new Set<string>();
  return submissions.filter((submission, index) => {
    const expertId = submission.assignment.user?.id;
    const key = expertId
      ? `${expertId}\u0000${submission.assignment.module.order}`
      : `submission-${index}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function questionRows(
  submissions: AnalyticsSubmission[],
  moduleOrder: number,
  questionKey: string,
): AnswerRow[] {
  return submissions.flatMap((submission, submissionIndex) => {
    if (submission.assignment.module.order !== moduleOrder) return [];
    const answer = submission.answers.find(
      (item) => item.question.key === questionKey,
    );
    return rows(answer?.value).map((row) => ({
      ...row,
      expertName: submission.assignment.user?.fullName,
      submissionIndex,
    }));
  });
}

function level(value: unknown) {
  const normalized = text(value).toLocaleLowerCase("ru");
  if (!normalized || normalized.includes("затрудняюсь")) return 0;
  if (normalized.includes("доминирующ") || normalized.includes("очень высок")) return 5;
  if (normalized.includes("крупн") || normalized.includes("высок")) return 4;
  if (normalized.includes("заметн") || normalized.includes("средн")) return 3;
  if (normalized.includes("небольш") || normalized.includes("низк")) return 2;
  if (normalized.includes("нишев") || normalized.includes("очень низк")) return 1;
  return 0;
}

function platformShareLevel(value: unknown) {
  const normalized = text(value).toLocaleLowerCase("ru");
  if (!normalized || normalized.includes("затрудняюсь")) return 0;
  if (normalized.includes("более 50")) return 5;
  if (normalized.includes("30–50") || normalized.includes("30-50")) return 4;
  if (normalized.includes("15–30") || normalized.includes("15-30")) return 3;
  if (normalized.includes("5–15") || normalized.includes("5-15")) return 2;
  if (normalized.includes("менее 5")) return 1;
  return level(value);
}

function costReductionLevel(value: unknown) {
  const normalized = text(value).toLocaleLowerCase("ru");
  if (!normalized || normalized.includes("затрудняюсь")) return 0;
  if (normalized.includes("более 50")) return 5;
  if (normalized.includes("25–50") || normalized.includes("25-50")) return 4;
  if (normalized.includes("10–25") || normalized.includes("10-25")) return 3;
  if (normalized.includes("менее 10")) return 2;
  if (normalized.includes("не ожидается")) return 1;
  return 0;
}

function executionLevel(value: unknown) {
  const normalized = text(value).toLocaleLowerCase("ru");
  if (normalized.includes("полностью автоматизировано")) return 5;
  if (normalized.includes("преимущественно автоматизировано")) return 4;
  if (normalized.includes("частично автоматизировано")) return 3;
  if (normalized.includes("преимущественно вручную")) return 2;
  if (normalized.includes("полностью вручную")) return 1;
  return 0;
}

function median(values: number[]) {
  const sorted = values.filter(Boolean).sort((a, b) => a - b);
  if (!sorted.length) return 0;
  return sorted[Math.floor((sorted.length - 1) / 2)];
}

function agreement(values: number[]) {
  const valid = values.filter(Boolean);
  if (valid.length < 2) return "Недостаточно оценок";
  const spread = Math.max(...valid) - Math.min(...valid);
  if (spread <= 1) return "Высокая";
  if (spread === 2) return "Средняя";
  return "Мнения расходятся";
}

function combinedAgreement(dimensions: number[][]) {
  const results = dimensions.map(agreement);
  if (results.includes("Мнения расходятся")) return "Мнения расходятся";
  if (results.includes("Средняя")) return "Средняя";
  if (results.includes("Высокая")) return "Высокая";
  return "Недостаточно оценок";
}

function influenceKind(value: unknown) {
  const normalized = text(value).toLocaleLowerCase("ru");
  if (normalized.includes("негатив")) return "negative";
  if (normalized.includes("позитив")) return "positive";
  return "neutral";
}

export function buildAcceptedAnalytics(submissions: AnalyticsSubmission[]) {
  const uniqueSubmissions = deduplicateAnalyticsSubmissions(submissions);
  const segments = questionRows(uniqueSubmissions, 1, "industry_boundaries");
  const retrospective = questionRows(uniqueSubmissions, 1, "current_state");
  const metrics = questionRows(uniqueSubmissions, 1, "key_metrics");
  const macros = questionRows(uniqueSubmissions, 2, "macrotransactions");
  const assessments = questionRows(
    uniqueSubmissions,
    2,
    "transaction_assessments",
  );

  const segmentNames = Array.from(
    new Set(
      segments
        .map((row) =>
          text(row.segment) === "Другое"
            ? text(row.customSegment)
            : text(row.segment),
        )
        .filter(Boolean),
    ),
  ).sort((a, b) => a.localeCompare(b, "ru"));

  const segmentComparison = segmentNames.map((name) => {
    const matching = segments.filter((row) => {
      const rowName =
        text(row.segment) === "Другое"
          ? text(row.customSegment)
          : text(row.segment);
      return rowName === name;
    });
    const activity = matching.map((row) => level(row.userActivityShare));
    const economy = matching.map((row) => level(row.economicShare));
    return {
      name,
      responses: new Set(matching.map((row) => row.submissionIndex)).size,
      activity: SHARE_LABELS[median(activity)],
      economy: SHARE_LABELS[median(economy)],
      agreement: combinedAgreement([activity, economy]),
      gap: median(activity) - median(economy),
      rationales: matching
        .map((row) => ({
          expert: text(row.expertName) || "Эксперт",
          value: text(row.assessmentRationale),
        }))
        .filter((item) => item.value),
    };
  });

  const factorKeys = Array.from(
    new Set(
      retrospective
        .map((row) => {
          const factor =
            text(row.keyFactor) === "Другое"
              ? text(row.customFactor)
              : text(row.keyFactor);
          const period = [text(row.startYear), text(row.endYear)]
            .filter(Boolean)
            .join("–");
          return factor ? `${factor}\u0000${period}` : "";
        })
        .filter(Boolean),
    ),
  );
  const factors = factorKeys
    .map((key) => {
      const [factor, period] = key.split("\u0000");
      const matching = retrospective.filter(
        (row) =>
          (text(row.keyFactor) === "Другое"
            ? text(row.customFactor)
            : text(row.keyFactor)) === factor &&
          [text(row.startYear), text(row.endYear)]
            .filter(Boolean)
            .join("–") === period,
      );
      return {
        factor,
        period,
        total: matching.length,
        negative: matching.filter(
          (row) => influenceKind(row.influence) === "negative",
        ).length,
        neutral: matching.filter(
          (row) => influenceKind(row.influence) === "neutral",
        ).length,
        positive: matching.filter(
          (row) => influenceKind(row.influence) === "positive",
        ).length,
      };
    })
    .sort((a, b) => b.total - a.total || a.factor.localeCompare(b.factor, "ru"));

  const metricMap = new Map<string, { selections: number; score: number }>();
  const metricRowsBySubmission = new Map<number, AnswerRow[]>();
  metrics.forEach((row) => {
    const key = row.submissionIndex ?? -1;
    metricRowsBySubmission.set(key, [
      ...(metricRowsBySubmission.get(key) ?? []),
      row,
    ]);
  });
  metricRowsBySubmission.forEach((items) => {
    items.forEach((row, index) => {
      const name = text(row.metric);
      if (!name) return;
      const current = metricMap.get(name) ?? { selections: 0, score: 0 };
      current.selections += 1;
      current.score += items.length - index;
      metricMap.set(name, current);
    });
  });
  const priorityMetrics = Array.from(metricMap, ([name, value]) => ({
    name,
    ...value,
  })).sort(
    (a, b) =>
      b.score - a.score ||
      b.selections - a.selections ||
      a.name.localeCompare(b.name, "ru"),
  );

  const routeMap = new Map<
    string,
    { initiator: string; recipient: string; type: string; count: number }
  >();
  macros.forEach((row) => {
    const initiator = text(row.initiator);
    const recipient = text(row.recipient);
    const type = text(row.transactionType);
    if (!initiator || !recipient) return;
    const key = `${initiator}\u0000${recipient}\u0000${type}`;
    const current = routeMap.get(key) ?? {
      initiator,
      recipient,
      type,
      count: 0,
    };
    current.count += 1;
    routeMap.set(key, current);
  });
  const routes = Array.from(routeMap.values()).sort(
    (a, b) => b.count - a.count,
  );

  const actionMap = new Map<
    string,
    {
      name: string;
      macro: string;
      count: number;
      totalScore: number;
      costSources: Map<string, number>;
    }
  >();
  assessments.forEach((row) => {
    const name = text(row.micro);
    if (!name) return;
    const standardization = level(row.standardization);
    const automation = executionLevel(row.executionMode);
    const parts = [
      level(row.frequency),
      level(row.repeatability),
      level(row.resourceIntensity),
      level(row.costLevel),
      standardization ? 6 - standardization : 0,
      automation ? 6 - automation : 0,
    ].filter(Boolean);
    const score = parts.length
      ? parts.reduce((sum, item) => sum + item, 0) / parts.length
      : 0;
    const key = `${text(row.macro)}\u0000${name}`;
    const current = actionMap.get(key) ?? {
      name,
      macro: text(row.macro),
      count: 0,
      totalScore: 0,
      costSources: new Map<string, number>(),
    };
    current.count += 1;
    current.totalScore += score;
    const sources = Array.isArray(row.costSources)
      ? row.costSources
      : [row.costSources];
    sources.map(text).filter(Boolean).forEach((source) => {
      current.costSources.set(
        source,
        (current.costSources.get(source) ?? 0) + 1,
      );
    });
    actionMap.set(key, current);
  });
  const actionPriorities = Array.from(actionMap.values())
    .map((action) => {
      const score = action.count ? action.totalScore / action.count : 0;
      return {
        name: action.name,
        macro: action.macro,
        responses: action.count,
        score,
        priority: score >= 4 ? "Высокий" : score >= 3 ? "Средний" : "Низкий",
        costSources: Array.from(action.costSources, ([name, count]) => ({
          name,
          count,
        })).sort((a, b) => b.count - a.count),
      };
    })
    .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name, "ru"));

  const platformRows = questionRows(uniqueSubmissions, 3, "platforms");
  const penetrationRows = questionRows(
    uniqueSubmissions,
    3,
    "platform_penetration",
  );
  const platformMap = new Map<
    string,
    { name: string; mentions: number; types: Set<string> }
  >();
  platformRows.forEach((row) => {
    const name = text(row.name);
    if (!name) return;
    const current = platformMap.get(name) ?? {
      name,
      mentions: 0,
      types: new Set<string>(),
    };
    current.mentions += 1;
    if (text(row.type)) current.types.add(text(row.type));
    platformMap.set(name, current);
  });
  const platforms = Array.from(platformMap.values())
    .map((item) => ({
      name: item.name,
      mentions: item.mentions,
      types: Array.from(item.types).sort((a, b) => a.localeCompare(b, "ru")),
    }))
    .sort((a, b) => b.mentions - a.mentions || a.name.localeCompare(b.name, "ru"));

  const penetrationMacros = Array.from(
    new Set(penetrationRows.map((row) => text(row.macro)).filter(Boolean)),
  );
  const platformPenetration = penetrationMacros
    .map((macro) => {
      const matching = penetrationRows.filter(
        (row) => text(row.macro) === macro,
      );
      const values = matching.map((row) => platformShareLevel(row.share));
      return {
        macro,
        responses: new Set(matching.map((row) => row.submissionIndex)).size,
        share: PLATFORM_SHARE_LABELS[median(values)],
        agreement: agreement(values),
      };
    })
    .sort((a, b) => a.macro.localeCompare(b.macro, "ru"));

  const architectureRows = [
    ...questionRows(uniqueSubmissions, 4, "data_access"),
    ...questionRows(uniqueSubmissions, 4, "user_access"),
  ];
  const architectureMap = new Map<string, number>();
  architectureRows.forEach((row) => {
    const restrictions = Array.isArray(row.restrictions)
      ? row.restrictions
      : [row.restrictions];
    restrictions
      .map(text)
      .filter(
        (value) =>
          value &&
          !value.toLocaleLowerCase("ru").includes("не выявлено"),
      )
      .forEach((value) =>
        architectureMap.set(value, (architectureMap.get(value) ?? 0) + 1),
      );
  });
  const architectureConstraints = Array.from(
    architectureMap,
    ([name, mentions]) => ({ name, mentions }),
  ).sort(
    (a, b) =>
      b.mentions - a.mentions || a.name.localeCompare(b.name, "ru"),
  );

  const barrierRows = questionRows(uniqueSubmissions, 5, "barriers");
  const barrierCategories = Array.from(
    barrierRows.reduce((map, row) => {
      const category = text(row.category);
      if (category) map.set(category, (map.get(category) ?? 0) + 1);
      return map;
    }, new Map<string, number>()),
    ([category, mentions]) => ({ category, mentions }),
  ).sort((a, b) => b.mentions - a.mentions);
  const barrierNames = Array.from(
    barrierRows.reduce((map, row) => {
      const name = text(row.name);
      if (name) map.set(name, (map.get(name) ?? 0) + 1);
      return map;
    }, new Map<string, number>()),
    ([name, mentions]) => ({ name, mentions }),
  ).sort(
    (a, b) =>
      b.mentions - a.mentions || a.name.localeCompare(b.name, "ru"),
  );

  const effectRows = questionRows(uniqueSubmissions, 6, "effects");
  const effectCategories = Array.from(
    effectRows.reduce((map, row) => {
      const category = text(row.category);
      if (category) map.set(category, (map.get(category) ?? 0) + 1);
      return map;
    }, new Map<string, number>()),
    ([category, mentions]) => ({ category, mentions }),
  ).sort((a, b) => b.mentions - a.mentions);
  const effectStatuses = Array.from(
    effectRows.reduce((map, row) => {
      const status = text(row.status);
      if (status) map.set(status, (map.get(status) ?? 0) + 1);
      return map;
    }, new Map<string, number>()),
    ([status, mentions]) => ({ status, mentions }),
  ).sort((a, b) => b.mentions - a.mentions);

  const internationalRows = questionRows(
    uniqueSubmissions,
    7,
    "international_platforms",
  );
  const internationalPlatforms = Array.from(
    new Set(internationalRows.map((row) => text(row.platform)).filter(Boolean)),
  )
    .map((platform) => {
      const matching = internationalRows.filter(
        (row) => text(row.platform) === platform,
      );
      const potentials = matching.map((row) => level(row.potential));
      const constraintMap = new Map<string, number>();
      const marketMap = new Map<string, number>();
      matching.forEach((row) => {
        (Array.isArray(row.constraints) ? row.constraints : [row.constraints])
          .map(text)
          .filter(Boolean)
          .forEach((value) =>
            constraintMap.set(value, (constraintMap.get(value) ?? 0) + 1),
          );
        (Array.isArray(row.targetMarkets)
          ? row.targetMarkets
          : [row.targetMarkets]
        )
          .map(text)
          .filter(Boolean)
          .forEach((value) =>
            marketMap.set(value, (marketMap.get(value) ?? 0) + 1),
          );
      });
      return {
        platform,
        responses: new Set(matching.map((row) => row.submissionIndex)).size,
        potential: SHARE_LABELS[median(potentials)]
          ?.replace("Доминирующая — более 50%", "Очень высокий")
          .replace("Крупная — 25–50%", "Высокий")
          .replace("Заметная — 10–25%", "Средний")
          .replace("Небольшая — 5–10%", "Низкий")
          .replace("Нишевая — менее 5%", "Очень низкий"),
        agreement: agreement(potentials),
        constraints: Array.from(constraintMap, ([name, mentions]) => ({
          name,
          mentions,
        })).sort((a, b) => b.mentions - a.mentions),
        markets: Array.from(marketMap, ([name, mentions]) => ({
          name,
          mentions,
        })).sort((a, b) => b.mentions - a.mentions),
      };
    })
    .sort((a, b) => a.platform.localeCompare(b.platform, "ru"));

  const targetRows = questionRows(
    uniqueSubmissions,
    8,
    "target_transactions",
  );
  const targetMacros = Array.from(
    new Set(targetRows.map((row) => text(row.macro)).filter(Boolean)),
  );
  const targetTransactions = targetMacros
    .map((macro) => {
      const matching = targetRows.filter((row) => text(row.macro) === macro);
      const transactionShares = matching.map((row) =>
        platformShareLevel(row.targetShare),
      );
      const participantShares = matching.map((row) =>
        platformShareLevel(row.targetParticipantShare),
      );
      const costReductions = matching.map((row) =>
        costReductionLevel(row.costReduction),
      );
      return {
        macro,
        responses: new Set(matching.map((row) => row.submissionIndex)).size,
        transactionShare: PLATFORM_SHARE_LABELS[median(transactionShares)],
        participantShare: PLATFORM_SHARE_LABELS[median(participantShares)],
        costReduction:
          ["—", "Не ожидается", "Менее 10%", "10–25%", "25–50%", "Более 50%"][
            median(costReductions)
          ],
        agreement: combinedAgreement([
          transactionShares,
          participantShares,
          costReductions,
        ]),
      };
    })
    .sort((a, b) => a.macro.localeCompare(b.macro, "ru"));

  const recommendationRows = questionRows(
    uniqueSubmissions,
    8,
    "recommendations",
  );
  const recommendationDirections = Array.from(
    recommendationRows.reduce((map, row) => {
      const direction = text(row.direction);
      if (direction) map.set(direction, (map.get(direction) ?? 0) + 1);
      return map;
    }, new Map<string, number>()),
    ([direction, mentions]) => ({ direction, mentions }),
  ).sort((a, b) => b.mentions - a.mentions);

  return {
    segmentComparison,
    factors,
    priorityMetrics,
    routes,
    actionPriorities,
    platforms,
    platformPenetration,
    architectureConstraints,
    barrierCategories,
    barrierNames,
    effectCategories,
    effectStatuses,
    internationalPlatforms,
    targetTransactions,
    recommendationDirections,
  };
}
