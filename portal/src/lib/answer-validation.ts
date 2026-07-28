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
  columns?: Array<{
    key: string;
    title: string;
    type: string;
    required?: boolean;
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
          (column) =>
            column.required &&
            isEmpty((row as Record<string, unknown>)?.[column.key]),
        ),
      );
      if (missing) {
        errors[question.id] = "Заполните обязательные ячейки таблицы";
      }
    }
  }

  return errors;
}
