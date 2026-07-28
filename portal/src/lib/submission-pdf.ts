import { existsSync } from "node:fs";
import PDFDocument from "pdfkit";

type Option = { value: string; label: string };
type Column = {
  key: string;
  title: string;
  options?: Option[];
  defaultValue?: string;
  visibleWhen?: { columnKey: string; equals: string };
};
type Question = {
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

  document
    .font("RobotoLikeBold")
    .fontSize(10)
    .fillColor("#0059C7")
    .text(`ЭКСПЕРТНЫЙ МОДУЛЬ ${String(data.moduleOrder).padStart(2, "0")}`);
  document
    .fontSize(22)
    .fillColor("#000000")
    .text(data.moduleTitle, { lineGap: 3 });
  document.moveDown(0.7);
  document
    .font("RobotoLike")
    .fontSize(10)
    .fillColor("#555555")
    .text(`Эксперт: ${data.expertName}`)
    .text(`Компания: ${data.companyName || "—"}`)
    .text(`Подгруппа: ${data.subgroupName || "—"}`)
    .text(`Статус: ${data.statusLabel}`);
  document.moveDown(1);
  divider();

  data.questions.forEach((question, questionIndex) => {
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
            row[column.visibleWhen.columnKey] !== column.visibleWhen.equals
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
      document
        .font("RobotoLike")
        .fontSize(10)
        .fillColor("#222222")
        .text(printableValue(question.value, question.config.options), {
          lineGap: 3,
        });
    }
    document.moveDown(0.8);
    divider();
  });

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
