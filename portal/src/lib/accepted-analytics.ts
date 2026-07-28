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
  const segments = questionRows(submissions, 1, "industry_boundaries");
  const retrospective = questionRows(submissions, 1, "current_state");
  const metrics = questionRows(submissions, 1, "key_metrics");
  const macros = questionRows(submissions, 2, "macrotransactions");
  const assessments = questionRows(submissions, 2, "transaction_assessments");

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
          const factor = text(row.keyFactor);
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
          text(row.keyFactor) === factor &&
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

  return {
    segmentComparison,
    factors,
    priorityMetrics,
    routes,
    actionPriorities,
  };
}
