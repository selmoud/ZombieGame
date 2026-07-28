import {
  matchesFieldCondition,
  type FieldCondition,
} from "./field-conditions";

export type QuestionForValidation = {
  id: string;
  key: string;
  type: string;
  title: string;
  required: boolean;
  config: unknown;
};

type Config = {
  min?: number;
  max?: number;
  minRows?: number;
  maxRows?: number;
  coverSourceQuestionKey?: string;
  coverSourceColumns?: string[];
  coverTargetColumns?: string[];
  columns?: Array<{
    key: string;
    title: string;
    type: string;
    required?: boolean;
    uniqueAcrossRows?: boolean;
    min?: number;
    max?: number;
    notBeforeColumnKey?: string;
    requiredWhen?: FieldCondition;
    visibleWhen?: FieldCondition;
  }>;
};

function isEmpty(value: unknown) {
  return (
    value === undefined ||
    value === null ||
    value === "" ||
    (Array.isArray(value) && value.length === 0)
  );
}

export function validateAnswers(
  questions: QuestionForValidation[],
  answers: Record<string, unknown>,
) {
  const errors: Record<string, string> = {};

  for (const question of questions) {
    const value = answers[question.id];
    const config = (question.config ?? {}) as Config;
    if (question.required && isEmpty(value)) {
      errors[question.id] = "Заполните обязательное поле";
      continue;
    }
    if (isEmpty(value)) continue;

    if (question.type === "LINK") {
      try {
        new URL(String(value));
      } catch {
        errors[question.id] = "Укажите полную ссылку, например https://…";
      }
    }

    if (question.type === "NUMBER" || question.type === "SCALE") {
      const number = Number(value);
      if (!Number.isFinite(number)) {
        errors[question.id] = "Введите число";
      } else if (
        (config.min !== undefined && number < config.min) ||
        (config.max !== undefined && number > config.max)
      ) {
        errors[question.id] = `Допустимое значение: ${config.min ?? "−∞"}–${config.max ?? "∞"}`;
      }
    }

    if (question.type === "TABLE") {
      if (!Array.isArray(value)) {
        errors[question.id] = "Некорректный формат таблицы";
        continue;
      }
      if (config.minRows !== undefined && value.length < config.minRows) {
        errors[question.id] = `Добавьте минимум ${config.minRows} строку`;
        continue;
      }
      if (config.maxRows !== undefined && value.length > config.maxRows) {
        errors[question.id] = `Допустимо не более ${config.maxRows} строк`;
        continue;
      }
      const missing = value.some((row) =>
        config.columns?.some(
          (column) => {
            const typedRow = row as Record<string, unknown>;
            const isVisible =
              !column.visibleWhen ||
              matchesFieldCondition(typedRow, column.visibleWhen);
            const isRequired =
              column.required ||
              (column.requiredWhen &&
                matchesFieldCondition(typedRow, column.requiredWhen));
            return isVisible && isRequired && isEmpty(typedRow?.[column.key]);
          },
        ),
      );
      if (missing) {
        errors[question.id] = "Заполните обязательные ячейки таблицы";
        continue;
      }
      const duplicateColumn = config.columns?.find((column) => {
        if (!column.uniqueAcrossRows) return false;
        const seen = new Set<string>();
        return value.some((row) => {
          const cellValue = (row as Record<string, unknown>)[column.key];
          if (isEmpty(cellValue)) return false;
          const normalized = String(cellValue).trim().toLocaleLowerCase("ru");
          if (seen.has(normalized)) return true;
          seen.add(normalized);
          return false;
        });
      });
      if (duplicateColumn) {
        errors[question.id] =
          `Значения в поле «${duplicateColumn.title}» не должны повторяться`;
        continue;
      }
      if (
        config.coverSourceQuestionKey &&
        config.coverSourceColumns?.length &&
        config.coverTargetColumns?.length === config.coverSourceColumns.length
      ) {
        const sourceQuestion = questions.find(
          (candidate) => candidate.key === config.coverSourceQuestionKey,
        );
        const sourceRows = sourceQuestion
          ? answers[sourceQuestion.id]
          : undefined;
        if (Array.isArray(sourceRows)) {
          const compositeKey = (
            row: Record<string, unknown>,
            columns: string[],
          ) =>
            columns
              .map((column) =>
                String(row[column] ?? "").trim().toLocaleLowerCase("ru"),
              )
              .join("\u0000");
          const covered = new Set(
            value.map((row) =>
              compositeKey(
                row as Record<string, unknown>,
                config.coverTargetColumns!,
              ),
            ),
          );
          const hasUncoveredSource = sourceRows.some(
            (row) =>
              !covered.has(
                compositeKey(
                  row as Record<string, unknown>,
                  config.coverSourceColumns!,
                ),
              ),
          );
          if (hasUncoveredSource) {
            errors[question.id] = "Оцените каждое добавленное действие";
            continue;
          }
        }
      }
      const invalidNumber = value.some((row) =>
        config.columns?.some((column) => {
          const typedRow = row as Record<string, unknown>;
          const cellValue = typedRow[column.key];
          const isVisible =
            !column.visibleWhen ||
            matchesFieldCondition(typedRow, column.visibleWhen);
          if (
            !isVisible ||
            column.type !== "number" ||
            isEmpty(cellValue)
          ) {
            return false;
          }
          const number = Number(cellValue);
          return (
            !Number.isFinite(number) ||
            (column.min !== undefined && number < column.min) ||
            (column.max !== undefined && number > column.max)
          );
        }),
      );
      if (invalidNumber) {
        errors[question.id] =
          "Проверьте числовые значения и допустимый диапазон";
        continue;
      }
      const invalidPeriod = value.some((row) =>
        config.columns?.some((column) => {
          if (!column.notBeforeColumnKey) return false;
          const typedRow = row as Record<string, unknown>;
          const currentValue = typedRow[column.key];
          const comparisonValue = typedRow[column.notBeforeColumnKey];
          return (
            !isEmpty(currentValue) &&
            !isEmpty(comparisonValue) &&
            Number(currentValue) < Number(comparisonValue)
          );
        }),
      );
      if (invalidPeriod) {
        errors[question.id] =
          "Год окончания этапа не может быть раньше года начала";
      }
    }
  }

  return errors;
}
