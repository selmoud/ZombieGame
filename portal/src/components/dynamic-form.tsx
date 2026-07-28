"use client";

import { useEffect, useRef, useState } from "react";

type Option = { value: string; label: string };
type Column = {
  key: string;
  title: string;
  type: string;
  required?: boolean;
  options?: Option[];
  min?: number;
  max?: number;
};
type Question = {
  id: string;
  key: string;
  type: string;
  title: string;
  description: string | null;
  required: boolean;
  config: {
    options?: Option[];
    min?: number;
    max?: number;
    minRows?: number;
    maxRows?: number;
    columns?: Column[];
  };
};

function InlineField({
  column,
  value,
  disabled,
  onChange,
}: {
  column: Column;
  value: unknown;
  disabled: boolean;
  onChange: (value: unknown) => void;
}) {
  if (column.type === "select") {
    return (
      <select
        className="field"
        value={String(value ?? "")}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
      >
        <option value="">Выберите</option>
        {column.options?.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    );
  }
  if (column.type === "long_text") {
    return (
      <textarea
        className="field min-h-24 resize-y"
        value={String(value ?? "")}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
      />
    );
  }
  if (column.type === "scale") {
    return (
      <select
        className="field"
        value={String(value ?? "")}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
      >
        <option value="">—</option>
        {Array.from(
          { length: (column.max ?? 5) - (column.min ?? 1) + 1 },
          (_, index) => (column.min ?? 1) + index,
        ).map((number) => (
          <option key={number} value={number}>
            {number}
          </option>
        ))}
      </select>
    );
  }
  return (
    <input
      className="field"
      type={column.type === "number" ? "number" : column.type === "link" ? "url" : "text"}
      value={String(value ?? "")}
      disabled={disabled}
      onChange={(event) => onChange(event.target.value)}
    />
  );
}

function TableField({
  question,
  value,
  disabled,
  onChange,
}: {
  question: Question;
  value: unknown;
  disabled: boolean;
  onChange: (value: unknown) => void;
}) {
  const rows = Array.isArray(value) ? (value as Array<Record<string, unknown>>) : [];
  const columns = question.config.columns ?? [];

  function addRow() {
    onChange([...rows, Object.fromEntries(columns.map((column) => [column.key, ""]))]);
  }
  function updateRow(index: number, key: string, cellValue: unknown) {
    onChange(
      rows.map((row, rowIndex) =>
        rowIndex === index ? { ...row, [key]: cellValue } : row,
      ),
    );
  }

  return (
    <div className="space-y-3">
      {rows.map((row, rowIndex) => (
        <div
          key={rowIndex}
          className="rounded-xl border border-neutral-200 bg-neutral-50/70 p-4"
        >
          <div className="mb-4 flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
              Строка {rowIndex + 1}
            </span>
            {!disabled && (
              <button
                type="button"
                onClick={() => onChange(rows.filter((_, index) => index !== rowIndex))}
                className="text-xs font-semibold text-[#C80058] hover:text-[#8F003F]"
              >
                Удалить
              </button>
            )}
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            {columns.map((column) => (
              <label
                key={column.key}
                className={column.type === "long_text" ? "lg:col-span-2" : ""}
              >
                <span className="mb-1.5 block text-xs font-medium text-neutral-600">
                  {column.title}
                  {column.required && <span className="text-[#C80058]"> *</span>}
                </span>
                <InlineField
                  column={column}
                  value={row[column.key]}
                  disabled={disabled}
                  onChange={(cellValue) =>
                    updateRow(rowIndex, column.key, cellValue)
                  }
                />
              </label>
            ))}
          </div>
        </div>
      ))}
      {!disabled &&
        (question.config.maxRows === undefined ||
          rows.length < question.config.maxRows) && (
          <button
            type="button"
            onClick={addRow}
            className="rounded-lg border border-dashed border-[#0059C7] px-4 py-2.5 text-sm font-semibold text-[#0059C7] hover:bg-[#DDF8FB]"
          >
            + Добавить строку
          </button>
        )}
      {!rows.length && disabled && (
        <p className="text-sm italic text-neutral-400">Нет данных</p>
      )}
    </div>
  );
}

export function DynamicForm({
  assignmentId,
  questions,
  initialAnswers,
  initialRevision,
  initialStatus,
}: {
  assignmentId: string;
  questions: Question[];
  initialAnswers: Record<string, unknown>;
  initialRevision: number;
  initialStatus: string;
}) {
  const [answers, setAnswers] = useState(initialAnswers);
  const [revision, setRevision] = useState(initialRevision);
  const [status, setStatus] = useState(initialStatus);
  const [saveState, setSaveState] = useState<"saved" | "saving" | "dirty" | "error">("saved");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState("");
  const revisionRef = useRef(initialRevision);
  const firstRender = useRef(true);
  const readOnly = !["NOT_STARTED", "DRAFT", "NEEDS_REVISION"].includes(status);

  async function saveDraft(snapshot = answers) {
    if (readOnly) return revisionRef.current;
    setSaveState("saving");
    const response = await fetch(`/api/assignments/${assignmentId}/draft`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ revision: revisionRef.current, answers: snapshot }),
    });
    if (response.status === 409) {
      setSaveState("error");
      setMessage("Черновик изменился в другой вкладке. Обновите страницу.");
      throw new Error("Revision conflict");
    }
    if (!response.ok) {
      setSaveState("error");
      setMessage("Не удалось сохранить. Проверьте соединение.");
      throw new Error("Save failed");
    }
    const result = (await response.json()) as { revision: number; status: string };
    revisionRef.current = result.revision;
    setRevision(result.revision);
    setStatus(result.status);
    setSaveState("saved");
    setMessage("");
    return result.revision;
  }

  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    if (readOnly) return;
    const timeout = window.setTimeout(() => {
      saveDraft(answers).catch(() => undefined);
    }, 1200);
    return () => window.clearTimeout(timeout);
    // revision is intentionally managed through revisionRef
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [answers, readOnly]);

  function setAnswer(questionId: string, value: unknown) {
    setSaveState("dirty");
    setAnswers((current) => ({ ...current, [questionId]: value }));
    setErrors((current) => {
      const next = { ...current };
      delete next[questionId];
      return next;
    });
  }

  async function uploadFile(questionId: string, file: File) {
    setSaveState("saving");
    const formData = new FormData();
    formData.set("assignmentId", assignmentId);
    formData.set("questionId", questionId);
    formData.set("file", file);
    const response = await fetch("/api/attachments", {
      method: "POST",
      body: formData,
    });
    if (!response.ok) {
      setSaveState("error");
      setMessage("Файл не загружен. Допустимы PDF, DOCX, XLSX, PNG и JPG.");
      return;
    }
    const result = (await response.json()) as { value: unknown };
    setAnswer(questionId, result.value);
    setSaveState("saved");
  }

  async function submit() {
    setMessage("");
    try {
      await saveDraft();
      const response = await fetch(`/api/assignments/${assignmentId}/submit`, {
        method: "POST",
      });
      const result = (await response.json()) as {
        error?: string;
        fields?: Record<string, string>;
      };
      if (response.status === 422) {
        setErrors(result.fields ?? {});
        setMessage("Проверьте обязательные поля.");
        document
          .querySelector("[data-field-error='true']")
          ?.scrollIntoView({ behavior: "smooth", block: "center" });
        return;
      }
      if (!response.ok) throw new Error(result.error);
      setStatus("SUBMITTED");
      setMessage("Ответ отправлен администратору.");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch {
      if (!message) setMessage("Не удалось отправить ответ.");
    }
  }

  return (
    <div>
      <div className="sticky top-3 z-20 mb-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-neutral-200 bg-white/95 px-4 py-3 shadow-sm backdrop-blur">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-neutral-400">
            Состояние черновика
          </p>
          <p className="mt-0.5 text-sm font-semibold text-neutral-700">
            {readOnly
              ? status === "ACCEPTED"
                ? "Ответ принят"
                : "Ответ отправлен"
              : saveState === "saving"
                ? "Сохраняем…"
                : saveState === "dirty"
                  ? "Есть изменения"
                  : saveState === "error"
                    ? "Ошибка сохранения"
                    : "Все изменения сохранены"}
            <span className="ml-2 text-xs font-normal text-neutral-400">
              версия {revision}
            </span>
          </p>
        </div>
        {!readOnly && (
          <button
            type="button"
            onClick={() => saveDraft().catch(() => undefined)}
            className="ml-auto shrink-0 rounded-lg border border-neutral-300 px-4 py-2 text-sm font-semibold text-[#000000] hover:bg-neutral-50"
          >
            Сохранить черновик
          </button>
        )}
      </div>

      {message && (
        <div
          className={`mb-5 rounded-xl border px-4 py-3 text-sm ${
            message.includes("отправлен")
              ? "border-[#7EE0EC] bg-[#DDF8FB] text-[#00616C]"
              : "border-[#D8B1F5] bg-[#F1E5FB] text-[#6815A8]"
          }`}
        >
          {message}
        </div>
      )}

      <div className="space-y-5">
        {questions.map((question, index) => {
          const value = answers[question.id];
          const error = errors[question.id];
          return (
            <section
              key={question.id}
              data-field-error={error ? "true" : undefined}
              className={`rounded-2xl border bg-white p-5 sm:p-6 ${
                error ? "border-[#FF78B0]" : "border-neutral-200"
              }`}
            >
              <div className="mb-4 flex gap-3">
                <span className="grid size-7 shrink-0 place-items-center rounded-full bg-neutral-100 text-xs font-semibold text-neutral-500">
                  {index + 1}
                </span>
                <div>
                  <h3 className="font-semibold text-[#000000]">
                    {question.title}
                    {question.required && <span className="text-[#C80058]"> *</span>}
                  </h3>
                  {question.description && (
                    <p className="mt-1 text-sm leading-6 text-neutral-500">
                      {question.description}
                    </p>
                  )}
                </div>
              </div>

              {question.type === "TABLE" ? (
                <TableField
                  question={question}
                  value={value}
                  disabled={readOnly}
                  onChange={(next) => setAnswer(question.id, next)}
                />
              ) : question.type === "LONG_TEXT" ? (
                <textarea
                  className="field min-h-36 resize-y"
                  value={String(value ?? "")}
                  disabled={readOnly}
                  onChange={(event) => setAnswer(question.id, event.target.value)}
                />
              ) : question.type === "SELECT" ? (
                <select
                  className="field"
                  value={String(value ?? "")}
                  disabled={readOnly}
                  onChange={(event) => setAnswer(question.id, event.target.value)}
                >
                  <option value="">Выберите вариант</option>
                  {question.config.options?.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              ) : question.type === "SCALE" ? (
                <div className="flex flex-wrap gap-2">
                  {Array.from(
                    {
                      length:
                        (question.config.max ?? 5) -
                        (question.config.min ?? 1) +
                        1,
                    },
                    (_, itemIndex) => (question.config.min ?? 1) + itemIndex,
                  ).map((number) => (
                    <button
                      type="button"
                      key={number}
                      disabled={readOnly}
                      onClick={() => setAnswer(question.id, number)}
                      className={`size-11 rounded-lg border font-semibold ${
                        Number(value) === number
                          ? "border-[#0059C7] bg-[#0059C7] text-white"
                          : "border-neutral-300 bg-white text-neutral-600"
                      }`}
                    >
                      {number}
                    </button>
                  ))}
                </div>
              ) : question.type === "FILE" ? (
                <div>
                  {typeof value === "object" && value && "id" in value ? (
                    <a
                      href={`/api/attachments/${String((value as { id: unknown }).id)}`}
                      className="inline-flex rounded-lg bg-neutral-100 px-4 py-2.5 text-sm font-semibold text-[#000000]"
                    >
                      ↓ {String((value as { name?: unknown }).name ?? "Скачать файл")}
                    </a>
                  ) : null}
                  {!readOnly && (
                    <input
                      className="mt-3 block text-sm text-neutral-600"
                      type="file"
                      accept=".pdf,.docx,.xlsx,.png,.jpg,.jpeg"
                      onChange={(event) => {
                        const file = event.target.files?.[0];
                        if (file) uploadFile(question.id, file);
                      }}
                    />
                  )}
                </div>
              ) : (
                <input
                  className="field"
                  type={
                    question.type === "NUMBER"
                      ? "number"
                      : question.type === "LINK"
                        ? "url"
                        : "text"
                  }
                  value={String(value ?? "")}
                  disabled={readOnly}
                  onChange={(event) => setAnswer(question.id, event.target.value)}
                />
              )}
              {error && <p className="mt-2 text-sm font-medium text-[#C80058]">{error}</p>}
            </section>
          );
        })}
      </div>

      {!readOnly && (
        <div className="mt-6 flex flex-col items-start justify-between gap-4 rounded-2xl bg-[#000000] p-6 text-white sm:flex-row sm:items-center">
          <div>
            <h3 className="text-xl">Раздел заполнен?</h3>
            <p className="mt-1 text-sm text-neutral-300">
              После отправки редактирование будет недоступно до возврата на доработку.
            </p>
          </div>
          <button
            type="button"
            onClick={submit}
            className="shrink-0 rounded-xl bg-[#8125C8] px-6 py-3 font-semibold text-white hover:bg-[#0059C7]"
          >
            Отправить на проверку
          </button>
        </div>
      )}
    </div>
  );
}
