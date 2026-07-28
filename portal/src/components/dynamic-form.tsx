"use client";

import { useEffect, useId, useRef, useState } from "react";

type Option = { value: string; label: string };
type Column = {
  key: string;
  title: string;
  description?: string;
  type: string;
  required?: boolean;
  options?: Option[];
  allowCustom?: boolean;
  defaultValue?: string;
  excludeColumnKey?: string;
  excludeOptionValues?: string[];
  fullWidth?: boolean;
  lastOptionValue?: string;
  notBeforeColumnKey?: string;
  optionsFromColumnKey?: string;
  requiredWhen?: { columnKey: string; equals: string };
  sortOptions?: boolean;
  sourceQuestionKey?: string;
  sourceColumnKey?: string;
  sourceLabelSuffix?: string;
  visibleWhen?: { columnKey: string; equals: string };
  min?: number;
  max?: number;
  step?: number;
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
    fixedRows?: number;
    addRowLabel?: string;
    numberRows?: boolean;
    rowLabel?: string;
    columns?: Column[];
  };
};

function SearchableSelect({
  value,
  options,
  allowCustom = true,
  disabled,
  onChange,
}: {
  value: unknown;
  options: Option[];
  allowCustom?: boolean;
  disabled: boolean;
  onChange: (value: string) => void;
}) {
  const currentValue = String(value ?? "");
  const displayValue =
    options.find((option) => option.value === currentValue)?.label ??
    currentValue;
  const [searchQuery, setSearchQuery] = useState<string | null>(null);
  const inputValue = allowCustom ? displayValue : searchQuery ?? displayValue;
  const listboxId = useId();
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const filteredOptions = options.filter((option) =>
    option.label.toLocaleLowerCase("ru").includes(
      inputValue.toLocaleLowerCase("ru"),
    ),
  );

  function selectOption(option: Option) {
    setSearchQuery(null);
    onChange(option.value);
    setIsOpen(false);
    setActiveIndex(0);
  }

  return (
    <div className="relative">
      <input
        className={`field ${currentValue && !disabled ? "pr-16" : "pr-10"}`}
        value={inputValue}
        disabled={disabled}
        autoComplete="off"
        role="combobox"
        aria-autocomplete="list"
        aria-controls={listboxId}
        aria-expanded={isOpen}
        placeholder="Начните вводить"
        onFocus={(event) => {
          event.currentTarget.select();
          setIsOpen(true);
        }}
        onBlur={() => {
          setIsOpen(false);
          setSearchQuery(null);
        }}
        onChange={(event) => {
          if (allowCustom) {
            onChange(event.target.value);
          } else {
            setSearchQuery(event.target.value);
            if (!event.target.value) onChange("");
          }
          setActiveIndex(0);
          setIsOpen(true);
        }}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown") {
            event.preventDefault();
            setIsOpen(true);
            setActiveIndex((current) =>
              Math.min(current + 1, Math.max(filteredOptions.length - 1, 0)),
            );
          } else if (event.key === "ArrowUp") {
            event.preventDefault();
            setActiveIndex((current) => Math.max(current - 1, 0));
          } else if (event.key === "Enter" && isOpen && filteredOptions.length) {
            event.preventDefault();
            selectOption(filteredOptions[activeIndex] ?? filteredOptions[0]);
          } else if (event.key === "Escape") {
            setIsOpen(false);
          }
        }}
      />
      {currentValue && !disabled && (
        <button
          type="button"
          aria-label="Очистить поле"
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => {
            setSearchQuery(null);
            setIsOpen(false);
            onChange("");
          }}
          className="absolute right-8 top-1/2 flex size-7 -translate-y-1/2 items-center justify-center text-lg leading-none text-neutral-400 hover:text-[#FF2F86]"
        >
          ×
        </button>
      )}
      <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-neutral-400">
        ▾
      </span>
      {isOpen && !disabled && filteredOptions.length > 0 && (
        <div
          id={listboxId}
          role="listbox"
          className="absolute z-30 mt-1 max-h-56 w-full overflow-y-auto rounded-xl border border-neutral-200 bg-white p-1 shadow-xl"
        >
          {filteredOptions.map((option, index) => (
            <button
              key={`${option.value}-${index}`}
              type="button"
              role="option"
              aria-selected={index === activeIndex}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => selectOption(option)}
              className={`block w-full rounded-lg px-3 py-2 text-left text-sm ${
                index === activeIndex
                  ? "bg-[#E0EEFF] text-[#0059C7]"
                  : "text-neutral-700 hover:bg-neutral-50"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function MultiSearchableSelect({
  value,
  options,
  allowCustom = true,
  disabled,
  onChange,
}: {
  value: unknown;
  options: Option[];
  allowCustom?: boolean;
  disabled: boolean;
  onChange: (value: string[]) => void;
}) {
  const selected = Array.isArray(value)
    ? value.map(String)
    : value
      ? [String(value)]
      : [];
  const listboxId = useId();
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const filteredOptions = options.filter(
    (option) =>
      !selected.includes(option.value) &&
      option.label
        .toLocaleLowerCase("ru")
        .includes(query.toLocaleLowerCase("ru")),
  );

  function addValue(nextValue: string) {
    const normalized = nextValue.trim();
    if (!normalized || selected.includes(normalized)) return;
    onChange([...selected, normalized]);
    setQuery("");
    setActiveIndex(0);
    setIsOpen(true);
  }

  return (
    <div className="relative">
      <div
        className={`field flex min-h-12 flex-wrap items-center gap-2 ${
          disabled ? "bg-[#F4F4F4]" : ""
        }`}
      >
        {selected.map((item) => {
          const label =
            options.find((option) => option.value === item)?.label ?? item;
          return (
            <span
              key={item}
              className="inline-flex items-center gap-1 rounded-full bg-[#E0EEFF] px-2.5 py-1 text-xs font-semibold text-[#0059C7]"
            >
              {label}
              {!disabled && (
                <button
                  type="button"
                  aria-label={`Удалить ${label}`}
                  onClick={() =>
                    onChange(selected.filter((selectedItem) => selectedItem !== item))
                  }
                  className="text-base leading-none text-[#0059C7]"
                >
                  ×
                </button>
              )}
            </span>
          );
        })}
        {!disabled && (
          <input
            className="min-w-32 flex-1 border-0 bg-transparent py-1 text-sm outline-none"
            value={query}
            autoComplete="off"
            role="combobox"
            aria-autocomplete="list"
            aria-controls={listboxId}
            aria-expanded={isOpen}
            placeholder={selected.length ? "Добавить ещё" : "Начните вводить"}
            onFocus={() => setIsOpen(true)}
            onBlur={() => setIsOpen(false)}
            onChange={(event) => {
              setQuery(event.target.value);
              setActiveIndex(0);
              setIsOpen(true);
            }}
            onKeyDown={(event) => {
              if (event.key === "ArrowDown") {
                event.preventDefault();
                setIsOpen(true);
                setActiveIndex((current) =>
                  Math.min(
                    current + 1,
                    Math.max(filteredOptions.length - 1, 0),
                  ),
                );
              } else if (event.key === "ArrowUp") {
                event.preventDefault();
                setActiveIndex((current) => Math.max(current - 1, 0));
              } else if (event.key === "Enter") {
                event.preventDefault();
                if (isOpen && filteredOptions.length) {
                  addValue(
                    (filteredOptions[activeIndex] ?? filteredOptions[0]).value,
                  );
                } else if (allowCustom) {
                  addValue(query);
                }
              } else if (event.key === "Backspace" && !query && selected.length) {
                onChange(selected.slice(0, -1));
              } else if (event.key === "Escape") {
                setIsOpen(false);
              }
            }}
          />
        )}
      </div>
      {isOpen && !disabled && filteredOptions.length > 0 && (
        <div
          id={listboxId}
          role="listbox"
          className="absolute z-30 mt-1 max-h-56 w-full overflow-y-auto rounded-xl border border-neutral-200 bg-white p-1 shadow-xl"
        >
          {filteredOptions.map((option, index) => (
            <button
              key={`${option.value}-${index}`}
              type="button"
              role="option"
              aria-selected={index === activeIndex}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => addValue(option.value)}
              className={`block w-full rounded-lg px-3 py-2 text-left text-sm ${
                index === activeIndex
                  ? "bg-[#E0EEFF] text-[#0059C7]"
                  : "text-neutral-700 hover:bg-neutral-50"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function InlineField({
  column,
  value,
  suggestions,
  disabled,
  onChange,
}: {
  column: Column;
  value: unknown;
  suggestions: Option[];
  disabled: boolean;
  onChange: (value: unknown) => void;
}) {
  if (column.type === "readonly") {
    return (
      <input
        className="field cursor-not-allowed bg-neutral-100 font-medium text-neutral-600"
        value={String(value || column.defaultValue || "")}
        disabled
        readOnly
      />
    );
  }
  if (column.type === "suggest") {
    return (
      <SearchableSelect
        value={value}
        options={suggestions}
        allowCustom={column.allowCustom}
        disabled={disabled}
        onChange={onChange}
      />
    );
  }
  if (column.type === "multi_suggest") {
    return (
      <MultiSearchableSelect
        value={value}
        options={suggestions}
        allowCustom={column.allowCustom}
        disabled={disabled}
        onChange={onChange}
      />
    );
  }
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
      min={column.type === "number" ? column.min : undefined}
      max={column.type === "number" ? column.max : undefined}
      step={column.type === "number" ? column.step ?? "any" : undefined}
      value={String(value ?? "")}
      disabled={disabled}
      onChange={(event) => onChange(event.target.value)}
    />
  );
}

function TableField({
  question,
  questions,
  answers,
  value,
  disabled,
  onChange,
}: {
  question: Question;
  questions: Question[];
  answers: Record<string, unknown>;
  value: unknown;
  disabled: boolean;
  onChange: (value: unknown) => void;
}) {
  const columns = question.config.columns ?? [];

  function createDefaultRow() {
    return Object.fromEntries(
      columns.map((column) => [
        column.key,
        column.defaultValue ??
          (column.type === "multi_suggest" ? [] : ""),
      ]),
    );
  }

  const storedRows = Array.isArray(value)
    ? (value as Array<Record<string, unknown>>)
    : [];
  const rows =
    storedRows.length || !question.config.fixedRows
      ? storedRows
      : Array.from(
          { length: question.config.fixedRows },
          () => createDefaultRow(),
        );

  function sortSuggestions(options: Option[], column: Column) {
    return [...options].sort((left, right) => {
      if (left.value === column.lastOptionValue) return 1;
      if (right.value === column.lastOptionValue) return -1;
      return left.label.localeCompare(right.label, "ru");
    });
  }

  function getSuggestions(
    column: Column,
    row: Record<string, unknown>,
  ) {
    const optionSource =
      columns.find((item) => item.key === column.optionsFromColumnKey) ??
      column;
    const staticOptions = column.options ?? optionSource.options ?? [];
    const sourceQuestionKey =
      column.sourceQuestionKey ?? optionSource.sourceQuestionKey;
    const sourceColumnKey =
      column.sourceColumnKey ?? optionSource.sourceColumnKey;
    const sourceLabelSuffix =
      column.sourceLabelSuffix ?? optionSource.sourceLabelSuffix;
    let combined = [...staticOptions];

    if (sourceQuestionKey && sourceColumnKey) {
      const sourceQuestion = questions.find(
        (item) => item.key === sourceQuestionKey,
      );
      const sourceRows = sourceQuestion
        ? answers[sourceQuestion.id]
        : undefined;
      const linkedValues = Array.isArray(sourceRows)
        ? sourceRows.flatMap((sourceRow) => {
            const sourceValue = (sourceRow as Record<string, unknown>)[
              sourceColumnKey
            ];
            return Array.isArray(sourceValue)
              ? sourceValue.map(String)
              : sourceValue
                ? [String(sourceValue)]
                : [];
          })
        : [];
      combined = [
        ...staticOptions,
        ...linkedValues.map((item) => ({
          value: item,
          label: sourceLabelSuffix
            ? `${item} ${sourceLabelSuffix}`
            : item,
        })),
      ];
    }

    const uniqueOptions = combined.filter(
      (option, index) =>
        combined.findIndex(
          (candidate) =>
            candidate.value.toLocaleLowerCase("ru") ===
            option.value.toLocaleLowerCase("ru"),
        ) === index,
    );
    const excludedValues = new Set(column.excludeOptionValues ?? []);
    if (column.excludeColumnKey) {
      const excludedFromRow = row[column.excludeColumnKey];
      if (Array.isArray(excludedFromRow)) {
        excludedFromRow.forEach((item) => excludedValues.add(String(item)));
      } else if (excludedFromRow) {
        excludedValues.add(String(excludedFromRow));
      }
    }
    const availableOptions = uniqueOptions.filter(
      (option) => !excludedValues.has(option.value),
    );
    return column.sortOptions
      ? sortSuggestions(availableOptions, column)
      : availableOptions;
  }

  function addRow() {
    onChange([...rows, createDefaultRow()]);
  }
  function updateRow(index: number, key: string, cellValue: unknown) {
    onChange(
      rows.map((row, rowIndex) =>
        rowIndex === index
          ? columns.reduce(
              (nextRow, column) => {
                if (
                  column.visibleWhen &&
                  nextRow[column.visibleWhen.columnKey] !==
                    column.visibleWhen.equals
                ) {
                  nextRow[column.key] = "";
                }
                if (Array.isArray(nextRow[column.key])) {
                  const excludedValues = new Set(
                    column.excludeOptionValues ?? [],
                  );
                  if (column.excludeColumnKey) {
                    const excludedFromRow = nextRow[column.excludeColumnKey];
                    if (Array.isArray(excludedFromRow)) {
                      excludedFromRow.forEach((item) =>
                        excludedValues.add(String(item)),
                      );
                    } else if (excludedFromRow) {
                      excludedValues.add(String(excludedFromRow));
                    }
                  }
                  nextRow[column.key] = (
                    nextRow[column.key] as unknown[]
                  ).filter((item) => !excludedValues.has(String(item)));
                }
                return nextRow;
              },
              { ...row, [key]: cellValue },
            )
          : row,
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
              {question.config.rowLabel ?? "Строка"}
              {question.config.numberRows === false ? "" : ` ${rowIndex + 1}`}
            </span>
            {!disabled && !question.config.fixedRows && (
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
            {columns.map((column) => {
              if (
                column.visibleWhen &&
                row[column.visibleWhen.columnKey] !== column.visibleWhen.equals
              ) {
                return null;
              }
              const isRequired =
                column.required ||
                (column.requiredWhen &&
                  row[column.requiredWhen.columnKey] ===
                    column.requiredWhen.equals);
              const comparisonValue = column.notBeforeColumnKey
                ? row[column.notBeforeColumnKey]
                : undefined;
              const hasPeriodError =
                column.notBeforeColumnKey !== undefined &&
                row[column.key] !== undefined &&
                row[column.key] !== "" &&
                comparisonValue !== undefined &&
                comparisonValue !== "" &&
                Number(row[column.key]) < Number(comparisonValue);
              return (
              <div
                key={column.key}
                className={`${column.fullWidth ||
                    ["long_text", "multi_suggest"].includes(column.type)
                    ? "lg:col-span-2"
                    : ""} ${
                  hasPeriodError
                    ? "[&_.field]:border-[#FF2F86] [&_.field]:ring-2 [&_.field]:ring-[#FFE0ED]"
                    : ""
                }`}
              >
                <span className="mb-1.5 block text-xs font-medium text-neutral-600">
                  {column.title}
                  {isRequired && <span className="text-[#C80058]"> *</span>}
                </span>
                {column.description && (
                  <p className="mb-2 text-xs leading-5 text-neutral-500">
                    {column.description}
                  </p>
                )}
                <InlineField
                  column={column}
                  value={row[column.key]}
                  suggestions={getSuggestions(column, row)}
                  disabled={disabled}
                  onChange={(cellValue) =>
                    updateRow(rowIndex, column.key, cellValue)
                  }
                />
                {hasPeriodError && (
                  <p className="mt-1.5 text-xs font-medium text-[#C80058]">
                    Год окончания не может быть раньше года начала
                  </p>
                )}
              </div>
              );
            })}
          </div>
        </div>
      ))}
      {!disabled &&
        !question.config.fixedRows &&
        (question.config.maxRows === undefined ||
          rows.length < question.config.maxRows) && (
          <button
            type="button"
            onClick={addRow}
            className="rounded-lg border border-dashed border-[#0059C7] px-4 py-2.5 text-sm font-semibold text-[#0059C7] hover:bg-[#DDF8FB]"
          >
            + {question.config.addRowLabel ?? "Добавить строку"}
          </button>
        )}
      {!rows.length && disabled && (
        <p className="text-sm italic text-neutral-400">Нет данных</p>
      )}
    </div>
  );
}

function FileUploadField({
  value,
  disabled,
  onUpload,
  onDelete,
}: {
  value: unknown;
  disabled: boolean;
  onUpload: (file: File) => Promise<void>;
  onDelete: (attachmentId: string) => Promise<void>;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const uploadedFile =
    typeof value === "object" && value && "id" in value
      ? (value as { id: unknown; name?: unknown })
      : null;

  async function selectFile(file?: File) {
    if (!file || uploading) return;
    setUploading(true);
    try {
      await onUpload(file);
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function deleteUploadedFile() {
    if (
      !uploadedFile ||
      deleting ||
      !window.confirm("Удалить файл без возможности восстановления?")
    ) {
      return;
    }

    setDeleting(true);
    try {
      await onDelete(String(uploadedFile.id));
    } finally {
      setDeleting(false);
    }
  }

  function downloadUploadedFile() {
    if (!uploadedFile) return;

    const link = document.createElement("a");
    link.href = `/api/attachments/${String(uploadedFile.id)}`;
    document.body.appendChild(link);
    link.click();
    link.remove();
  }

  return (
    <div className="space-y-3">
      {uploadedFile && (
        <div className="flex flex-col gap-3 rounded-xl bg-[#DDF8FB] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <span className="min-w-0 truncate text-sm font-semibold text-[#00616C]">
            Прикреплён: {String(uploadedFile.name ?? "Материал")}
          </span>
          <div className="flex shrink-0 items-center gap-3">
            <button
              type="button"
              onClick={downloadUploadedFile}
              className="attachment-action attachment-action-download"
            >
              Скачать
            </button>
            {!disabled && (
              <button
                type="button"
                disabled={deleting}
                onClick={() => void deleteUploadedFile()}
                className="attachment-action attachment-action-delete"
              >
                Удалить
              </button>
            )}
          </div>
        </div>
      )}
      {!disabled && (
        <div
          onDragEnter={(event) => {
            event.preventDefault();
            setDragging(true);
          }}
          onDragOver={(event) => {
            event.preventDefault();
            event.dataTransfer.dropEffect = "copy";
            setDragging(true);
          }}
          onDragLeave={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget as Node)) {
              setDragging(false);
            }
          }}
          onDrop={(event) => {
            event.preventDefault();
            setDragging(false);
            void selectFile(event.dataTransfer.files?.[0]);
          }}
          className={`rounded-2xl border-2 border-dashed p-6 text-center transition ${
            dragging
              ? "border-[#0D78F8] bg-[#E0EEFF]"
              : "border-neutral-300 bg-neutral-50 hover:border-[#0D78F8]"
          }`}
        >
          <p className="font-semibold text-black">
            {uploading ? "Загружаем материал…" : "Перетащите файл сюда"}
          </p>
          <p className="mt-1 text-xs leading-5 text-neutral-500">
            PDF, DOCX, XLSX, PNG или JPG до 20 МБ
          </p>
          <button
            type="button"
            disabled={uploading}
            onClick={() => inputRef.current?.click()}
            className="mt-4 rounded-xl bg-[#0059C7] px-5 py-2.5 text-sm font-bold text-white hover:bg-[#00479F] disabled:opacity-60"
          >
            Добавить материал
          </button>
          <input
            ref={inputRef}
            className="sr-only"
            type="file"
            accept=".pdf,.docx,.xlsx,.png,.jpg,.jpeg"
            onChange={(event) => void selectFile(event.target.files?.[0])}
          />
        </div>
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
  const [saveError, setSaveError] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState("");
  const revisionRef = useRef(initialRevision);
  const firstRender = useRef(true);
  const readOnly = !["NOT_STARTED", "DRAFT", "NEEDS_REVISION"].includes(status);

  async function saveDraft(snapshot = answers) {
    if (readOnly) return revisionRef.current;
    setSaveError("");
    setSaveState("saving");
    const response = await fetch(`/api/assignments/${assignmentId}/draft`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ revision: revisionRef.current, answers: snapshot }),
    });
    if (response.status === 409) {
      setSaveState("error");
      const description =
        "Черновик изменён в другой вкладке. Обновите страницу, чтобы загрузить актуальные ответы.";
      setSaveError(description);
      setMessage(description);
      throw new Error("Revision conflict");
    }
    if (!response.ok) {
      setSaveState("error");
      const description =
        "Не удалось сохранить ответы. Проверьте подключение к интернету и повторите изменение.";
      setSaveError(description);
      setMessage(description);
      throw new Error("Save failed");
    }
    const result = (await response.json()) as { revision: number; status: string };
    revisionRef.current = result.revision;
    setRevision(result.revision);
    setStatus(result.status);
    setSaveState("saved");
    setSaveError("");
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

  useEffect(() => {
    window.dispatchEvent(
      new CustomEvent("draft-state-change", {
        detail: {
          assignmentId,
          revision,
          saveState,
          saveError,
          status,
        },
      }),
    );
  }, [assignmentId, revision, saveError, saveState, status]);

  function setAnswer(questionId: string, value: unknown) {
    setSaveError("");
    setSaveState("dirty");
    setAnswers((current) => ({ ...current, [questionId]: value }));
    setErrors((current) => {
      const next = { ...current };
      delete next[questionId];
      return next;
    });
  }

  async function uploadFile(questionId: string, file: File) {
    setSaveError("");
    setSaveState("saving");
    const formData = new FormData();
    formData.set("assignmentId", assignmentId);
    formData.set("questionId", questionId);
    formData.set("file", file);
    try {
      const response = await fetch("/api/attachments", {
        method: "POST",
        body: formData,
      });
      const result = (await response.json()) as {
        error?: string;
        value?: unknown;
      };
      if (!response.ok) {
        const description =
          result.error === "FILE_NOT_ALLOWED"
            ? "Файл не загружен. Поддерживаемые форматы: PDF, DOCX, XLSX, PNG, JPG и JPEG. Максимальный размер — 20 МБ."
            : result.error === "UNAUTHORIZED"
              ? "Сессия завершена. Войдите в портал повторно и загрузите файл."
              : result.error === "NOT_ALLOWED"
                ? "Файл нельзя добавить: раздел уже отправлен или недоступен для редактирования."
                : "Файл не загружен. Проверьте подключение и попробуйте ещё раз.";
        setSaveState("error");
        setSaveError(description);
        setMessage(description);
        return;
      }
      setAnswer(questionId, result.value);
      setSaveState("saved");
      setSaveError("");
      setMessage("");
    } catch {
      const description =
        "Файл не загружен. Проверьте подключение. Поддерживаемые форматы: PDF, DOCX, XLSX, PNG, JPG и JPEG до 20 МБ.";
      setSaveState("error");
      setSaveError(description);
      setMessage(description);
    }
  }

  async function deleteFile(questionId: string, attachmentId: string) {
    setSaveError("");
    setSaveState("saving");
    try {
      const response = await fetch(`/api/attachments/${attachmentId}`, {
        method: "DELETE",
      });
      if (!response.ok) throw new Error("Delete failed");
      setAnswer(questionId, "");
      setSaveError("");
      setMessage("");
    } catch {
      const description =
        "Не удалось удалить файл. Проверьте подключение, обновите страницу и попробуйте ещё раз.";
      setSaveState("error");
      setSaveError(description);
      setMessage(description);
    }
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
                  questions={questions}
                  answers={answers}
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
                <FileUploadField
                  value={value}
                  disabled={readOnly}
                  onUpload={(file) => uploadFile(question.id, file)}
                  onDelete={(attachmentId) =>
                    deleteFile(question.id, attachmentId)
                  }
                />
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
