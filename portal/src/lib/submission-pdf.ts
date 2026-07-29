import { existsSync } from "node:fs";
import PDFDocument from "pdfkit";
import {
  matchesFieldCondition,
  type FieldCondition,
} from "./field-conditions";

type Option = { value: string; label: string };
type Column = {
  key: string;
  title: string;
  options?: Option[];
  defaultValue?: string;
  visibleWhen?: FieldCondition;
};
type Question = {
  key: string;
  title: string;
  config: {
    options?: Option[];
    columns?: Column[];
    rowLabel?: string;
  };
  value: unknown;
};

export type SubmissionPdfData = {
  moduleOrder: number;
  moduleTitle: string;
  expertName: string;
  companyName: string;
  subgroupName: string;
  statusLabel: string;
  attachmentBaseUrl: string;
  isPreview?: boolean;
  questions: Question[];
};

function fontPath(kind: "regular" | "bold") {
  const fileName =
    kind === "bold" ? "Roboto-Bold.ttf" : "Roboto-Regular.ttf";
  const candidates = [
    process.env.PDF_FONT_DIR
      ? `${process.env.PDF_FONT_DIR}/${fileName}`
      : "",
    `${process.cwd()}/src/assets/fonts/${fileName}`,
  ];
  const match = candidates.find((candidate) => candidate && existsSync(candidate));
  if (!match) throw new Error(`PDF font not found: ${fileName}`);
  return match;
}

function optionLabel(value: unknown, options?: Option[]) {
  return (
    options?.find((option) => option.value === String(value))?.label ??
    String(value ?? "")
  );
}

function printableValue(value: unknown, options?: Option[]) {
  if (value === null || value === undefined || value === "") {
    return "Не заполнено";
  }
  if (Array.isArray(value)) {
    return (
      value
        .map((item) =>
          typeof item === "object" && item !== null && "name" in item
            ? String((item as { name?: unknown }).name ?? "Материал")
            : optionLabel(item, options),
        )
        .join(", ") || "—"
    );
  }
  if (typeof value === "object") {
    if ("name" in value) {
      return `Прикреплённый файл: ${String(
        (value as { name?: unknown }).name ?? "Материал",
      )}`;
    }
    return JSON.stringify(value);
  }
  return optionLabel(value, options);
}

function attachmentInfo(value: unknown) {
  if (
    typeof value !== "object" ||
    value === null ||
    !("id" in value) ||
    !("name" in value)
  ) {
    return null;
  }
  const id = String((value as { id?: unknown }).id ?? "");
  const name = String((value as { name?: unknown }).name ?? "Материал");
  return id ? { id, name } : null;
}

export async function createSubmissionPdf(data: SubmissionPdfData) {
  const regularFont = fontPath("regular");
  const boldFont = fontPath("bold");
  const generatedAt = new Date();
  const document = new PDFDocument({
    size: "A4",
    margin: 48,
    font: regularFont,
    bufferPages: true,
    info: {
      Title: `${data.moduleOrder}. ${data.moduleTitle}`,
      Author: data.expertName,
    },
  });
  const chunks: Buffer[] = [];
  document.on("data", (chunk: Buffer) => chunks.push(chunk));
  const completed = new Promise<Buffer>((resolve, reject) => {
    document.on("end", () => resolve(Buffer.concat(chunks)));
    document.on("error", reject);
  });

  document.registerFont("RobotoLike", regularFont);
  document.registerFont("RobotoLikeBold", boldFont);
  document.font("RobotoLike");

  let landscapePageActive = false;
  const pageBottom = () => document.page.height - 48;
  const ensureSpace = (height: number) => {
    if (document.y + height > pageBottom()) {
      document.addPage({ size: "A4", layout: "portrait", margin: 48 });
      landscapePageActive = false;
    }
  };
  const divider = () => {
    document
      .moveTo(48, document.y)
      .lineTo(document.page.width - 48, document.y)
      .lineWidth(0.6)
      .strokeColor("#D9D9D9")
      .stroke();
    document.moveDown(0.8);
  };
  const tableText = (value: unknown, column?: Column) =>
    printableValue(value, column?.options);
  let methodologyAppendixStarted = false;
  const renderReportTable = ({
    title,
    headers,
    rows,
    weights,
  }: {
    title: string;
    headers: string[];
    rows: string[][];
    weights: number[];
  }) => {
    const margin = 36;
    const pageWidth = 841.89;
    const usableWidth = pageWidth - margin * 2;
    const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
    const widths = weights.map((weight) => (usableWidth * weight) / totalWeight);
    document.font("RobotoLikeBold").fontSize(8.5);
    const headerHeight = Math.max(
      32,
      ...headers.map(
        (header, index) =>
          document.heightOfString(header, {
            width: widths[index] - 12,
            lineGap: 1,
          }) + 14,
      ),
    );
    const rowHeights = rows.map((row) =>
      Math.max(
        30,
        ...row.map((cell, index) =>
          document
            .font("RobotoLike")
            .fontSize(8.5)
            .heightOfString(cell || "—", {
              width: widths[index] - 12,
              lineGap: 1.5,
            }) + 14,
        ),
      ),
    );
    document.font("RobotoLikeBold").fontSize(14);
    const tableTitleHeight =
      document.heightOfString(title, { width: usableWidth }) + 10;
    const requiredStartHeight =
      tableTitleHeight + headerHeight + (rowHeights[0] ?? 30) + 12;

    const addLandscapePage = () => {
      document.addPage({ size: "A4", layout: "landscape", margin });
      landscapePageActive = true;
      if (!methodologyAppendixStarted) {
        methodologyAppendixStarted = true;
        document
          .font("RobotoLikeBold")
          .fontSize(8.5)
          .fillColor("#8125C8")
          .text("ТАБЛИЧНОЕ ПРИЛОЖЕНИЕ", margin, margin, {
            width: usableWidth,
            characterSpacing: 0.7,
          });
        document.y += 8;
      }
    };
    const drawTableHeading = (continued = false) => {
      document
        .font("RobotoLikeBold")
        .fontSize(14)
        .fillColor("#000000")
        .text(`${title}${continued ? " · продолжение" : ""}`, margin, document.y, {
          width: usableWidth,
        });
      document.y += 10;
      let x = margin;
      const y = document.y;
      headers.forEach((header, index) => {
        document
          .rect(x, y, widths[index], headerHeight)
          .fillAndStroke("#DDEBFF", "#8FB4E8");
        document
          .font("RobotoLikeBold")
          .fontSize(8.5)
          .fillColor("#003F8F")
          .text(header, x + 6, y + 7, {
            width: widths[index] - 12,
            height: headerHeight - 12,
            lineGap: 1,
          });
        x += widths[index];
      });
      document.y = y + headerHeight;
    };

    if (
      !landscapePageActive ||
      document.y + requiredStartHeight > document.page.height - 50
    ) {
      addLandscapePage();
    } else {
      document.y += 18;
    }
    drawTableHeading();
    if (!rows.length) {
      document
        .font("RobotoLike")
        .fontSize(9.5)
        .fillColor("#777777")
        .text("Нет данных для отображения", margin, document.y + 10);
      document.y += 12;
      return;
    }

    rows.forEach((row, rowIndex) => {
      const rowHeight = rowHeights[rowIndex];
      if (document.y + rowHeight > document.page.height - 50) {
        addLandscapePage();
        drawTableHeading(true);
      }
      let x = margin;
      const y = document.y;
      row.forEach((cell, index) => {
        const isMissing = cell === "Не заполнено";
        document
          .rect(x, y, widths[index], rowHeight)
          .fillAndStroke(
            isMissing ? "#FFF2F8" : rowIndex % 2 === 0 ? "#FFFFFF" : "#F8FAFD",
            "#CFD5DE",
          );
        document
          .font("RobotoLike")
          .fontSize(8.5)
          .fillColor(isMissing ? "#C2186A" : "#222222")
          .text(cell || "—", x + 6, y + 7, {
            width: widths[index] - 12,
            height: rowHeight - 12,
            lineGap: 1.5,
          });
        x += widths[index];
      });
      document.y = y + rowHeight;
    });
  };
  const renderTransactionTables = (question: Question) => {
    if (!Array.isArray(question.value)) return false;
    const rows = question.value as Array<Record<string, unknown>>;
    const columns = new Map(
      (question.config.columns ?? []).map((column) => [column.key, column]),
    );
    const cell = (row: Record<string, unknown>, key: string) =>
      tableText(row[key], columns.get(key));

    if (question.key === "participants") {
      renderReportTable({
        title: "Структура участников отрасли",
        headers: [
          "Сегменты",
          "Группа участников",
          "Типы участия",
          "Описание участника",
        ],
        rows: rows.map((row) => [
          cell(row, "segments"),
          cell(row, "name"),
          cell(row, "kind"),
          cell(row, "role"),
        ]),
        weights: [1.5, 1.5, 1, 2.4],
      });
      return true;
    }
    if (question.key === "macrotransactions") {
      renderReportTable({
        title: "Ключевые сценарии взаимодействия",
        headers: [
          "Макротранзакция",
          "Сегменты",
          "Инициатор",
          "Получатель",
          "Тип",
        ],
        rows: rows.map((row) => [
          cell(row, "name"),
          cell(row, "segments"),
          cell(row, "initiator"),
          cell(row, "recipient"),
          cell(row, "transactionType"),
        ]),
        weights: [1.8, 1.6, 1.4, 1.4, 1],
      });
      renderReportTable({
        title: "Содержание макротранзакций",
        headers: [
          "Макротранзакция",
          "Предмет транзакции",
          "Суть и результат",
        ],
        rows: rows.map((row) => [
          cell(row, "name"),
          [
            Array.isArray(row.value)
              ? row.value
                  .filter((item) => String(item) !== "Другое")
                  .map((item) =>
                    optionLabel(item, columns.get("value")?.options),
                  )
                  .join(", ")
              : String(row.value ?? "") === "Другое"
                ? ""
                : cell(row, "value"),
            row.customValue ? String(row.customValue) : "",
          ]
            .filter(Boolean)
            .join(", "),
          cell(row, "description"),
        ]),
        weights: [1.5, 2.2, 3.5],
      });
      return true;
    }
    if (question.key === "microtransactions") {
      const macros = Array.from(
        new Set(rows.map((row) => String(row.macro ?? "")).filter(Boolean)),
      );
      const actions = Array.from(
        new Set(rows.map((row) => String(row.name ?? "")).filter(Boolean)),
      );
      renderReportTable({
        title: "Матрица транзакций отрасли",
        headers: ["Микротранзакция", ...macros],
        rows: actions.map((action) => [
          action,
          ...macros.map((macro) =>
            rows.some(
              (row) => String(row.name ?? "") === action && String(row.macro ?? "") === macro,
            )
              ? "✓"
              : "—",
          ),
        ]),
        weights: [2.4, ...macros.map(() => 1)],
      });
      renderReportTable({
        title: "Последовательность действий внутри макротранзакций",
        headers: [
          "Макротранзакция",
          "Микротранзакция",
          "Исполнитель",
          "Описание и результат",
          "Выполнение сейчас",
        ],
        rows: rows.map((row) => [
          cell(row, "macro"),
          cell(row, "name"),
          cell(row, "actor"),
          cell(row, "result"),
          cell(row, "executionMode"),
        ]),
        weights: [1.5, 1.5, 1.3, 2.5, 1.2],
      });
      return true;
    }
    if (question.key === "transaction_assessments") {
      renderReportTable({
        title: "Оценка ключевых микротранзакций",
        headers: [
          "Макротранзакция",
          "Микротранзакция",
          "Массовость",
          "Повторяемость",
          "Стандартизированность",
          "Комментарий",
        ],
        rows: rows.map((row) => [
          cell(row, "macro"),
          cell(row, "micro"),
          cell(row, "frequency"),
          cell(row, "repeatability"),
          cell(row, "standardization"),
          cell(row, "rationale"),
        ]),
        weights: [1.5, 1.5, 1, 1, 1.2, 2.2],
      });
      renderReportTable({
        title: "Оценка транзакционных издержек",
        headers: [
          "Макротранзакция",
          "Микротранзакция",
          "Удельная ресурсоёмкость",
          "Совокупный уровень издержек",
          "Основные источники издержек",
        ],
        rows: rows.map((row) => [
          cell(row, "macro"),
          cell(row, "micro"),
          cell(row, "resourceIntensity"),
          cell(row, "costLevel"),
          [
            Array.isArray(row.costSources)
              ? row.costSources
                  .filter((source) => String(source) !== "Другое")
                  .map((source) => optionLabel(source, columns.get("costSources")?.options))
                  .join(", ")
              : cell(row, "costSources"),
            row.customCostSource ? String(row.customCostSource) : "",
          ]
            .filter(Boolean)
            .join(", "),
        ]),
        weights: [1.5, 1.5, 1.1, 1.2, 2.7],
      });
      return true;
    }
    return false;
  };
  const renderStateMarketTables = (question: Question) => {
    if (!Array.isArray(question.value)) return false;
    const rows = question.value as Array<Record<string, unknown>>;
    const columns = new Map(
      (question.config.columns ?? []).map((column) => [column.key, column]),
    );
    const cell = (row: Record<string, unknown>, key: string) =>
      tableText(row[key], columns.get(key));
    const valueWithCustom = (
      row: Record<string, unknown>,
      key: string,
      customKey: string,
    ) => {
      const value = row[key];
      const standardValues = Array.isArray(value)
        ? value.filter((item) => String(item) !== "Другое")
        : String(value ?? "") === "Другое"
          ? []
          : [value];
      return [
        standardValues
          .filter((item) => item !== undefined && item !== "")
          .map((item) => optionLabel(item, columns.get(key)?.options))
          .join(", "),
        row[customKey] ? String(row[customKey]) : "",
      ]
        .filter(Boolean)
        .join(", ");
    };

    if (question.key === "state_functions") {
      renderReportTable({
        title: "Роли и функции государства",
        headers: [
          "Участник",
          "Роль",
          "Макротранзакции",
          "Функция",
          "Критичность участия",
          "Модель выполнения",
          "Обоснование",
        ],
        rows: rows.map((row) => [
          cell(row, "participant"),
          valueWithCustom(row, "role", "customRole"),
          cell(row, "macros"),
          cell(row, "function"),
          cell(row, "criticality"),
          cell(row, "executionModel"),
          cell(row, "rationale"),
        ]),
        weights: [1.2, 1.1, 1.4, 2, 1.1, 1.3, 1.8],
      });
      return true;
    }
    if (question.key === "interaction_formats") {
      renderReportTable({
        title: "Форматы взаимодействия государства и рынка",
        headers: [
          "Макротранзакции",
          "Государственные участники",
          "Рыночные участники",
          "Формат",
          "Описание и результат",
          "Влияние на платформы",
          "Обоснование",
        ],
        rows: rows.map((row) => [
          cell(row, "macros"),
          cell(row, "governmentParticipants"),
          cell(row, "marketParticipants"),
          valueWithCustom(row, "format", "customFormat"),
          cell(row, "description"),
          cell(row, "impact"),
          cell(row, "impactRationale"),
        ]),
        weights: [1.3, 1.3, 1.3, 1.4, 2, 1.2, 1.8],
      });
      return true;
    }
    if (question.key === "platforms") {
      renderReportTable({
        title: "Действующие платформы в отрасли",
        headers: [
          "Сегменты",
          "Платформа",
          "Тип",
          "Происхождение",
          "Макротранзакции",
          "MAU / аналог",
          "GTV / объём транзакций",
        ],
        rows: rows.map((row) => [
          cell(row, "segments"),
          cell(row, "name"),
          cell(row, "type"),
          cell(row, "origin"),
          cell(row, "macros"),
          cell(row, "mau"),
          cell(row, "gtv"),
        ]),
        weights: [1.4, 1.4, 0.9, 1.1, 1.9, 1.2, 1.3],
      });
      return true;
    }
    if (question.key === "platform_penetration") {
      renderReportTable({
        title: "Уровень проникновения платформ",
        headers: [
          "Макротранзакция",
          "Совокупная доля транзакций через платформы",
          "Основание оценки",
          "Обоснование",
        ],
        rows: rows.map((row) => [
          cell(row, "macro"),
          cell(row, "share"),
          valueWithCustom(row, "basis", "customBasis"),
          cell(row, "rationale"),
        ]),
        weights: [1.8, 1.8, 1.5, 2.9],
      });
      return true;
    }
    if (question.key === "network_effects") {
      renderReportTable({
        title: "Сетевые эффекты ключевых платформ",
        headers: [
          "Платформа",
          "Типы эффекта",
          "Устойчивость",
          "Масштабируемость",
          "Ограничения",
          "Комментарий",
        ],
        rows: rows.map((row) => [
          cell(row, "platform"),
          cell(row, "effectTypes"),
          cell(row, "stability"),
          cell(row, "scalability"),
          valueWithCustom(row, "constraints", "customConstraint"),
          cell(row, "comment"),
        ]),
        weights: [1.2, 1.2, 1.5, 1.4, 2, 1.7],
      });
      return true;
    }
    return false;
  };
  const renderArchitectureTables = (question: Question) => {
    if (!Array.isArray(question.value)) return false;
    const rows = question.value as Array<Record<string, unknown>>;
    const columns = new Map(
      (question.config.columns ?? []).map((column) => [column.key, column]),
    );
    const cell = (row: Record<string, unknown>, key: string) =>
      tableText(row[key], columns.get(key));

    if (question.key === "data_access") {
      renderReportTable({
        title: "Модель доступа платформ к данным",
        headers: [
          "Категория данных",
          "Платформы",
          "Макротранзакции",
          "Владелец или оператор",
          "Модель доступа",
          "Качество и стандартизация",
        ],
        rows: rows.map((row) => [
          cell(row, "data"),
          cell(row, "platforms"),
          cell(row, "macros"),
          cell(row, "owner"),
          cell(row, "accessModel"),
          cell(row, "quality"),
        ]),
        weights: [1.5, 1.3, 1.6, 1.4, 1.5, 1.3],
      });
      renderReportTable({
        title: "Оценка доступа платформ к данным",
        headers: [
          "Категория данных",
          "Основные ограничения",
          "Влияние на развитие платформ",
          "Обоснование",
        ],
        rows: rows.map((row) => [
          cell(row, "data"),
          cell(row, "restrictions"),
          cell(row, "impact"),
          cell(row, "rationale"),
        ]),
        weights: [1.4, 2.2, 1.4, 3],
      });
      return true;
    }
    if (question.key === "service_access") {
      renderReportTable({
        title: "Доступ внешних сервисов к платформам",
        headers: [
          "Сервис",
          "Платформы",
          "Оператор",
          "Потребность",
          "Механизм подключения",
          "Открытость",
          "Зрелость",
        ],
        rows: rows.map((row) => [
          cell(row, "service"),
          cell(row, "platforms"),
          cell(row, "operator"),
          cell(row, "need"),
          cell(row, "integration"),
          cell(row, "openness"),
          cell(row, "maturity"),
        ]),
        weights: [1.3, 1.2, 1.2, 1.8, 1.6, 1.4, 1],
      });
      renderReportTable({
        title: "Оценка доступа внешних сервисов",
        headers: [
          "Сервис",
          "Влияние на развитие платформ",
          "Обоснование",
        ],
        rows: rows.map((row) => [
          cell(row, "service"),
          cell(row, "impact"),
          cell(row, "rationale"),
        ]),
        weights: [1.5, 1.5, 4],
      });
      return true;
    }
    if (question.key === "user_access") {
      renderReportTable({
        title: "Модель доступа участников к платформам",
        headers: [
          "Платформа",
          "Группы участников",
          "Типы взаимодействия",
          "Механизмы подключения",
          "Открытость",
        ],
        rows: rows.map((row) => [
          cell(row, "platform"),
          cell(row, "participants"),
          cell(row, "interactionTypes"),
          cell(row, "connection"),
          cell(row, "openness"),
        ]),
        weights: [1.2, 1.7, 1.5, 2, 1.6],
      });
      renderReportTable({
        title: "Оценка доступа участников к платформам",
        headers: [
          "Платформа",
          "Группы участников",
          "Ограничения",
          "Влияние на развитие платформ",
          "Обоснование",
        ],
        rows: rows.map((row) => [
          cell(row, "platform"),
          cell(row, "participants"),
          cell(row, "restrictions"),
          cell(row, "impact"),
          cell(row, "rationale"),
        ]),
        weights: [1.2, 1.5, 2, 1.4, 2.5],
      });
      return true;
    }
    return false;
  };
  const renderBarrierTables = (question: Question) => {
    if (question.key !== "barriers" || !Array.isArray(question.value)) {
      return false;
    }
    const rows = question.value as Array<Record<string, unknown>>;
    const columns = new Map(
      (question.config.columns ?? []).map((column) => [column.key, column]),
    );
    const cell = (row: Record<string, unknown>, key: string) =>
      tableText(row[key], columns.get(key));
    const barrierType = (row: Record<string, unknown>) =>
      ["structuralType", "regulatoryType", "technologyType", "otherType"]
        .map((key) => row[key])
        .find((value) => value !== undefined && value !== "")
        ?.toString() ?? "Не заполнено";

    renderReportTable({
      title: "Приоритетный перечень барьеров",
      headers: [
        "Приоритет",
        "Категория",
        "Тип",
        "Наименование",
        "Платформы",
        "Макротранзакции",
        "Участники",
      ],
      rows: rows.map((row, index) => [
        String(index + 1),
        cell(row, "category"),
        barrierType(row),
        cell(row, "name"),
        cell(row, "platforms"),
        cell(row, "macros"),
        cell(row, "participants"),
      ]),
      weights: [0.6, 1, 1.4, 1.8, 1.2, 1.4, 1.4],
    });
    renderReportTable({
      title: "Обоснование и последствия барьеров",
      headers: [
        "Наименование",
        "Наблюдения из предыдущих разделов",
        "Суть и причина",
        "Последствия",
      ],
      rows: rows.map((row) => [
        cell(row, "name"),
        cell(row, "priorEvidence"),
        cell(row, "description"),
        cell(row, "consequences"),
      ]),
      weights: [1.4, 2, 2.4, 2.4],
    });
    renderReportTable({
      title: "Предложения по устранению барьеров",
      headers: [
        "Наименование",
        "Предложение",
        "Участники реализации",
        "Ожидаемый результат",
      ],
      rows: rows.map((row) => [
        cell(row, "name"),
        cell(row, "solution"),
        cell(row, "responsible"),
        cell(row, "expectedResult"),
      ]),
      weights: [1.4, 2.7, 1.8, 2.5],
    });
    return true;
  };
  const renderEffectTables = (question: Question) => {
    if (question.key !== "effects" || !Array.isArray(question.value)) {
      return false;
    }
    const rows = question.value as Array<Record<string, unknown>>;
    const columns = new Map(
      (question.config.columns ?? []).map((column) => [column.key, column]),
    );
    const cell = (row: Record<string, unknown>, key: string) =>
      tableText(row[key], columns.get(key));
    const effectType = (row: Record<string, unknown>) =>
      ["economicType", "socialType", "budgetType"]
        .map((key) => row[key])
        .find((value) => value !== undefined && value !== "")
        ?.toString() ?? "Не заполнено";

    renderReportTable({
      title: "Приоритетный перечень эффектов платформизации",
      headers: [
        "Приоритет",
        "Категория",
        "Тип",
        "Эффект",
        "Ключевые показатели",
        "Платформы",
        "Макротранзакции",
        "Участники",
        "Связанные барьеры",
      ],
      rows: rows.map((row, index) => [
        String(index + 1),
        cell(row, "category"),
        effectType(row),
        cell(row, "name"),
        cell(row, "relatedMetrics"),
        cell(row, "platforms"),
        cell(row, "macros"),
        cell(row, "participants"),
        cell(row, "relatedBarriers"),
      ]),
      weights: [0.5, 0.9, 1.2, 1.6, 1.2, 1, 1.2, 1.2, 1.2],
    });
    renderReportTable({
      title: "Механизм и масштаб эффектов",
      headers: ["Эффект", "Статус", "Масштаб", "Механизм возникновения"],
      rows: rows.map((row) => [
        cell(row, "name"),
        cell(row, "status"),
        cell(row, "scale"),
        cell(row, "mechanism"),
      ]),
      weights: [1.5, 1.5, 1, 3.2],
    });
    renderReportTable({
      title: "Основания оценки эффектов",
      headers: [
        "Эффект",
        "Формат оценки",
        "Количественная оценка",
        "Основание",
        "Обоснование",
        "Условия реализации",
      ],
      rows: rows.map((row) => [
        cell(row, "name"),
        cell(row, "assessmentFormat"),
        cell(row, "quantitativeEstimate"),
        cell(row, "basis"),
        cell(row, "rationale"),
        cell(row, "conditions"),
      ]),
      weights: [1.3, 1.2, 1.5, 1.2, 2.2, 1.8],
    });
    return true;
  };
  const renderInternationalTables = (question: Question) => {
    if (
      question.key !== "international_platforms" ||
      !Array.isArray(question.value)
    ) {
      return false;
    }
    const rows = question.value as Array<Record<string, unknown>>;
    const columns = new Map(
      (question.config.columns ?? []).map((column) => [column.key, column]),
    );
    const cell = (row: Record<string, unknown>, key: string) =>
      tableText(row[key], columns.get(key));
    const presenceCountries = (row: Record<string, unknown>) =>
      [
        Array.isArray(row.countries) && row.countries.length
          ? `Устойчивое присутствие: ${cell(row, "countries")}`
          : "",
        Array.isArray(row.pilotCountries) && row.pilotCountries.length
          ? `Пилотное присутствие: ${cell(row, "pilotCountries")}`
          : "",
      ]
        .filter(Boolean)
        .join("; ") || "—";

    renderReportTable({
      title: "Международное присутствие российских платформ",
      headers: [
        "Платформа",
        "Текущее присутствие",
        "Страны",
        "Каналы экспансии",
        "Перспективные рынки",
        "Потенциал",
        "Доступные показатели",
      ],
      rows: rows.map((row) => [
        cell(row, "platform"),
        cell(row, "presence"),
        presenceCountries(row),
        cell(row, "channels"),
        cell(row, "targetMarkets"),
        cell(row, "potential"),
        cell(row, "indicators"),
      ]),
      weights: [1.2, 1.2, 1.5, 1.7, 1.3, 1, 1.6],
    });
    renderReportTable({
      title: "Обоснование потенциала международной экспансии",
      headers: [
        "Платформа",
        "Основания потенциала",
        "Связанные эффекты",
        "Ограничения",
        "Необходимые условия",
        "Основание оценки",
        "Обоснование",
      ],
      rows: rows.map((row) => [
        cell(row, "platform"),
        cell(row, "advantages"),
        cell(row, "relatedEffects"),
        cell(row, "constraints"),
        cell(row, "conditions"),
        cell(row, "basis"),
        cell(row, "rationale"),
      ]),
      weights: [1.1, 1.8, 1.2, 1.6, 1.8, 1.2, 1.8],
    });
    return true;
  };
  const renderFinalTables = (question: Question) => {
    if (!Array.isArray(question.value)) return false;
    const rows = question.value as Array<Record<string, unknown>>;
    const columns = new Map(
      (question.config.columns ?? []).map((column) => [column.key, column]),
    );
    const cell = (row: Record<string, unknown>, key: string) =>
      tableText(row[key], columns.get(key));

    if (question.key === "target_transactions") {
      renderReportTable({
        title: "Целевые параметры отраслевых транзакций к 2036 году",
        headers: [
          "Макротранзакция",
          "Текущее проникновение",
          "Целевая доля через платформы",
          "Целевая доля участников",
          "Необходимость стандартизации",
          "Сокращение издержек",
        ],
        rows: rows.map((row) => [
          cell(row, "macro"),
          cell(row, "currentShare"),
          cell(row, "targetShare"),
          cell(row, "targetParticipantShare"),
          cell(row, "standardization"),
          cell(row, "costReduction"),
        ]),
        weights: [1.7, 1.2, 1.25, 1.25, 1.6, 1.2],
      });
      renderReportTable({
        title: "Обоснование целевых параметров",
        headers: ["Макротранзакция", "Обоснование"],
        rows: rows.map((row) => [
          cell(row, "macro"),
          cell(row, "targetDescription"),
        ]),
        weights: [1.6, 5.4],
      });
      return true;
    }
    if (question.key === "target_model") {
      renderReportTable({
        title: "Целевое состояние платформенного взаимодействия",
        headers: [
          "Элемент модели",
          "Целевое состояние",
          "Связанные барьеры",
          "Международные ограничения",
        ],
        rows: rows.map((row) => [
          cell(row, "dimension"),
          cell(row, "targetState"),
          cell(row, "linkedBarriers"),
          cell(row, "internationalConstraints"),
        ]),
        weights: [1.2, 3.1, 1.8, 1.8],
      });
      renderReportTable({
        title: "Результаты и условия достижения целевой модели",
        headers: [
          "Элемент модели",
          "Ожидаемые эффекты",
          "Критерий достижения",
          "Условия и риски",
        ],
        rows: rows.map((row) => [
          cell(row, "dimension"),
          cell(row, "linkedEffects"),
          cell(row, "successCriteria"),
          cell(row, "assumptions"),
        ]),
        weights: [1.2, 1.9, 2.4, 2.4],
      });
      return true;
    }
    if (question.key === "recommendations") {
      renderReportTable({
        title: "Приоритетные практические рекомендации",
        headers: [
          "Приоритет",
          "Направление",
          "Рекомендация",
          "Ожидаемые эффекты",
          "Горизонт",
        ],
        rows: rows.map((row, index) => [
          String(index + 1),
          cell(row, "direction"),
          cell(row, "title"),
          cell(row, "effects"),
          cell(row, "horizon"),
        ]),
        weights: [0.6, 1.4, 2.6, 2.2, 1],
      });
      renderReportTable({
        title: "Связи практических рекомендаций",
        headers: [
          "Рекомендация",
          "Связанные барьеры",
          "Платформы / международные ограничения",
        ],
        rows: rows.map((row) => [
          cell(row, "title"),
          cell(row, "barriers"),
          [
            cell(row, "internationalPlatforms"),
            cell(row, "internationalConstraints"),
          ]
            .filter((value) => value && value !== "—")
            .join("; "),
        ]),
        weights: [1.7, 2.2, 3.1],
      });
      renderReportTable({
        title: "Механизм реализации рекомендаций",
        headers: [
          "Рекомендация",
          "Содержание и механизм",
          "Участники",
          "Первый шаг",
        ],
        rows: rows.map((row) => [
          cell(row, "title"),
          cell(row, "action"),
          cell(row, "responsible"),
          cell(row, "firstStep"),
        ]),
        weights: [1.4, 2.7, 1.7, 2.2],
      });
      renderReportTable({
        title: "Проверяемые результаты и риски",
        headers: ["Рекомендация", "Проверяемый результат", "Риски"],
        rows: rows.map((row) => [
          cell(row, "title"),
          cell(row, "expectedResult"),
          cell(row, "risks"),
        ]),
        weights: [1.5, 3.1, 2.4],
      });
      return true;
    }
    if (question.key === "disagreements") {
      if (!rows.length) return true;
      renderReportTable({
        title: "Вопросы, по которым сохраняются разногласия",
        headers: [
          "Предмет",
          "Альтернативные позиции",
          "Аргументы",
          "Возможный способ разрешения",
        ],
        rows: rows.map((row) => [
          cell(row, "issue"),
          cell(row, "positions"),
          cell(row, "arguments"),
          cell(row, "resolution"),
        ]),
        weights: [1.4, 2.3, 2.3, 2],
      });
      return true;
    }
    return false;
  };
  const questionRows = (key: string) => {
    const value = data.questions.find((question) => question.key === key)?.value;
    return Array.isArray(value)
      ? (value as Array<Record<string, unknown>>)
      : [];
  };
  const renderMetricCards = (
    metrics: Array<{ label: string; value: number }>,
  ) => {
    const gap = 10;
    const cardWidth = (document.page.width - 96 - gap) / 2;
    const cardHeight = 58;
    const startY = document.y;
    metrics.forEach((metric, index) => {
      const column = index % 2;
      const row = Math.floor(index / 2);
      const x = 48 + column * (cardWidth + gap);
      const y = startY + row * (cardHeight + gap);
      document
        .roundedRect(x, y, cardWidth, cardHeight, 8)
        .fillAndStroke("#F3F7FC", "#C7D8EF");
      document
        .font("RobotoLikeBold")
        .fontSize(20)
        .fillColor("#0059C7")
        .text(String(metric.value), x + 14, y + 10, {
          width: 48,
          height: 28,
        });
      document
        .font("RobotoLike")
        .fontSize(9.5)
        .fillColor("#333333")
        .text(metric.label, x + 62, y + 13, {
          width: cardWidth - 76,
          height: 35,
          lineGap: 1.5,
        });
    });
    document.y =
      startY + Math.ceil(metrics.length / 2) * (cardHeight + gap);
    document.x = 48;
  };
  const renderModuleSummary = () => {
    document
      .font("RobotoLikeBold")
      .fontSize(14)
      .fillColor("#000000")
      .text("Краткая структура ответа");
    document.moveDown(0.65);

    let metrics: Array<{ label: string; value: number }> = [];
    let highlightLabel = "";
    let highlights: string[] = [];
    let description = "";
    const uniqueCount = (values: unknown[]) =>
      new Set(
        values
          .flatMap((value) => (Array.isArray(value) ? value : [value]))
          .map((value) => String(value ?? "").trim())
          .filter(Boolean),
      ).size;

    switch (data.moduleOrder) {
      case 1: {
        const segments = questionRows("industry_boundaries");
        const stages = questionRows("current_state");
        const keyMetrics = questionRows("key_metrics");
        metrics = [
          { label: "сегменты отрасли", value: segments.length },
          { label: "этапы ретроспективы", value: stages.length },
          { label: "ключевые показатели", value: keyMetrics.length },
          {
            label: "подтверждающие материалы",
            value: data.questions.some(
              (question) =>
                question.key === "segment_assessment_file" &&
                Boolean(attachmentInfo(question.value)),
            )
              ? 1
              : 0,
          },
        ];
        highlightLabel = "КЛЮЧЕВЫЕ ПОКАЗАТЕЛИ";
        highlights = keyMetrics.map((row) => String(row.metric ?? "").trim());
        description =
          "Далее приведены границы и сегменты отрасли, ретроспективная оценка и перечень ключевых показателей.";
        break;
      }
      case 2: {
        const participants = questionRows("participants");
        const macros = questionRows("macrotransactions");
        const micros = questionRows("microtransactions");
        const assessments = questionRows("transaction_assessments");
        metrics = [
          { label: "группы участников", value: participants.length },
          { label: "макротранзакции", value: macros.length },
          { label: "действия в сценариях", value: micros.length },
          {
            label: "действия с высокими издержками",
            value: assessments.filter((row) =>
              String(row.costLevel ?? "")
                .toLocaleLowerCase("ru-RU")
                .includes("высок"),
            ).length,
          },
        ];
        highlightLabel = "ОПИСАННЫЕ МАКРОТРАНЗАКЦИИ";
        highlights = macros.map((row) => String(row.name ?? "").trim());
        description =
          "Далее приведены структура участников, сценарии взаимодействия, последовательности действий и оценка транзакционных издержек.";
        break;
      }
      case 3: {
        const stateFunctions = questionRows("state_functions");
        const formats = questionRows("interaction_formats");
        const platforms = questionRows("platforms");
        const penetration = questionRows("platform_penetration");
        metrics = [
          { label: "функции государства", value: stateFunctions.length },
          { label: "форматы взаимодействия", value: formats.length },
          { label: "действующие платформы", value: platforms.length },
          { label: "оценки проникновения", value: penetration.length },
        ];
        highlightLabel = "ДЕЙСТВУЮЩИЕ ПЛАТФОРМЫ";
        highlights = platforms.map((row) => String(row.name ?? "").trim());
        description =
          "Далее приведены роли государства и рынка, форматы взаимодействия, действующие платформы и оценка их проникновения.";
        break;
      }
      case 4: {
        const dataAccess = questionRows("data_access");
        const serviceAccess = questionRows("service_access");
        const userAccess = questionRows("user_access");
        const restrictions = [...dataAccess, ...serviceAccess, ...userAccess]
          .flatMap((row) =>
            Array.isArray(row.restrictions)
              ? row.restrictions
              : [row.restrictions],
          )
          .filter(Boolean);
        metrics = [
          { label: "категории данных", value: dataAccess.length },
          { label: "внешние сервисы", value: serviceAccess.length },
          { label: "модели доступа участников", value: userAccess.length },
          {
            label: "отмеченные ограничения",
            value: uniqueCount(restrictions),
          },
        ];
        highlightLabel = "КЛЮЧЕВЫЕ ОГРАНИЧЕНИЯ";
        highlights = restrictions.map((value) => String(value ?? "").trim());
        description =
          "Далее приведены модели доступа к данным, внешним сервисам и платформам, а также их ограничения.";
        break;
      }
      case 5: {
        const barriers = questionRows("barriers");
        metrics = [
          { label: "приоритетные барьеры", value: barriers.length },
          {
            label: "категории барьеров",
            value: uniqueCount(barriers.map((row) => row.category)),
          },
          {
            label: "предложения по устранению",
            value: barriers.filter((row) => String(row.solution ?? "").trim())
              .length,
          },
          {
            label: "барьеры с ожидаемым результатом",
            value: barriers.filter((row) =>
              String(row.expectedResult ?? "").trim(),
            ).length,
          },
        ];
        highlightLabel = "ПРИОРИТЕТНЫЕ БАРЬЕРЫ";
        highlights = barriers.map((row) => String(row.name ?? "").trim());
        description =
          "Далее каждый барьер раскрыт через причину, последствия, предложение по устранению и ожидаемый результат.";
        break;
      }
      case 6: {
        const effects = questionRows("effects");
        metrics = [
          { label: "эффекты платформизации", value: effects.length },
          {
            label: "категории эффектов",
            value: uniqueCount(effects.map((row) => row.category)),
          },
          {
            label: "уже наблюдаемые эффекты",
            value: effects.filter((row) =>
              String(row.status ?? "")
                .toLocaleLowerCase("ru-RU")
                .includes("наблю"),
            ).length,
          },
          {
            label: "количественные оценки",
            value: effects.filter((row) =>
              String(row.quantitativeEstimate ?? "").trim(),
            ).length,
          },
        ];
        highlightLabel = "ПРИОРИТЕТНЫЕ ЭФФЕКТЫ";
        highlights = effects.map((row) => String(row.name ?? "").trim());
        description =
          "Далее эффекты раскрыты через механизм возникновения, масштаб, основания оценки и условия реализации.";
        break;
      }
      case 7: {
        const platforms = questionRows("international_platforms");
        metrics = [
          { label: "российские платформы", value: platforms.length },
          {
            label: "перспективные рынки",
            value: uniqueCount(platforms.map((row) => row.targetMarkets)),
          },
          {
            label: "платформы с высоким потенциалом",
            value: platforms.filter((row) =>
              String(row.potential ?? "")
                .toLocaleLowerCase("ru-RU")
                .includes("высок"),
            ).length,
          },
          {
            label: "отмеченные ограничения",
            value: uniqueCount(platforms.map((row) => row.constraints)),
          },
        ];
        highlightLabel = "ПЛАТФОРМЫ ДЛЯ МЕЖДУНАРОДНОЙ ЭКСПАНСИИ";
        highlights = platforms.map((row) => String(row.platform ?? "").trim());
        description =
          "Далее приведены текущее международное присутствие, перспективные рынки, ограничения и необходимые условия.";
        break;
      }
      case 8: {
        const targetTransactions = questionRows("target_transactions");
        const targetModel = questionRows("target_model");
        const recommendations = questionRows("recommendations");
        const disagreements = questionRows("disagreements");
        metrics = [
          {
            label: "целевые макротранзакции",
            value: targetTransactions.length,
          },
          { label: "элементы целевой модели", value: targetModel.length },
          {
            label: "практические рекомендации",
            value: recommendations.length,
          },
          {
            label: "зафиксированные разногласия",
            value: disagreements.length,
          },
        ];
        highlightLabel = "ПРИОРИТЕТНЫЕ РЕКОМЕНДАЦИИ";
        highlights = recommendations.map((row) => {
          const title = String(row.title ?? "").trim();
          const horizon = String(row.horizon ?? "").trim();
          return `${title}${title && horizon ? ` · ${horizon}` : ""}`;
        });
        description =
          "Далее приведены целевые параметры, элементы модели, практические рекомендации, механизмы реализации и зафиксированные разногласия.";
        break;
      }
    }

    renderMetricCards(metrics);
    const visibleHighlights = Array.from(new Set(highlights.filter(Boolean)));
    if (visibleHighlights.length) {
      document
        .font("RobotoLikeBold")
        .fontSize(10)
        .fillColor("#555555")
        .text(highlightLabel);
      document.moveDown(0.35);
      visibleHighlights.slice(0, 6).forEach((name, index) => {
        document
          .font("RobotoLike")
          .fontSize(10)
          .fillColor("#222222")
          .text(`${index + 1}. ${name}`, { lineGap: 2 });
      });
      document.moveDown(0.6);
    }
    document
      .font("RobotoLike")
      .fontSize(9.5)
      .fillColor("#666666")
      .text(description, { lineGap: 2 });
  };

  document
    .font("RobotoLikeBold")
    .fontSize(10)
    .fillColor("#0059C7")
    .text(`ЭКСПЕРТНЫЙ МОДУЛЬ ${String(data.moduleOrder).padStart(2, "0")}`);
  if (data.isPreview) {
    document
      .font("RobotoLikeBold")
      .fontSize(9)
      .fillColor("#8125C8")
      .text("ПРЕДВАРИТЕЛЬНЫЙ ПРОСМОТР");
  }
  document
    .fontSize(22)
    .fillColor("#000000")
    .text(data.moduleTitle, { lineGap: 3 });
  document.moveDown(0.7);
  document.x = document.page.margins.left;
  document
    .font("RobotoLike")
    .fontSize(10)
    .fillColor("#555555")
    .text(`Эксперт: ${data.expertName}`)
    .text(`Компания: ${data.companyName || "—"}`)
    .text(`Подгруппы: ${data.subgroupName || "—"}`)
    .text(`Статус: ${data.statusLabel}`);
  document.moveDown(1);
  divider();
  renderModuleSummary();

  let methodologyTablesRendered = false;
  data.questions.forEach((question, questionIndex) => {
    const tableRendered =
      (data.moduleOrder === 2 && renderTransactionTables(question)) ||
      (data.moduleOrder === 3 && renderStateMarketTables(question)) ||
      (data.moduleOrder === 4 && renderArchitectureTables(question)) ||
      (data.moduleOrder === 5 && renderBarrierTables(question)) ||
      (data.moduleOrder === 6 && renderEffectTables(question)) ||
      (data.moduleOrder === 7 && renderInternationalTables(question)) ||
      (data.moduleOrder === 8 && renderFinalTables(question));
    if (tableRendered) {
      methodologyTablesRendered = true;
      return;
    }
    const isMaterialsQuestion = question.title
      .toLocaleLowerCase("ru-RU")
      .includes("материал");
    if (isMaterialsQuestion && !attachmentInfo(question.value)) return;
    const isCompactTableSection =
      methodologyTablesRendered &&
      (isMaterialsQuestion ||
        (data.moduleOrder === 8 && question.key === "disagreements"));
    if (isCompactTableSection) {
      const attachment = attachmentInfo(question.value);
      if (!attachment) return;
      if (document.y + 92 > document.page.height - 50) {
        document.addPage({ size: "A4", layout: "landscape", margin: 36 });
        landscapePageActive = true;
      } else {
        document.y += 18;
      }
      document
        .font("RobotoLikeBold")
        .fontSize(14)
        .fillColor("#000000")
        .text(question.title, 36, document.y, {
          width: document.page.width - 72,
        });
      document.moveDown(0.5);
      const attachmentUrl = `${data.attachmentBaseUrl.replace(/\/$/, "")}/${encodeURIComponent(attachment.id)}`;
      document
        .font("RobotoLike")
        .fontSize(9.5)
        .fillColor("#0059C7")
        .text(attachment.name, {
          link: attachmentUrl,
          underline: true,
          lineGap: 2,
        });
      return;
    }
    if (methodologyTablesRendered) {
      document.addPage({ size: "A4", layout: "portrait", margin: 48 });
      document.x = 48;
      document.y = 48;
      landscapePageActive = false;
      methodologyTablesRendered = false;
    }
    const genericRows =
      Array.isArray(question.value) &&
      (question.config.columns?.length ?? 0) > 0
        ? (question.value as Array<Record<string, unknown>>)
        : [];
    const estimateGenericRowHeight = (row: Record<string, unknown>) => {
      const width =
        document.page.width -
        document.page.margins.left -
        document.page.margins.right;
      const columns = (question.config.columns ?? []).filter(
        (column) =>
          !column.visibleWhen ||
          matchesFieldCondition(row, column.visibleWhen),
      );
      return (
        28 +
        columns.reduce((height, column) => {
          const rawValue =
            row[column.key] === undefined
              ? column.defaultValue
              : row[column.key];
          const labelHeight = document
            .font("RobotoLikeBold")
            .fontSize(9)
            .heightOfString(column.title, { width });
          const valueHeight = document
            .font("RobotoLike")
            .fontSize(10)
            .heightOfString(printableValue(rawValue, column.options), {
              width,
              lineGap: 2,
            });
          return height + labelHeight + valueHeight + 10;
        }, 0)
      );
    };
    const firstRowHeight = genericRows[0]
      ? estimateGenericRowHeight(genericRows[0])
      : 0;
    const availablePageHeight =
      document.page.height -
      document.page.margins.top -
      document.page.margins.bottom;
    ensureSpace(
      Math.min(
        availablePageHeight,
        firstRowHeight ? firstRowHeight + 62 : 90,
      ),
    );
    document
      .font("RobotoLikeBold")
      .fontSize(9)
      .fillColor("#777777")
      .text(`ВОПРОС ${questionIndex + 1}`);
    document
      .fontSize(14)
      .fillColor("#000000")
      .text(question.title, { lineGap: 2 });
    document.moveDown(0.5);

    if (
      genericRows.length > 0 ||
      (Array.isArray(question.value) &&
        (question.config.columns?.length ?? 0) > 0)
    ) {
      const rows = genericRows;
      if (!rows.length) {
        document
          .font("RobotoLike")
          .fontSize(10)
          .fillColor("#777777")
          .text("Не заполнено");
      }
      rows.forEach((row, rowIndex) => {
        const estimatedHeight = estimateGenericRowHeight(row);
        ensureSpace(
          estimatedHeight <= availablePageHeight
            ? estimatedHeight
            : 70,
        );
        document
          .font("RobotoLikeBold")
          .fontSize(10)
          .fillColor("#0059C7")
          .text(
            `${question.config.rowLabel ?? "Строка"} ${rowIndex + 1}`,
          );
        question.config.columns?.forEach((column) => {
          if (
            column.visibleWhen &&
            !matchesFieldCondition(row, column.visibleWhen)
          ) {
            return;
          }
          ensureSpace(38);
          const rawValue =
            row[column.key] === undefined
              ? column.defaultValue
              : row[column.key];
          document
            .font("RobotoLikeBold")
            .fontSize(9)
            .fillColor("#555555")
            .text(column.title);
          document
            .font("RobotoLike")
            .fontSize(10)
            .fillColor("#222222")
            .text(printableValue(rawValue, column.options), {
              lineGap: 2,
            });
          document.moveDown(0.35);
        });
        document.moveDown(0.5);
      });
    } else {
      const attachment = attachmentInfo(question.value);
      if (attachment) {
        const attachmentUrl = `${data.attachmentBaseUrl.replace(/\/$/, "")}/${encodeURIComponent(attachment.id)}`;
        document
          .font("RobotoLike")
          .fontSize(10)
          .fillColor("#0059C7")
          .text(`Прикреплённый файл: ${attachment.name}`, {
            link: attachmentUrl,
            underline: true,
            lineGap: 3,
          });
      } else {
        document
          .font("RobotoLike")
          .fontSize(10)
          .fillColor("#222222")
          .text(printableValue(question.value, question.config.options), {
            lineGap: 3,
          });
      }
    }
    document.moveDown(0.8);
    divider();
  });

  const pageRange = document.bufferedPageRange();
  const generatedLabel = generatedAt.toLocaleString("ru-RU", {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: "Europe/Moscow",
  });
  for (let pageIndex = 0; pageIndex < pageRange.count; pageIndex += 1) {
    document.switchToPage(pageRange.start + pageIndex);
    const left = document.page.margins.left;
    const right = document.page.width - document.page.margins.right;
    const footerY = document.page.height - 29;
    const originalBottomMargin = document.page.margins.bottom;
    document.page.margins.bottom = 0;
    if (pageIndex > 0) {
      document
        .font("RobotoLikeBold")
        .fontSize(7.5)
        .fillColor("#5D6876")
        .text(
          `МОДУЛЬ ${String(data.moduleOrder).padStart(2, "0")} · ${data.moduleTitle}`,
          left,
          14,
          { width: (right - left) * 0.65, lineBreak: false },
        );
      document
        .font("RobotoLike")
        .fontSize(7.5)
        .fillColor("#5D6876")
        .text(data.expertName, left, 14, {
          width: right - left,
          align: "right",
          lineBreak: false,
        });
    }
    document
      .moveTo(left, footerY - 6)
      .lineTo(right, footerY - 6)
      .lineWidth(0.5)
      .strokeColor("#D9DEE6")
      .stroke();
    document
      .font("RobotoLike")
      .fontSize(7.5)
      .fillColor("#7A8491")
      .text(`Сформировано ${generatedLabel}`, left, footerY, {
        width: right - left,
        lineBreak: false,
      });
    document.text(`Страница ${pageIndex + 1} из ${pageRange.count}`, left, footerY, {
      width: right - left,
      align: "right",
      lineBreak: false,
    });
    document.page.margins.bottom = originalBottomMargin;
  }
  document.end();
  return completed;
}
