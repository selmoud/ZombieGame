type AutoRowQuestion = {
  id: string;
  key: string;
  config: {
    autoRowsFromQuestionKey?: string;
    autoRowMappings?: Array<{
      sourceColumnKey: string;
      targetColumnKey: string;
      identity?: boolean;
    }>;
    columns?: Array<{ key: string; type: string; defaultValue?: string }>;
  };
};

function defaultRow(question: AutoRowQuestion) {
  return Object.fromEntries(
    (question.config.columns ?? []).map((column) => [
      column.key,
      column.defaultValue ?? (column.type === "multi_suggest" ? [] : ""),
    ]),
  );
}

export function synchronizeAutomaticTableRows(
  questions: AutoRowQuestion[],
  answers: Record<string, unknown>,
  changedSourceKey?: string,
) {
  let nextAnswers = answers;

  for (const targetQuestion of questions) {
    const sourceKey = targetQuestion.config.autoRowsFromQuestionKey;
    const mappings = targetQuestion.config.autoRowMappings ?? [];
    if (
      !sourceKey ||
      !mappings.length ||
      (changedSourceKey && changedSourceKey !== sourceKey)
    ) {
      continue;
    }
    const sourceQuestion = questions.find(
      (question) => question.key === sourceKey,
    );
    const sourceRows = sourceQuestion
      ? nextAnswers[sourceQuestion.id]
      : undefined;
    if (!Array.isArray(sourceRows)) continue;

    const storedRows = Array.isArray(nextAnswers[targetQuestion.id])
      ? (nextAnswers[targetQuestion.id] as Array<Record<string, unknown>>)
      : [];
    const rowKey = (
      row: Record<string, unknown>,
      side: "source" | "target",
    ) =>
      mappings
        .filter((mapping) => mapping.identity !== false)
        .map((mapping) =>
          String(
            row[
              side === "source"
                ? mapping.sourceColumnKey
                : mapping.targetColumnKey
            ] ?? "",
          )
            .trim()
            .toLocaleLowerCase("ru"),
        )
        .join("\u0000");
    const storedByKey = new Map(
      storedRows.map((row) => [rowKey(row, "target"), row]),
    );
    const generatedRows = sourceRows.flatMap((sourceRow) => {
      const typedSourceRow = sourceRow as Record<string, unknown>;
      const key = rowKey(typedSourceRow, "source");
      if (
        mappings.some(
          (mapping) => !typedSourceRow[mapping.sourceColumnKey],
        )
      ) {
        return [];
      }
      const generated = {
        ...defaultRow(targetQuestion),
        ...(storedByKey.get(key) ?? {}),
      };
      mappings.forEach((mapping) => {
        generated[mapping.targetColumnKey] =
          typedSourceRow[mapping.sourceColumnKey];
      });
      return [generated];
    });

    nextAnswers = {
      ...nextAnswers,
      [targetQuestion.id]: generatedRows,
    };
  }

  return nextAnswers;
}
