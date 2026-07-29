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
    kind === "bold" ? "DejaVuSans-Bold.ttf" : "DejaVuSans.ttf";
  const candidates = [
    process.env.PDF_FONT_DIR
      ? `${process.env.PDF_FONT_DIR}/${fileName}`
      : "",
    `/usr/share/fonts/dejavu/${fileName}`,
    `/usr/share/fonts/ttf-dejavu/${fileName}`,
    `/usr/share/fonts/truetype/dejavu/${fileName}`,
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
  const document = new PDFDocument({
    size: "A4",
    margin: 48,
    font: regularFont,
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

  const pageBottom = () => document.page.height - 48;
  const ensureSpace = (height: number) => {
    if (document.y + height > pageBottom()) document.addPage();
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
    const headerHeight = 32;
    const pageWidth = 841.89;
    const usableWidth = pageWidth - margin * 2;
    const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
    const widths = weights.map((weight) => (usableWidth * weight) / totalWeight);

    const addTablePage = () => {
      document.addPage({ size: "A4", layout: "landscape", margin });
      document
        .font("RobotoLikeBold")
        .fontSize(13)
        .fillColor("#000000")
        .text(title, margin, margin, { width: usableWidth });
      document.y += 10;
      let x = margin;
      const y = document.y;
      headers.forEach((header, index) => {
        document
          .rect(x, y, widths[index], headerHeight)
          .fillAndStroke("#E0EEFF", "#9CBCE3");
        document
          .font("RobotoLikeBold")
          .fontSize(7.5)
          .fillColor("#003F8F")
          .text(header, x + 5, y + 7, {
            width: widths[index] - 10,
            height: headerHeight - 10,
          });
        x += widths[index];
      });
      document.y = y + headerHeight;
    };

    addTablePage();
    if (!rows.length) {
      document
        .font("RobotoLike")
        .fontSize(9)
        .fillColor("#777777")
        .text("Не заполнено", margin, document.y + 10);
      return;
    }

    rows.forEach((row) => {
      const rowHeight = Math.max(
        28,
        ...row.map((cell, index) =>
          document
            .font("RobotoLike")
            .fontSize(7.5)
            .heightOfString(cell || "—", {
              width: widths[index] - 10,
              lineGap: 1,
            }) + 12,
        ),
      );
      if (document.y + rowHeight > document.page.height - margin) {
        addTablePage();
      }
      let x = margin;
      const y = document.y;
      row.forEach((cell, index) => {
        document.rect(x, y, widths[index], rowHeight).strokeColor("#D9D9D9").stroke();
        document
          .font("RobotoLike")
          .fontSize(7.5)
          .fillColor("#222222")
          .text(cell || "—", x + 5, y + 6, {
            width: widths[index] - 10,
            height: rowHeight - 10,
            lineGap: 1,
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
        title: "Ключевые сценарии взаимодействия (макротранзакции)",
        headers: [
          "Сегменты",
          "Макротранзакция",
          "Инициатор",
          "Получатель",
          "Предмет транзакции",
          "Тип",
          "Суть и результат",
        ],
        rows: rows.map((row) => [
          cell(row, "segments"),
          cell(row, "name"),
          cell(row, "initiator"),
          cell(row, "recipient"),
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
          cell(row, "transactionType"),
          cell(row, "description"),
        ]),
        weights: [1.2, 1.5, 1.2, 1.2, 1.5, 0.8, 2],
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

  let methodologyTablesRendered = false;
  data.questions.forEach((question, questionIndex) => {
    const tableRendered =
      (data.moduleOrder === 2 && renderTransactionTables(question)) ||
      (data.moduleOrder === 3 && renderStateMarketTables(question)) ||
      (data.moduleOrder === 4 && renderArchitectureTables(question));
    if (tableRendered) {
      methodologyTablesRendered = true;
      return;
    }
    if (methodologyTablesRendered) {
      document.addPage({ size: "A4", layout: "portrait", margin: 48 });
      document.x = 48;
      document.y = 48;
      methodologyTablesRendered = false;
    }
    ensureSpace(90);
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
      Array.isArray(question.value) &&
      (question.config.columns?.length ?? 0) > 0
    ) {
      const rows = question.value as Array<Record<string, unknown>>;
      if (!rows.length) {
        document
          .font("RobotoLike")
          .fontSize(10)
          .fillColor("#777777")
          .text("Не заполнено");
      }
      rows.forEach((row, rowIndex) => {
        ensureSpace(70);
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

  document.x = document.page.margins.left;
  document
    .font("RobotoLike")
    .fontSize(8)
    .fillColor("#777777")
    .text(
      `Сформировано ${new Date().toLocaleString("ru-RU", {
        dateStyle: "long",
        timeStyle: "short",
        timeZone: "Europe/Moscow",
      })}`,
    );
  document.end();
  return completed;
}
