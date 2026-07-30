"use client";

import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import {
  matchesFieldCondition,
  type FieldCondition,
} from "@/lib/field-conditions";
import { synchronizeAutomaticTableRows } from "@/lib/auto-table-rows";
import { validateAnswers } from "@/lib/answer-validation";

type Option = { value: string; label: string };
type Column = {
  key: string;
  title: string;
  description?: string;
  type: string;
  required?: boolean;
  options?: Option[];
  allowCustom?: boolean;
  contextKey?: string;
  defaultValue?: string;
  excludeColumnKey?: string;
  excludeOptionValues?: string[];
  fullWidth?: boolean;
  lastOptionValue?: string;
  notBeforeColumnKey?: string;
  optionsFromColumnKey?: string;
  requiredWhen?: FieldCondition;
  requiredWhenAny?: FieldCondition[];
  sortOptions?: boolean;
  sourceQuestionKey?: string;
  sourceColumnKey?: string;
  sourceFilterColumnKey?: string;
  sourceFilterValueFromColumnKey?: string;
  sourceLabelSuffix?: string;
  uniqueAcrossRows?: boolean;
  visibleWhen?: FieldCondition;
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
    addRowRequiresColumnKey?: string;
    numberRows?: boolean;
    rowLabel?: string;
    sortableRows?: boolean;
    groupByColumnKey?: string;
    coverSourceQuestionKey?: string;
    coverSourceColumns?: string[];
    coverTargetColumns?: string[];
    coverageWarning?: string;
    coverageError?: string;
    requiredColumnValues?: {
      columnKey: string;
      values: string[];
      error?: string;
    };
    autoRowsFromQuestionKey?: string;
    autoRowMappings?: Array<{
      sourceColumnKey: string;
      targetColumnKey: string;
      identity?: boolean;
    }>;
    lockRows?: boolean;
    columns?: Column[];
  };
};

function isUnfilled(value: unknown) {
  return (
    value === undefined ||
    value === null ||
    (typeof value === "string" && value.trim() === "") ||
    (Array.isArray(value) && value.length === 0)
  );
}

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
  const isCustomValue =
    allowCustom &&
    Boolean(currentValue.trim()) &&
    !options.some(
      (option) =>
        option.value.toLocaleLowerCase("ru") ===
        currentValue.toLocaleLowerCase("ru"),
    );
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
      </div>
      {isCustomValue && !disabled && (
        <p className="mt-1.5 text-xs italic text-neutral-500">
          Вы вводите свой вариант
        </p>
      )}
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
  const normalizedQuery = query.trim().toLocaleLowerCase("ru");
  const hasCustomValue = selected.some(
    (item) =>
      !options.some(
        (option) =>
          option.value.toLocaleLowerCase("ru") ===
          item.toLocaleLowerCase("ru"),
      ),
  );
  const isEnteringCustomValue =
    allowCustom &&
    Boolean(normalizedQuery) &&
    !options.some(
      (option) =>
        option.value.toLocaleLowerCase("ru") === normalizedQuery ||
        option.label.toLocaleLowerCase("ru") === normalizedQuery,
    );
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
      {allowCustom &&
        !disabled &&
        (hasCustomValue || isEnteringCustomValue) && (
          <p className="mt-1.5 text-xs italic text-neutral-500">
            Вы вводите свой вариант
          </p>
        )}
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
  contextualOptions,
  value,
  disabled,
  onChange,
}: {
  question: Question;
  questions: Question[];
  answers: Record<string, unknown>;
  contextualOptions: Record<string, Option[]>;
  value: unknown;
  disabled: boolean;
  onChange: (value: unknown) => void;
}) {
  const columns = question.config.columns ?? [];
  const [draggedRowIndex, setDraggedRowIndex] = useState<number | null>(null);
  const [dragOverRowIndex, setDragOverRowIndex] = useState<number | null>(null);

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
  const requiredBeforeAddColumn = columns.find(
    (column) => column.key === question.config.addRowRequiresColumnKey,
  );
  const previousRowBlocksAdd =
    Boolean(requiredBeforeAddColumn) &&
    rows.length > 0 &&
    !String(
      rows[rows.length - 1]?.[requiredBeforeAddColumn!.key] ?? "",
    ).trim();
  const uncoveredCoverageLabels = (() => {
    const {
      coverSourceQuestionKey,
      coverSourceColumns,
      coverTargetColumns,
      coverageWarning,
    } = question.config;
    if (
      !coverageWarning ||
      !coverSourceQuestionKey ||
      !coverSourceColumns?.length ||
      coverTargetColumns?.length !== coverSourceColumns.length
    ) {
      return [];
    }
    const sourceQuestion = questions.find(
      (candidate) => candidate.key === coverSourceQuestionKey,
    );
    const sourceRows = sourceQuestion ? answers[sourceQuestion.id] : undefined;
    if (!Array.isArray(sourceRows)) return [];
    const compositeKey = (
      row: Record<string, unknown>,
      keys: string[],
    ) =>
      keys
        .map((key) => String(row[key] ?? "").trim().toLocaleLowerCase("ru"))
        .join("\u0000");
    const covered = new Set(
      rows.map((row) => compositeKey(row, coverTargetColumns)),
    );
    return sourceRows
      .filter(
        (sourceRow) =>
          !covered.has(
            compositeKey(
              sourceRow as Record<string, unknown>,
              coverSourceColumns,
            ),
          ),
      )
      .map((sourceRow) =>
        String(
          (sourceRow as Record<string, unknown>)[coverSourceColumns[0]] ?? "",
        ).trim(),
      )
      .filter(Boolean);
  })();

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
    rowIndex: number,
  ) {
    const optionSource =
      columns.find((item) => item.key === column.optionsFromColumnKey) ??
      column;
    const contextOptions = column.contextKey
      ? contextualOptions[column.contextKey] ?? []
      : [];
    const staticOptions = [
      ...(column.options ?? optionSource.options ?? []),
      ...contextOptions,
    ];
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
      const filteredSourceRows = Array.isArray(sourceRows)
        ? sourceRows.filter((sourceRow) => {
            if (
              !column.sourceFilterColumnKey ||
              !column.sourceFilterValueFromColumnKey
            ) {
              return true;
            }
            return (
              (sourceRow as Record<string, unknown>)[
                column.sourceFilterColumnKey
              ] === row[column.sourceFilterValueFromColumnKey]
            );
          })
        : [];
      const linkedValues = filteredSourceRows.flatMap((sourceRow) => {
            const sourceValue = (sourceRow as Record<string, unknown>)[
              sourceColumnKey
            ];
            return Array.isArray(sourceValue)
              ? sourceValue.map(String)
              : sourceValue
                ? [String(sourceValue)]
                : [];
          });
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
    if (column.uniqueAcrossRows) {
      rows.forEach((otherRow, otherRowIndex) => {
        if (otherRowIndex === rowIndex) return;
        const selectedValue = otherRow[column.key];
        if (selectedValue) excludedValues.add(String(selectedValue));
      });
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
                  !matchesFieldCondition(nextRow, column.visibleWhen)
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

  function moveRow(fromIndex: number, toIndex: number) {
    if (fromIndex === toIndex) return;
    const groupByColumnKey = question.config.groupByColumnKey;
    if (
      groupByColumnKey &&
      rows[fromIndex]?.[groupByColumnKey] !== rows[toIndex]?.[groupByColumnKey]
    ) {
      return;
    }
    const nextRows = [...rows];
    const [movedRow] = nextRows.splice(fromIndex, 1);
    nextRows.splice(toIndex, 0, movedRow);
    onChange(nextRows);
  }

  return (
    <div className="space-y-3">
      {rows.map((row, rowIndex) => (
        <div
          key={rowIndex}
          onDragOver={(event) => {
            if (
              disabled ||
              !question.config.sortableRows ||
              draggedRowIndex === null
            ) {
              return;
            }
            event.preventDefault();
            event.dataTransfer.dropEffect = "move";
            setDragOverRowIndex(rowIndex);
          }}
          onDrop={(event) => {
            event.preventDefault();
            if (draggedRowIndex !== null) {
              moveRow(draggedRowIndex, rowIndex);
            }
            setDraggedRowIndex(null);
            setDragOverRowIndex(null);
          }}
          className={`rounded-xl border bg-neutral-50/70 p-4 transition ${
            dragOverRowIndex === rowIndex && draggedRowIndex !== rowIndex
              ? "border-[#0D78F8] ring-2 ring-[#E0EEFF]"
              : "border-neutral-200"
          }`}
        >
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              {!disabled && question.config.sortableRows && (
                <span
                  draggable
                  role="button"
                  tabIndex={0}
                  aria-label={`Перетащить ${question.config.rowLabel ?? "строку"} ${rowIndex + 1}`}
                  title="Перетащите, чтобы изменить порядок"
                  onDragStart={(event) => {
                    setDraggedRowIndex(rowIndex);
                    event.dataTransfer.effectAllowed = "move";
                    event.dataTransfer.setData("text/plain", String(rowIndex));
                  }}
                  onDragEnd={() => {
                    setDraggedRowIndex(null);
                    setDragOverRowIndex(null);
                  }}
                  className="cursor-grab select-none rounded-md border border-neutral-200 bg-white px-2 py-1 text-sm leading-none text-neutral-400 active:cursor-grabbing"
                >
                  ⋮⋮
                </span>
              )}
              <span className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
                {question.config.rowLabel ?? "Строка"}
                {question.config.numberRows === false ? "" : ` ${rowIndex + 1}`}
              </span>
            </div>
            {!disabled &&
              !question.config.fixedRows &&
              !question.config.lockRows && (
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
                !matchesFieldCondition(row, column.visibleWhen)
              ) {
                return null;
              }
              const isRequired =
                column.required ||
                (column.requiredWhen &&
                  matchesFieldCondition(row, column.requiredWhen)) ||
                column.requiredWhenAny?.some((condition) =>
                  matchesFieldCondition(row, condition),
                );
              const isIncomplete =
                !disabled && Boolean(isRequired) && isUnfilled(row[column.key]);
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
              const isCustomVariantField =
                column.visibleWhen?.equals === "Другое" ||
                column.visibleWhen?.includes === "Другое";
              return (
              <div
                key={column.key}
                className={`${column.fullWidth ||
                    ["long_text", "multi_suggest"].includes(column.type)
                    ? "lg:col-span-2"
                    : ""} ${
                  hasPeriodError
                    ? "[&_.field]:border-[#FF2F86] [&_.field]:ring-2 [&_.field]:ring-[#FFE0ED]"
                    : isIncomplete
                      ? "[&_.field]:border-[#0D78F8] [&_.field]:bg-[#F5FAFF]"
                    : ""
                }`}
              >
                <span className="mb-1.5 flex items-start justify-between gap-3 text-xs font-medium text-neutral-600">
                  <span>
                    {column.title}
                    {isRequired && <span className="text-[#C80058]"> *</span>}
                  </span>
                  {isIncomplete && (
                    <span className="shrink-0 rounded-full bg-[#E0EEFF] px-2 py-0.5 font-semibold text-[#0059C7]">
                      Не заполнено
                    </span>
                  )}
                </span>
                {column.description && (
                  <p className="mb-2 text-xs leading-5 text-neutral-500">
                    {column.description}
                  </p>
                )}
                <InlineField
                  column={column}
                  value={row[column.key]}
                  suggestions={getSuggestions(column, row, rowIndex)}
                  disabled={disabled}
                  onChange={(cellValue) =>
                    updateRow(rowIndex, column.key, cellValue)
                  }
                />
                {isCustomVariantField && !disabled && (
                  <p className="mt-1.5 text-xs italic text-neutral-500">
                    Вы вводите свой вариант
                  </p>
                )}
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
      {!disabled && uncoveredCoverageLabels.length > 0 && (
        <div className="rounded-xl border border-[#8CC4FF] bg-[#F5FAFF] px-4 py-3 text-sm leading-6 text-[#003F8F]">
          <span className="font-semibold">{question.config.coverageWarning}</span>{" "}
          {uncoveredCoverageLabels.join(", ")}.
        </div>
      )}
      {!disabled &&
        !question.config.fixedRows &&
        !question.config.lockRows &&
        (question.config.maxRows === undefined ||
          rows.length < question.config.maxRows) && (
          <button
            type="button"
            onClick={addRow}
            disabled={previousRowBlocksAdd}
            className="rounded-lg border border-dashed border-[#0059C7] px-4 py-2.5 text-sm font-semibold text-[#0059C7] hover:bg-[#DDF8FB] disabled:cursor-not-allowed disabled:border-neutral-300 disabled:text-neutral-400 disabled:hover:bg-transparent"
          >
            + {question.config.addRowLabel ?? "Добавить строку"}
          </button>
        )}
      {!disabled &&
        previousRowBlocksAdd &&
        requiredBeforeAddColumn && (
          <p className="text-xs leading-5 text-neutral-500">
            Чтобы добавить следующее действие, заполните поле «
            {requiredBeforeAddColumn.title}» в предыдущей карточке.
          </p>
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
  contextualOptions = {},
  superExpertMode = false,
}: {
  assignmentId: string;
  questions: Question[];
  initialAnswers: Record<string, unknown>;
  initialRevision: number;
  initialStatus: string;
  contextualOptions?: Record<string, Option[]>;
  superExpertMode?: boolean;
}) {
  const router = useRouter();
  const [answers, setAnswers] = useState(() =>
    synchronizeAutomaticTableRows(questions, initialAnswers),
  );
  const [revision, setRevision] = useState(initialRevision);
  const [status, setStatus] = useState(initialStatus);
  const [saveState, setSaveState] = useState<"saved" | "saving" | "dirty" | "error">("saved");
  const [saveError, setSaveError] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState("");
  const [previewing, setPreviewing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitConfirmationOpen, setSubmitConfirmationOpen] = useState(false);
  const revisionRef = useRef(initialRevision);
  const firstRender = useRef(true);
  const readOnly = !["NOT_STARTED", "DRAFT", "NEEDS_REVISION"].includes(status);
  const liveValidationErrors = validateAnswers(questions, answers);
  const canPreview = Object.keys(liveValidationErrors).length === 0;

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

  useEffect(() => {
    if (!submitConfirmationOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setSubmitConfirmationOpen(false);
    }

    window.addEventListener("keydown", closeOnEscape);
    return () => {
      window.removeEventListener("keydown", closeOnEscape);
      document.body.style.overflow = previousOverflow;
    };
  }, [submitConfirmationOpen]);

  function setAnswer(questionId: string, value: unknown) {
    setSaveError("");
    setSaveState("dirty");
    setAnswers((current) => {
      const changedQuestion = questions.find(
        (question) => question.id === questionId,
      );
      return synchronizeAutomaticTableRows(
        questions,
        { ...current, [questionId]: value },
        changedQuestion?.key,
      );
    });
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
          result.error === "FILE_NOT_ALLOWED" ||
          result.error === "FILE_CONTENT_MISMATCH"
            ? "Файл не загружен. Поддерживаемые форматы: PDF, DOCX, XLSX, PNG, JPG и JPEG. Максимальный размер — 20 МБ."
            : result.error === "PAYLOAD_TOO_LARGE"
              ? "Файл не загружен: размер файла превышает 20 МБ."
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
    setSubmitting(true);
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
      setErrors({});
      setSubmitConfirmationOpen(true);
      router.refresh();
    } catch {
      setMessage("Не удалось отправить ответ.");
    } finally {
      setSubmitting(false);
    }
  }

  async function previewPdf() {
    setMessage("");
    const previewWindow = window.open("about:blank", "_blank");
    setPreviewing(true);
    try {
      const response = await fetch(
        `/api/assignments/${assignmentId}/pdf?preview=1`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ answers }),
        },
      );
      if (!response.ok) throw new Error("Preview failed");
      const objectUrl = URL.createObjectURL(await response.blob());
      if (previewWindow) {
        previewWindow.location.replace(objectUrl);
      } else {
        const link = document.createElement("a");
        link.href = objectUrl;
        link.target = "_blank";
        link.rel = "noopener";
        link.click();
      }
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
    } catch {
      previewWindow?.close();
      setMessage(
        "Не удалось сформировать предварительный просмотр. Проверьте подключение и попробуйте ещё раз.",
      );
    } finally {
      setPreviewing(false);
    }
  }

  return (
    <div>
      {submitConfirmationOpen && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/55 p-4 sm:p-6"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setSubmitConfirmationOpen(false);
            }
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="submit-confirmation-title"
            aria-describedby="submit-confirmation-description"
            className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl sm:p-8"
          >
            <div className="flex size-12 items-center justify-center rounded-full bg-[#DDF8FB] text-2xl font-bold text-[#00616C]">
              ✓
            </div>
            <h2
              id="submit-confirmation-title"
              className="mt-5 text-2xl font-bold text-black"
            >
              Отправлено на проверку
            </h2>
            <p
              id="submit-confirmation-description"
              className="mt-3 leading-7 text-neutral-600"
            >
              Ответы переданы модератору. До завершения проверки редактирование
              модуля будет недоступно.
            </p>
            <button
              type="button"
              autoFocus
              onClick={() => setSubmitConfirmationOpen(false)}
              className="mt-6 w-full rounded-xl bg-[#0059C7] px-6 py-3 font-semibold text-white transition hover:bg-[#00479F]"
            >
              Понятно
            </button>
          </section>
        </div>
      )}

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
          const liveError = liveValidationErrors[question.id];
          const isIncomplete =
            !readOnly &&
            Boolean(liveError) &&
            /Заполните|Добавьте минимум|Оцените каждое/.test(liveError);
          return (
            <section
              key={question.id}
              data-field-error={error ? "true" : undefined}
              className={`rounded-2xl border bg-white p-5 sm:p-6 ${
                error
                  ? "border-[#FF78B0]"
                  : isIncomplete
                    ? "border-[#8CC4FF]"
                    : "border-neutral-200"
              }`}
            >
              <div className="mb-4 flex gap-3">
                <span className="grid size-7 shrink-0 place-items-center rounded-full bg-neutral-100 text-xs font-semibold text-neutral-500">
                  {index + 1}
                </span>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-semibold text-[#000000]">
                      {question.title}
                      {question.required && <span className="text-[#C80058]"> *</span>}
                    </h3>
                    {isIncomplete && (
                      <span className="rounded-full bg-[#E0EEFF] px-2.5 py-1 text-xs font-semibold text-[#0059C7]">
                        Не заполнено
                      </span>
                    )}
                  </div>
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
                  contextualOptions={contextualOptions}
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
            <h3 className="text-xl">
              {superExpertMode ? "Проверка модуля" : "Раздел заполнен?"}
            </h3>
            <p className="mt-1 text-sm text-neutral-300">
              {superExpertMode
                ? "Черновик сохраняется только для вашей проверки и не попадёт в экспертную аналитику."
                : "После отправки редактирование будет недоступно до возврата на доработку."}
            </p>
          </div>
          <div className="flex shrink-0 flex-col gap-3 sm:items-end">
            <button
              type="button"
              disabled={previewing || !canPreview}
              onClick={previewPdf}
              title={
                canPreview
                  ? "Открыть текущие ответы в формате PDF"
                  : "Сначала заполните все обязательные поля"
              }
              className="rounded-xl border border-white px-6 py-3 font-semibold text-white hover:bg-white hover:text-black disabled:opacity-60"
            >
              {previewing ? "Формируем PDF…" : "Предварительный просмотр PDF"}
            </button>
            {!canPreview && (
              <p className="max-w-64 text-right text-xs leading-5 text-neutral-300">
                Станет доступен после заполнения всех обязательных полей,
                отмеченных звёздочкой (*).
              </p>
            )}
            {!superExpertMode && (
              <button
                type="button"
                disabled={submitting}
                onClick={() => void submit()}
                className="rounded-xl bg-[#8125C8] px-6 py-3 font-semibold text-white hover:bg-[#0059C7] disabled:cursor-wait disabled:opacity-60"
              >
                {submitting ? "Отправляем…" : "Отправить на проверку"}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
