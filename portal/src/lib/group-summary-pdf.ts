import { existsSync } from "node:fs";
import PDFDocument from "pdfkit";
import {
  buildAcceptedAnalytics,
  deduplicateAnalyticsSubmissions,
  type AnalyticsSubmission,
} from "./accepted-analytics";

type EconomicData = {
  reportingPeriod?: string | null;
  gdpShare?: number | null;
  gvaShare?: number | null;
  employmentShare?: number | null;
  investmentActivity?: string | null;
  productivityComparison?: string | null;
  source?: string | null;
  comment?: string | null;
} | null;

export type GroupSummaryPdfData = {
  scopeTitle: string;
  scopeKind: "subgroup" | "all";
  generatedBy: string;
  memberCount: number;
  moduleCount: number;
  submissions: AnalyticsSubmission[];
  economicData?: EconomicData;
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

function list(values: Array<{ name: string; mentions?: number; count?: number }>) {
  return (
    values
      .slice(0, 5)
      .map((item) => `${item.name} (${item.mentions ?? item.count ?? 0})`)
      .join(", ") || "—"
  );
}

export async function createGroupSummaryPdf(data: GroupSummaryPdfData) {
  const generatedAt = new Date();
  const uniqueSubmissions = deduplicateAnalyticsSubmissions(data.submissions);
  const analytics = buildAcceptedAnalytics(uniqueSubmissions);
  const experts = new Map<string, { name: string; modules: Set<number> }>();
  uniqueSubmissions.forEach((submission) => {
    const user = submission.assignment.user;
    if (!user) return;
    const current = experts.get(user.id) ?? {
      name: user.fullName,
      modules: new Set<number>(),
    };
    current.modules.add(submission.assignment.module.order);
    experts.set(user.id, current);
  });
  const completedExperts = Array.from(experts.values()).filter(
    (expert) => expert.modules.size === data.moduleCount,
  ).length;
  const moduleCoverage = Array.from({ length: data.moduleCount }, (_, index) => {
    const order = index + 1;
    return {
      order,
      submissions: uniqueSubmissions.filter(
        (submission) => submission.assignment.module.order === order,
      ).length,
    };
  });

  const document = new PDFDocument({
    size: "A4",
    margin: 48,
    bufferPages: true,
    font: fontPath("regular"),
    info: {
      Title: `Итоговый отчёт · ${data.scopeTitle}`,
      Author: data.generatedBy,
    },
  });
  const chunks: Buffer[] = [];
  document.on("data", (chunk: Buffer) => chunks.push(chunk));
  const completed = new Promise<Buffer>((resolve, reject) => {
    document.on("end", () => resolve(Buffer.concat(chunks)));
    document.on("error", reject);
  });
  document.registerFont("Roboto", fontPath("regular"));
  document.registerFont("RobotoBold", fontPath("bold"));
  document.font("Roboto");

  const metricCards = (
    metrics: Array<{ value: number; label: string }>,
  ) => {
    const gap = 10;
    const width = (document.page.width - 96 - gap) / 2;
    const height = 62;
    const startY = document.y;
    metrics.forEach((metric, index) => {
      const x = 48 + (index % 2) * (width + gap);
      const y = startY + Math.floor(index / 2) * (height + gap);
      document
        .roundedRect(x, y, width, height, 8)
        .fillAndStroke("#F3F7FC", "#C7D8EF");
      document
        .font("RobotoBold")
        .fontSize(21)
        .fillColor("#0059C7")
        .text(String(metric.value), x + 14, y + 11, {
          width: 50,
          height: 28,
        });
      document
        .font("Roboto")
        .fontSize(9.5)
        .fillColor("#333333")
        .text(metric.label, x + 66, y + 15, {
          width: width - 80,
          height: 34,
          lineGap: 1.5,
        });
    });
    document.y =
      startY + Math.ceil(metrics.length / 2) * (height + gap);
    document.x = 48;
  };

  document
    .font("RobotoBold")
    .fontSize(10)
    .fillColor("#8125C8")
    .text(
      data.scopeKind === "all"
        ? "СВОД ПО ВСЕМ ПОДГРУППАМ"
        : "ИТОГОВЫЙ ОТЧЁТ ПОДГРУППЫ",
    );
  document
    .font("RobotoBold")
    .fontSize(23)
    .fillColor("#000000")
    .text(data.scopeTitle, { lineGap: 3 });
  document.moveDown(0.7);
  document
    .font("Roboto")
    .fontSize(10)
    .fillColor("#555555")
    .text("Отрасль: Коммуникации, медиа и развлечения")
    .text(`Сформировал: ${data.generatedBy}`)
    .text(
      data.scopeKind === "all"
        ? "Один эксперт учитывается один раз в каждом модуле, даже если состоит в нескольких подгруппах."
        : "Эксперт учитывается в отчёте этой подгруппы независимо от участия в других подгруппах.",
      { lineGap: 2 },
    );
  document.moveDown(1);
  document
    .moveTo(48, document.y)
    .lineTo(document.page.width - 48, document.y)
    .lineWidth(0.7)
    .strokeColor("#D9DEE6")
    .stroke();
  document.moveDown(1);
  metricCards([
    { value: data.memberCount, label: "участники в выбранном контуре" },
    { value: experts.size, label: "эксперты с принятыми ответами" },
    { value: uniqueSubmissions.length, label: "принятые экспертные модули" },
    { value: completedExperts, label: "эксперты, завершившие все модули" },
  ]);
  document
    .font("RobotoBold")
    .fontSize(11)
    .fillColor("#000000")
    .text("Как читать отчёт");
  document.moveDown(0.35);
  document
    .font("Roboto")
    .fontSize(9.5)
    .fillColor("#555555")
    .text(
      "Отчёт содержит только принятые модератором ответы. Медианы, частоты и согласованность рассчитаны по заданным правилам; новые аналитические выводы системой не генерируются.",
      { lineGap: 3 },
    );

  const margin = 36;
  const usableWidth = 841.89 - margin * 2;
  let sectionTitle = "";
  const addLandscapePage = (continued = false) => {
    document.addPage({ size: "A4", layout: "landscape", margin });
    document
      .font("RobotoBold")
      .fontSize(8)
      .fillColor("#8125C8")
      .text("ИТОГОВЫЙ ОТЧЁТ", margin, margin, {
        width: usableWidth,
        characterSpacing: 0.7,
      });
    document
      .font("RobotoBold")
      .fontSize(17)
      .fillColor("#000000")
      .text(`${sectionTitle}${continued ? " · продолжение" : ""}`, margin, document.y + 8, {
        width: usableWidth,
      });
    document.y += 12;
  };
  const startSection = (title: string, description: string) => {
    sectionTitle = title;
    addLandscapePage();
    document
      .font("Roboto")
      .fontSize(9)
      .fillColor("#66717F")
      .text(description, margin, document.y, {
        width: usableWidth,
        lineGap: 2,
      });
    document.y += 12;
  };
  const renderTable = ({
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
    const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
    const widths = weights.map((weight) => (usableWidth * weight) / totalWeight);
    document.font("RobotoBold").fontSize(8.5);
    const headerHeight = Math.max(
      30,
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
        28,
        ...row.map(
          (cell, index) =>
            document
              .font("Roboto")
              .fontSize(8.5)
              .heightOfString(cell || "—", {
                width: widths[index] - 12,
                lineGap: 1.5,
              }) + 14,
        ),
      ),
    );
    const titleHeight =
      document
        .font("RobotoBold")
        .fontSize(13)
        .heightOfString(title, { width: usableWidth }) + 9;
    const drawHeading = () => {
      document
        .font("RobotoBold")
        .fontSize(13)
        .fillColor("#000000")
        .text(title, margin, document.y, { width: usableWidth });
      document.y += 9;
      let x = margin;
      const y = document.y;
      headers.forEach((header, index) => {
        document
          .rect(x, y, widths[index], headerHeight)
          .fillAndStroke("#DDEBFF", "#8FB4E8");
        document
          .font("RobotoBold")
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
    const firstHeight = titleHeight + headerHeight + (rowHeights[0] ?? 28);
    const totalHeight =
      titleHeight +
      headerHeight +
      rowHeights.reduce((sum, height) => sum + height, 0);
    const canFitOnFreshPage = totalHeight < document.page.height - 120;
    if (
      (rows.length <= 10 &&
        canFitOnFreshPage &&
        document.y + totalHeight > document.page.height - 50) ||
      document.y + firstHeight > document.page.height - 50
    ) {
      addLandscapePage(true);
    } else if (document.y > 105) {
      document.y += 16;
    }
    drawHeading();
    if (!rows.length) {
      document
        .font("Roboto")
        .fontSize(9)
        .fillColor("#777777")
        .text("Недостаточно принятых ответов", margin, document.y + 8);
      document.y += 18;
      return;
    }
    rows.forEach((row, rowIndex) => {
      const rowHeight = rowHeights[rowIndex];
      if (document.y + rowHeight > document.page.height - 50) {
        addLandscapePage(true);
        drawHeading();
      }
      let x = margin;
      const y = document.y;
      row.forEach((cell, index) => {
        document
          .rect(x, y, widths[index], rowHeight)
          .fillAndStroke(
            rowIndex % 2 ? "#F8FAFD" : "#FFFFFF",
            "#CFD5DE",
          );
        document
          .font("Roboto")
          .fontSize(8.5)
          .fillColor("#222222")
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

  startSection(
    "Охват данных",
    "Количество принятых модулей и прогресс экспертов в выбранном контуре.",
  );
  renderTable({
    title: "Покрытие по модулям",
    headers: ["Модуль", "Принято ответов"],
    rows: moduleCoverage.map((item) => [
      `Модуль ${String(item.order).padStart(2, "0")}`,
      String(item.submissions),
    ]),
    weights: [3, 1],
  });
  renderTable({
    title: "Прогресс экспертов",
    headers: ["Эксперт", "Принято модулей", "Завершение"],
    rows: Array.from(experts.values())
      .sort((a, b) => a.name.localeCompare(b.name, "ru"))
      .map((expert) => [
        expert.name,
        `${expert.modules.size} из ${data.moduleCount}`,
        expert.modules.size === data.moduleCount ? "Завершил" : "В работе",
      ]),
    weights: [3, 1.2, 1.2],
  });

  startSection(
    "Модуль 01 · Текущее состояние отрасли",
    "Сводные оценки сегментов, ретроспективные факторы и приоритет ключевых показателей.",
  );
  if (data.economicData) {
    renderTable({
      title: "Место отрасли в экономике · данные Минэкономразвития",
      headers: [
        "Период",
        "Доля в ВВП",
        "Доля в ВДС",
        "Доля в занятости",
        "Инвестиционная активность",
      ],
      rows: [[
        data.economicData.reportingPeriod ?? "—",
        data.economicData.gdpShare == null
          ? "—"
          : `${data.economicData.gdpShare}%`,
        data.economicData.gvaShare == null
          ? "—"
          : `${data.economicData.gvaShare}%`,
        data.economicData.employmentShare == null
          ? "—"
          : `${data.economicData.employmentShare}%`,
        data.economicData.investmentActivity ?? "—",
      ]],
      weights: [1, 1, 1, 1.2, 2.4],
    });
  }
  renderTable({
    title: "Карта сегментов",
    headers: [
      "Сегмент",
      "Пользовательская активность",
      "Экономическая доля",
      "Оценок",
      "Согласованность",
    ],
    rows: analytics.segmentComparison.map((item) => [
      item.name,
      item.activity,
      item.economy,
      String(item.responses),
      item.agreement,
    ]),
    weights: [1.8, 1.6, 1.6, 0.7, 1.3],
  });
  renderTable({
    title: "Ретроспективные факторы",
    headers: [
      "Фактор",
      "Период",
      "Негативное",
      "Нейтральное",
      "Позитивное",
    ],
    rows: analytics.factors.map((item) => [
      item.factor,
      item.period,
      String(item.negative),
      String(item.neutral),
      String(item.positive),
    ]),
    weights: [2.8, 1.2, 1, 1, 1],
  });
  renderTable({
    title: "Приоритет ключевых показателей",
    headers: ["Показатель", "Выборов", "Взвешенный балл"],
    rows: analytics.priorityMetrics.map((item) => [
      item.name,
      String(item.selections),
      String(item.score),
    ]),
    weights: [3.5, 1, 1],
  });

  startSection(
    "Модуль 02 · Модель транзакций",
    "Устойчивые маршруты взаимодействия и действия, требующие первоочередной цифровизации.",
  );
  renderTable({
    title: "Маршруты взаимодействия",
    headers: ["Инициатор", "Получатель", "Тип", "Упоминаний"],
    rows: analytics.routes.map((item) => [
      item.initiator,
      item.recipient,
      item.type || "—",
      String(item.count),
    ]),
    weights: [2, 2, 1.2, 0.8],
  });
  renderTable({
    title: "Приоритетные действия",
    headers: [
      "Макротранзакция",
      "Действие",
      "Ответов",
      "Приоритет",
      "Основные источники издержек",
    ],
    rows: analytics.actionPriorities.map((item) => [
      item.macro,
      item.name,
      String(item.responses),
      item.priority,
      list(item.costSources),
    ]),
    weights: [1.6, 1.8, 0.7, 0.9, 2.4],
  });

  startSection(
    "Модуль 03 · Роль государства и рынка",
    "Действующие платформы и медианная оценка проникновения в макротранзакции.",
  );
  renderTable({
    title: "Действующие платформы",
    headers: ["Платформа", "Типы", "Упоминаний"],
    rows: analytics.platforms.map((item) => [
      item.name,
      item.types.join(", ") || "—",
      String(item.mentions),
    ]),
    weights: [2.5, 2.5, 1],
  });
  renderTable({
    title: "Уровень проникновения платформ",
    headers: ["Макротранзакция", "Медиана", "Оценок", "Согласованность"],
    rows: analytics.platformPenetration.map((item) => [
      item.macro,
      item.share,
      String(item.responses),
      item.agreement,
    ]),
    weights: [2.8, 1.3, 0.8, 1.4],
  });

  startSection(
    "Модуль 04 · Архитектура взаимодействия",
    "Наиболее часто отмечаемые ограничения доступа к данным, сервисам и платформам.",
  );
  renderTable({
    title: "Ограничения архитектуры",
    headers: ["Ограничение", "Упоминаний"],
    rows: analytics.architectureConstraints.map((item) => [
      item.name,
      String(item.mentions),
    ]),
    weights: [5, 1],
  });

  startSection(
    "Модуль 05 · Барьеры для развития платформ",
    "Распределение барьеров по категориям и наиболее часто названные барьеры.",
  );
  renderTable({
    title: "Категории барьеров",
    headers: ["Категория", "Упоминаний"],
    rows: analytics.barrierCategories.map((item) => [
      item.category,
      String(item.mentions),
    ]),
    weights: [4, 1],
  });
  renderTable({
    title: "Приоритетные барьеры",
    headers: ["Барьер", "Упоминаний"],
    rows: analytics.barrierNames.map((item) => [
      item.name,
      String(item.mentions),
    ]),
    weights: [5, 1],
  });

  startSection(
    "Модуль 06 · Эффекты платформизации",
    "Распределение эффектов по категориям и статусам реализации.",
  );
  renderTable({
    title: "Категории эффектов",
    headers: ["Категория", "Упоминаний"],
    rows: analytics.effectCategories.map((item) => [
      item.category,
      String(item.mentions),
    ]),
    weights: [4, 1],
  });
  renderTable({
    title: "Статусы эффектов",
    headers: ["Статус", "Упоминаний"],
    rows: analytics.effectStatuses.map((item) => [
      item.status,
      String(item.mentions),
    ]),
    weights: [4, 1],
  });

  startSection(
    "Модуль 07 · Международная экспансия",
    "Оценка потенциала российских платформ, перспективные рынки и ограничения.",
  );
  renderTable({
    title: "Потенциал международной экспансии",
    headers: [
      "Платформа",
      "Потенциал",
      "Оценок",
      "Согласованность",
      "Рынки",
      "Ограничения",
    ],
    rows: analytics.internationalPlatforms.map((item) => [
      item.platform,
      item.potential,
      String(item.responses),
      item.agreement,
      list(item.markets),
      list(item.constraints),
    ]),
    weights: [1.3, 1, 0.7, 1.2, 1.8, 2],
  });

  startSection(
    "Модуль 08 · Выводы и рекомендации",
    "Медианные целевые параметры и распределение практических рекомендаций по направлениям.",
  );
  renderTable({
    title: "Целевые параметры транзакций",
    headers: [
      "Макротранзакция",
      "Доля через платформы",
      "Доля участников",
      "Сокращение издержек",
      "Оценок",
      "Согласованность",
    ],
    rows: analytics.targetTransactions.map((item) => [
      item.macro,
      item.transactionShare,
      item.participantShare,
      item.costReduction,
      String(item.responses),
      item.agreement,
    ]),
    weights: [2.2, 1.3, 1.2, 1.3, 0.7, 1.3],
  });
  renderTable({
    title: "Направления рекомендаций",
    headers: ["Направление", "Упоминаний"],
    rows: analytics.recommendationDirections.map((item) => [
      item.direction,
      String(item.mentions),
    ]),
    weights: [5, 1],
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
    const originalBottom = document.page.margins.bottom;
    document.page.margins.bottom = 0;
    if (pageIndex > 0) {
      document
        .font("RobotoBold")
        .fontSize(7.5)
        .fillColor("#5D6876")
        .text(data.scopeTitle, left, 14, {
          width: (right - left) * 0.7,
          lineBreak: false,
        });
      document
        .font("Roboto")
        .fontSize(7.5)
        .fillColor("#5D6876")
        .text("Только принятые ответы", left, 14, {
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
      .font("Roboto")
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
    document.page.margins.bottom = originalBottom;
  }

  document.end();
  return completed;
}
