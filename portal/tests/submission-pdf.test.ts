import { describe, expect, it } from "vitest";
import { createSubmissionPdf } from "../src/lib/submission-pdf";

describe("submission PDF", () => {
  it("creates a PDF with Cyrillic submission content", async () => {
    const pdf = await createSubmissionPdf({
      moduleOrder: 1,
      moduleTitle: "Текущее состояние отрасли",
      expertName: "Иванов Иван",
      companyName: "Тест",
      subgroupName: "Коммуникации",
      statusLabel: "Черновик",
      attachmentBaseUrl: "https://portal.example/api/attachments",
      questions: [
        {
          key: "analysis_object",
          title: "Границы отрасли",
          config: {
            options: [
              { value: "trade", label: "Торговля" },
              { value: "finance", label: "Финансы" },
            ],
          },
          value: ["trade", "finance"],
        },
      ],
    });

    expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
    expect(pdf.length).toBeGreaterThan(1_000);
  });

  it("adds a server attachment link", async () => {
    const pdf = await createSubmissionPdf({
      moduleOrder: 1,
      moduleTitle: "Текущее состояние отрасли",
      expertName: "Иванов Иван",
      companyName: "Тест",
      subgroupName: "Коммуникации",
      statusLabel: "На рассмотрении модератором",
      attachmentBaseUrl: "https://portal.example/api/attachments",
      questions: [
        {
          key: "transaction_materials",
          title: "Подтверждающие материалы",
          config: {},
          value: { id: "attachment-123", name: "исследование.pdf" },
        },
      ],
    });

    expect(pdf.toString("latin1")).toContain(
      "https://portal.example/api/attachments/attachment-123",
    );
  });

  it("creates methodology-style transaction tables for preview", async () => {
    const pdf = await createSubmissionPdf({
      moduleOrder: 2,
      moduleTitle: "Модель транзакций",
      expertName: "Иванов Иван",
      companyName: "Тест",
      subgroupName: "Коммуникации",
      statusLabel: "Предварительный просмотр · Черновик",
      isPreview: true,
      attachmentBaseUrl: "https://portal.example/api/attachments",
      questions: [
        {
          key: "microtransactions",
          title: "Действия внутри сценария",
          config: {
            columns: [
              { key: "macro", title: "Сценарий" },
              { key: "name", title: "Действие" },
              { key: "actor", title: "Исполнитель" },
              { key: "result", title: "Результат" },
              { key: "executionMode", title: "Выполнение" },
            ],
          },
          value: [
            {
              macro: "Размещение рекламы",
              name: "Согласование условий",
              actor: "Рекламодатель",
              result: "Условия согласованы",
              executionMode: "Преимущественно вручную",
            },
          ],
        },
      ],
    });

    expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
    expect(pdf.length).toBeGreaterThan(2_000);
  });

  it("creates methodology-style state and market tables", async () => {
    const pdf = await createSubmissionPdf({
      moduleOrder: 3,
      moduleTitle: "Роль государства и рынка",
      expertName: "Иванов Иван",
      companyName: "Тест",
      subgroupName: "Коммуникации",
      statusLabel: "Предварительный просмотр · Черновик",
      isPreview: true,
      attachmentBaseUrl: "https://portal.example/api/attachments",
      questions: [
        {
          key: "state_functions",
          title: "Роли и функции государства",
          config: {
            columns: [
              { key: "participant", title: "Участник" },
              {
                key: "role",
                title: "Роль",
                options: [{ value: "Другое", label: "Другое" }],
              },
              { key: "macros", title: "Макротранзакции" },
              { key: "function", title: "Функция" },
              { key: "criticality", title: "Критичность" },
              { key: "executionModel", title: "Модель" },
              { key: "rationale", title: "Обоснование" },
            ],
          },
          value: [
            {
              participant: "Профильное ведомство",
              role: "Другое",
              customRole: "Владелец стандарта",
              macros: ["Распространение контента"],
              function: "Устанавливает единые требования",
              criticality: "Существенно",
              executionModel: "Государство с участием рынка",
              rationale: "Рынок участвует в разработке требований",
            },
          ],
        },
        {
          key: "state_market_materials",
          title: "Подтверждающие материалы",
          config: {},
          value: null,
        },
      ],
    });

    expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
    expect(pdf.length).toBeGreaterThan(2_000);
  });

  it("creates methodology-style architecture tables", async () => {
    const pdf = await createSubmissionPdf({
      moduleOrder: 4,
      moduleTitle: "Архитектура взаимодействия",
      expertName: "Иванов Иван",
      companyName: "Тест",
      subgroupName: "Коммуникации",
      statusLabel: "Предварительный просмотр · Черновик",
      isPreview: true,
      attachmentBaseUrl: "https://portal.example/api/attachments",
      questions: [
        {
          key: "data_access",
          title: "Доступ платформ к данным",
          config: {
            columns: [
              { key: "data", title: "Категория данных" },
              { key: "platforms", title: "Платформы" },
              { key: "macros", title: "Макротранзакции" },
              { key: "owner", title: "Владелец" },
              { key: "accessModel", title: "Модель доступа" },
              { key: "quality", title: "Качество" },
              { key: "restrictions", title: "Ограничения" },
              { key: "impact", title: "Влияние" },
              { key: "rationale", title: "Обоснование" },
            ],
          },
          value: [
            {
              data: "Данные об аудитории",
              platforms: ["VK Видео"],
              macros: ["Распространение контента"],
              owner: "Платформа",
              accessModel: "Доступ по соглашению",
              quality: "Средние",
              restrictions: ["Фрагментированное владение данными"],
              impact: "Скорее ограничивает",
              rationale: "Нет единых правил измерения",
            },
          ],
        },
        {
          key: "architecture_materials",
          title: "Подтверждающие материалы",
          config: {},
          value: null,
        },
      ],
    });

    expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
    expect(pdf.length).toBeGreaterThan(2_000);
  });

  it("creates methodology-style barrier tables", async () => {
    const pdf = await createSubmissionPdf({
      moduleOrder: 5,
      moduleTitle: "Барьеры для развития платформ",
      expertName: "Иванов Иван",
      companyName: "Тест",
      subgroupName: "Коммуникации",
      statusLabel: "Предварительный просмотр · Черновик",
      isPreview: true,
      attachmentBaseUrl: "https://portal.example/api/attachments",
      questions: [
        {
          key: "barriers",
          title: "Реестр барьеров",
          config: {
            columns: [
              { key: "category", title: "Категория" },
              { key: "technologyType", title: "Тип" },
              { key: "name", title: "Название" },
              { key: "platforms", title: "Платформы" },
              { key: "macros", title: "Макротранзакции" },
              { key: "participants", title: "Участники" },
              { key: "priorEvidence", title: "Наблюдения" },
              { key: "description", title: "Суть" },
              { key: "consequences", title: "Последствия" },
              { key: "solution", title: "Предложение" },
              { key: "responsible", title: "Участники реализации" },
              { key: "expectedResult", title: "Результат" },
            ],
          },
          value: [
            {
              category: "Технологический",
              technologyType: "Недостаточная интероперабельность систем",
              name: "Нет единого стандарта измерения аудитории",
              platforms: ["VK Видео", "RUTUBE"],
              macros: ["Монетизация видео через рекламу"],
              participants: ["Рекламодатели"],
              priorEvidence: ["Несовместимость систем"],
              description: "Платформы используют несопоставимые показатели",
              consequences: "Рекламодатели не могут сравнивать результат",
              solution: "Согласовать отраслевой стандарт показателей",
              responsible: ["Операторы платформ", "Отраслевые объединения"],
              expectedResult: "Отчётность сопоставима между платформами",
            },
          ],
        },
        {
          key: "barrier_materials",
          title: "Подтверждающие материалы",
          config: {},
          value: null,
        },
      ],
    });

    expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
    expect(pdf.length).toBeGreaterThan(2_000);
  });

  it("creates methodology-style effect tables", async () => {
    const pdf = await createSubmissionPdf({
      moduleOrder: 6,
      moduleTitle: "Эффекты платформизации отрасли",
      expertName: "Иванов Иван",
      companyName: "Тест",
      subgroupName: "Коммуникации",
      statusLabel: "Предварительный просмотр · Черновик",
      isPreview: true,
      attachmentBaseUrl: "https://portal.example/api/attachments",
      questions: [
        {
          key: "effects",
          title: "Реестр эффектов платформизации",
          config: {
            columns: [
              { key: "category", title: "Категория" },
              { key: "economicType", title: "Тип" },
              { key: "name", title: "Эффект" },
              { key: "relatedMetrics", title: "Показатели" },
              { key: "platforms", title: "Платформы" },
              { key: "macros", title: "Макротранзакции" },
              { key: "participants", title: "Участники" },
              { key: "relatedBarriers", title: "Барьеры" },
              { key: "status", title: "Статус" },
              { key: "scale", title: "Масштаб" },
              { key: "mechanism", title: "Механизм" },
              { key: "assessmentFormat", title: "Формат" },
              { key: "quantitativeEstimate", title: "Оценка" },
              { key: "basis", title: "Основание" },
              { key: "rationale", title: "Обоснование" },
              { key: "conditions", title: "Условия" },
            ],
          },
          value: [
            {
              category: "Экономический",
              economicType: "Снижение транзакционных издержек",
              name: "Сокращение времени согласования размещения",
              relatedMetrics: ["Эффективность монетизации"],
              platforms: ["VK Видео"],
              macros: ["Монетизация видео через рекламу"],
              participants: ["Рекламодатели"],
              relatedBarriers: ["Нет единого стандарта измерения"],
              status: "Начинает проявляться",
              scale: "Высокий",
              mechanism: "Платформа автоматизирует подбор и отчётность",
              assessmentFormat: "Экспертная качественная оценка",
              basis: "Экспертная оценка",
              rationale: "Часть операций выполняется автоматически",
            },
          ],
        },
        {
          key: "effect_materials",
          title: "Подтверждающие материалы",
          config: {},
          value: null,
        },
      ],
    });

    expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
    expect(pdf.length).toBeGreaterThan(2_000);
  });

  it("creates methodology-style international expansion tables", async () => {
    const pdf = await createSubmissionPdf({
      moduleOrder: 7,
      moduleTitle: "Международная экспансия",
      expertName: "Иванов Иван",
      companyName: "Тест",
      subgroupName: "Коммуникации",
      statusLabel: "Предварительный просмотр · Черновик",
      isPreview: true,
      attachmentBaseUrl: "https://portal.example/api/attachments",
      questions: [
        {
          key: "international_platforms",
          title: "Международное присутствие и потенциал платформ",
          config: {
            columns: [
              { key: "platform", title: "Платформа" },
              { key: "presence", title: "Присутствие" },
              { key: "countries", title: "Страны" },
              { key: "pilotCountries", title: "Пилотные страны" },
              { key: "channels", title: "Каналы" },
              { key: "targetMarkets", title: "Рынки" },
              { key: "potential", title: "Потенциал" },
              { key: "indicators", title: "Показатели" },
              { key: "advantages", title: "Преимущества" },
              { key: "relatedEffects", title: "Эффекты" },
              { key: "constraints", title: "Ограничения" },
              { key: "conditions", title: "Условия" },
              { key: "basis", title: "Основание" },
              { key: "rationale", title: "Обоснование" },
            ],
          },
          value: [
            {
              platform: "VK Видео",
              presence: "Ограниченное или пилотное присутствие",
              pilotCountries: ["Казахстан", "Беларусь"],
              channels: ["Иностранные пользователи на зарубежных рынках"],
              targetMarkets: ["СНГ"],
              potential: "Средний",
              indicators: "",
              advantages: "Русскоязычный контент и рекомендательные технологии",
              relatedEffects: ["Рост доходов авторов"],
              constraints: ["Языковая и продуктовая локализация"],
              conditions: "Локальные партнёрства и продвижение",
              basis: "Экспертная оценка",
              rationale: "Потенциал выше на русскоязычных рынках",
            },
          ],
        },
        {
          key: "international_materials",
          title: "Подтверждающие материалы",
          config: {},
          value: null,
        },
      ],
    });

    expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
    expect(pdf.length).toBeGreaterThan(2_000);
  });

  it("creates methodology-style final target model tables", async () => {
    const pdf = await createSubmissionPdf({
      moduleOrder: 8,
      moduleTitle: "Выводы и рекомендации",
      expertName: "Иванов Иван",
      companyName: "Тест",
      subgroupName: "Коммуникации",
      statusLabel: "Предварительный просмотр · Черновик",
      isPreview: true,
      attachmentBaseUrl: "https://portal.example/api/attachments",
      questions: [
        {
          key: "target_transactions",
          title: "Целевая модель отраслевых транзакций",
          config: {
            columns: [
              { key: "macro", title: "Макротранзакция" },
              { key: "currentShare", title: "Текущее проникновение" },
              { key: "targetShare", title: "Целевая доля" },
              {
                key: "targetParticipantShare",
                title: "Целевая доля участников",
              },
              { key: "standardization", title: "Стандартизация" },
              { key: "costReduction", title: "Сокращение издержек" },
              { key: "targetDescription", title: "Обоснование" },
            ],
          },
          value: [
            {
              macro: "Монетизация видео через рекламу",
              currentShare: "30–50%",
              targetShare: "Более 50%",
              targetParticipantShare: "Более 50%",
              standardization:
                "Требуется стандартизация отдельных элементов",
              costReduction: "10–25%",
              targetDescription:
                "Через платформы проходят подбор, согласование и отчётность.",
            },
          ],
        },
        {
          key: "target_model",
          title: "Целевая модель платформенного взаимодействия",
          config: {
            columns: [
              { key: "dimension", title: "Элемент модели" },
              { key: "targetState", title: "Целевое состояние" },
              { key: "linkedBarriers", title: "Барьеры" },
              { key: "linkedEffects", title: "Эффекты" },
              { key: "successCriteria", title: "Критерий" },
              { key: "assumptions", title: "Условия и риски" },
            ],
          },
          value: [
            {
              dimension: "Распределение ролей государства и рынка",
              targetState: "Государство задаёт единые требования к измерению.",
              linkedBarriers: ["Нет единого стандарта измерения"],
              linkedEffects: ["Снижение издержек согласования"],
              successCriteria: "Участники применяют сопоставимые показатели.",
              assumptions: "Необходим отраслевой консенсус.",
            },
          ],
        },
        {
          key: "recommendations",
          title: "Практические рекомендации",
          config: {
            columns: [
              { key: "direction", title: "Направление" },
              { key: "title", title: "Рекомендация" },
              { key: "barriers", title: "Барьеры" },
              { key: "action", title: "Механизм" },
              { key: "responsible", title: "Участники" },
              { key: "firstStep", title: "Первый шаг" },
              { key: "horizon", title: "Горизонт" },
              { key: "effects", title: "Эффекты" },
              { key: "expectedResult", title: "Результат" },
              { key: "risks", title: "Риски" },
            ],
          },
          value: [
            {
              direction: "Транзакции и стандартизация",
              title: "Согласовать стандарт измерения аудитории",
              barriers: ["Нет единого стандарта измерения"],
              action: "Сформировать и апробировать отраслевую методику.",
              responsible: ["Операторы платформ", "Отраслевые объединения"],
              firstStep: "Создать рабочую группу.",
              horizon: "2026–2028",
              effects: ["Снижение издержек согласования"],
              expectedResult: "Методику применяют крупнейшие платформы.",
              risks: "Несопоставимость исходных данных.",
            },
          ],
        },
      ],
    });

    expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
    expect(pdf.length).toBeGreaterThan(2_000);
  });
});
