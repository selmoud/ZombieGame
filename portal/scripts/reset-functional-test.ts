import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";
import {
  Prisma,
  PrismaClient,
  type Question,
  type User,
} from "../src/generated/prisma/client";
import { validateAnswers } from "../src/lib/answer-validation";
import { hashPassword } from "../src/lib/password";
import { createExpertLinkCode } from "../src/lib/expert-link-code";
import { isQuestionHidden } from "../src/lib/questions";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is required");
if (process.env.ALLOW_FUNCTIONAL_TEST_RESET !== "I_UNDERSTAND_DATA_WILL_BE_DELETED") {
  throw new Error(
    "Set ALLOW_FUNCTIONAL_TEST_RESET=I_UNDERSTAND_DATA_WILL_BE_DELETED to run the destructive reset",
  );
}
const functionalTestPasswordSecret =
  process.env.FUNCTIONAL_TEST_PASSWORD_SECRET ?? "";
if (functionalTestPasswordSecret.length < 16) {
  throw new Error("FUNCTIONAL_TEST_PASSWORD_SECRET must contain at least 16 characters");
}

const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});

const ADMIN_ID = "00000000-0000-4000-8000-000000000001";
const INDUSTRY = "Коммуникации, медиа и развлечения";
const SUBGROUPS = [
  "Авторский контент",
  "Коммуникации",
  "Развлечения",
  "ТВ, радио, СМИ",
] as const;

type SubgroupName = (typeof SUBGROUPS)[number];

type Profile = {
  id: string;
  fullName: string;
  company: string;
  position: string;
  direction: string;
  experienceSummary: string;
  expertiseReason: string;
  primarySubgroup: SubgroupName;
  secondarySubgroup?: SubgroupName;
  isLeader?: boolean;
};

type ExpertContext = {
  segments: string[];
  participants: string[];
  macros: string[];
  microtransactions: Array<{
    macro: string;
    name: string;
    actor: string;
    result: string;
    executionMode: string;
  }>;
  platforms: string[];
  metrics: string[];
  barriers: string[];
  effects: string[];
  internationalConstraints: string[];
};

type JsonRecord = Record<string, Prisma.InputJsonValue>;

const profiles: Profile[] = [
  {
    id: "10000000-0000-4000-8000-000000000001",
    fullName: "Анна Белова",
    company: "VK Видео",
    position: "Директор по развитию коммуникационных продуктов",
    direction: "Цифровые коммуникации",
    experienceSummary:
      "14 лет развивает социальные и коммуникационные сервисы, включая продукты с многомиллионной аудиторией.",
    expertiseReason:
      "Знает экономику платформ, поведение аудитории и практику масштабирования коммуникационных сервисов.",
    primarySubgroup: "Коммуникации",
    isLeader: true,
  },
  {
    id: "10000000-0000-4000-8000-000000000002",
    fullName: "Борис Воронцов",
    company: "МТС Медиа",
    position: "Руководитель продуктовой аналитики",
    direction: "Аналитика аудитории",
    experienceSummary:
      "10 лет исследует пользовательские сценарии, подписные модели и удержание аудитории.",
    expertiseReason:
      "Обладает практическими данными о пользовательской активности и монетизации цифровых сервисов.",
    primarySubgroup: "Коммуникации",
  },
  {
    id: "10000000-0000-4000-8000-000000000003",
    fullName: "Вера Громова",
    company: "Яндекс",
    position: "Руководитель направления доверия и безопасности",
    direction: "Безопасность платформ",
    experienceSummary:
      "12 лет занимается модерацией, идентификацией и безопасностью пользовательских платформ.",
    expertiseReason:
      "Может оценить регуляторные, технологические и репутационные ограничения цифровых коммуникаций.",
    primarySubgroup: "Коммуникации",
  },
  {
    id: "10000000-0000-4000-8000-000000000004",
    fullName: "Глеб Данилов",
    company: "Ростелеком",
    position: "Директор по платформенной архитектуре",
    direction: "Инфраструктура и данные",
    experienceSummary:
      "15 лет проектирует высоконагруженные цифровые платформы, API и контуры обмена данными.",
    expertiseReason:
      "Понимает технические зависимости между коммуникационными, медийными и инфраструктурными сервисами.",
    primarySubgroup: "Коммуникации",
    secondarySubgroup: "ТВ, радио, СМИ",
  },
  {
    id: "10000000-0000-4000-8000-000000000005",
    fullName: "Дарья Ершова",
    company: "Дзен",
    position: "Директор по работе с авторами",
    direction: "Авторские экосистемы",
    experienceSummary:
      "11 лет развивает инструменты создания, распространения и монетизации авторского контента.",
    expertiseReason:
      "Знает потребности авторов, рекламодателей и платформ на всех этапах контентной цепочки.",
    primarySubgroup: "Авторский контент",
    isLeader: true,
  },
  {
    id: "10000000-0000-4000-8000-000000000006",
    fullName: "Егор Жуков",
    company: "RUTUBE",
    position: "Руководитель видеопродукта",
    direction: "Онлайн-видео",
    experienceSummary:
      "9 лет отвечает за видеосервисы, рекомендательные механизмы и инструменты публикации.",
    expertiseReason:
      "Имеет опыт роста платформенной аудитории и организации взаимодействия авторов с пользователями.",
    primarySubgroup: "Авторский контент",
  },
  {
    id: "10000000-0000-4000-8000-000000000007",
    fullName: "Ирина Зайцева",
    company: "ЛитРес",
    position: "Директор по цифровому контенту",
    direction: "Издательские платформы",
    experienceSummary:
      "13 лет работает с цифровыми правами, каталогами и моделями вознаграждения правообладателей.",
    expertiseReason:
      "Может оценить транзакции, данные и барьеры в цепочке создания и распространения контента.",
    primarySubgroup: "Авторский контент",
  },
  {
    id: "10000000-0000-4000-8000-000000000008",
    fullName: "Кирилл Ильин",
    company: "Газпром-Медиа",
    position: "Директор по цифровой дистрибуции",
    direction: "Дистрибуция и монетизация",
    experienceSummary:
      "16 лет управляет распространением медиаконтента, рекламными продуктами и партнёрскими каналами.",
    expertiseReason:
      "Соединяет экспертизу традиционных медиа, цифровых платформ и авторского рынка.",
    primarySubgroup: "Авторский контент",
    secondarySubgroup: "ТВ, радио, СМИ",
  },
  {
    id: "10000000-0000-4000-8000-000000000009",
    fullName: "Лидия Котова",
    company: "Яндекс Афиша",
    position: "Директор по развитию",
    direction: "Развлекательные сервисы",
    experienceSummary:
      "12 лет развивает билетные сервисы, программы лояльности и цифровые каналы организаторов.",
    expertiseReason:
      "Знает экономику мероприятий и точки цифровизации взаимодействия площадок, организаторов и зрителей.",
    primarySubgroup: "Развлечения",
    isLeader: true,
  },
  {
    id: "10000000-0000-4000-8000-000000000010",
    fullName: "Максим Лебедев",
    company: "Kassir.ru",
    position: "Руководитель коммерческих продуктов",
    direction: "Билетные платформы",
    experienceSummary:
      "10 лет занимается билетными транзакциями, динамическим ценообразованием и партнёрскими интеграциями.",
    expertiseReason:
      "Может оценить транзакционные издержки и барьеры платформизации событийного рынка.",
    primarySubgroup: "Развлечения",
  },
  {
    id: "10000000-0000-4000-8000-000000000011",
    fullName: "Надежда Морозова",
    company: "Lesta Games",
    position: "Директор по операционной стратегии",
    direction: "Игровые платформы",
    experienceSummary:
      "13 лет работает с игровыми экосистемами, сообществами, платежами и международной дистрибуцией.",
    expertiseReason:
      "Понимает сетевые эффекты, цифровую монетизацию и международный потенциал развлекательных платформ.",
    primarySubgroup: "Развлечения",
  },
  {
    id: "10000000-0000-4000-8000-000000000012",
    fullName: "Олег Никитин",
    company: "МТС Live",
    position: "Руководитель партнёрских программ",
    direction: "Мероприятия и партнёрства",
    experienceSummary:
      "8 лет строит партнёрские цепочки между артистами, площадками, организаторами и цифровыми сервисами.",
    expertiseReason:
      "Имеет прикладной опыт платформизации офлайн- и онлайн-развлечений.",
    primarySubgroup: "Развлечения",
    secondarySubgroup: "Авторский контент",
  },
  {
    id: "10000000-0000-4000-8000-000000000013",
    fullName: "Полина Орлова",
    company: "Национальная Медиа Группа",
    position: "Директор по стратегии",
    direction: "Телевидение и медиарынок",
    experienceSummary:
      "17 лет занимается стратегией телевидения, онлайн-кинотеатров и цифровой рекламой.",
    expertiseReason:
      "Обладает системным взглядом на трансформацию вещания и конкуренцию традиционных и цифровых каналов.",
    primarySubgroup: "ТВ, радио, СМИ",
    isLeader: true,
  },
  {
    id: "10000000-0000-4000-8000-000000000014",
    fullName: "Роман Петров",
    company: "РБК",
    position: "Директор цифровых продуктов",
    direction: "Цифровые СМИ",
    experienceSummary:
      "14 лет развивает новостные продукты, подписку, аналитику аудитории и рекламную монетизацию.",
    expertiseReason:
      "Знает продуктовую и экономическую модель цифровых СМИ и требования к качеству данных.",
    primarySubgroup: "ТВ, радио, СМИ",
  },
  {
    id: "10000000-0000-4000-8000-000000000015",
    fullName: "Софья Романова",
    company: "ВГТРК",
    position: "Руководитель цифровой трансформации",
    direction: "Вещательные платформы",
    experienceSummary:
      "15 лет работает на стыке эфирного вещания, цифровых архивов и интернет-дистрибуции.",
    expertiseReason:
      "Может оценить роль государства, инфраструктурные ограничения и доступность медиаконтента.",
    primarySubgroup: "ТВ, радио, СМИ",
  },
  {
    id: "10000000-0000-4000-8000-000000000016",
    fullName: "Тимур Соколов",
    company: "Коммерсантъ",
    position: "Директор по развитию медиаплатформ",
    direction: "Издательские и рекламные продукты",
    experienceSummary:
      "12 лет развивает подписку, рекламные кабинеты и цифровое распространение делового контента.",
    expertiseReason:
      "Объединяет экспертизу в редакционных процессах, рекламе и платформенной дистрибуции.",
    primarySubgroup: "ТВ, радио, СМИ",
    secondarySubgroup: "Коммуникации",
  },
];

const segmentSets: Record<SubgroupName, string[]> = {
  Коммуникации: [
    "Мессенджеры и коммуникационные сервисы",
    "Социальные сети и сообщества",
  ],
  "Авторский контент": [
    "Авторский контент и блоговые платформы",
    "Онлайн-видео и видеосервисы",
  ],
  Развлечения: [
    "Игры и интерактивные развлечения",
    "Развлекательные мероприятия и билетные сервисы",
  ],
  "ТВ, радио, СМИ": [
    "Телевидение и вещание",
    "СМИ и цифровые издательские платформы",
  ],
};

const participantSets: Record<SubgroupName, string[]> = {
  Коммуникации: [
    "Пользователи коммуникационных сервисов",
    "Создатели сообществ и каналов",
    "Операторы коммуникационных платформ",
    "Регуляторы цифровой среды",
  ],
  "Авторский контент": [
    "Авторы и правообладатели",
    "Пользователи контента",
    "Контентные платформы",
    "Рекламодатели и партнёры",
  ],
  Развлечения: [
    "Организаторы и разработчики",
    "Зрители и игроки",
    "Развлекательные платформы",
    "Площадки и билетные операторы",
  ],
  "ТВ, радио, СМИ": [
    "Редакции и вещатели",
    "Аудитория медиа",
    "Медиаплатформы и дистрибьюторы",
    "Рекламодатели и агентства",
  ],
};

const macroSets: Record<SubgroupName, string[]> = {
  Коммуникации: [
    "Создание и распространение сообщений и сообществ",
    "Монетизация коммуникационной аудитории",
  ],
  "Авторский контент": [
    "Создание и распространение авторского контента",
    "Монетизация контента и расчёты с авторами",
  ],
  Развлечения: [
    "Создание и продажа развлекательного продукта",
    "Организация доступа и расчётов с аудиторией",
  ],
  "ТВ, радио, СМИ": [
    "Создание и распространение медиаконтента",
    "Монетизация аудитории и рекламного инвентаря",
  ],
};

const platformSets: Record<SubgroupName, string[]> = {
  Коммуникации: ["VK Мессенджер", "MAX"],
  "Авторский контент": ["Дзен", "RUTUBE"],
  Развлечения: ["Яндекс Афиша", "VK Play"],
  "ТВ, радио, СМИ": ["Смотрим", "VK Видео"],
};

const metricPool = [
  "Охват и активная аудитория цифровых платформ",
  "Доля цифровых каналов в выручке отрасли",
  "Объём транзакций через цифровые платформы",
  "Среднее время взаимодействия пользователя с сервисом",
  "Доля российских платформ в пользовательской активности",
];

function rotate<T>(values: T[], offset: number) {
  return values.map((_, index) => values[(index + offset) % values.length]);
}

function buildModuleAnswers(
  order: number,
  profile: Profile,
  index: number,
  context: ExpertContext,
): JsonRecord {
  const shortName = profile.fullName.split(" ")[1];
  const activityShares = [
    "Заметная — 10–25%",
    "Крупная — 25–50%",
    "Доминирующая — более 50%",
    "Небольшая — 5–10%",
  ];
  const economicShares = [
    "Заметная — 10–25%",
    "Небольшая — 5–10%",
    "Крупная — 25–50%",
    "Нишевая — менее 5%",
  ];

  if (order === 1) {
    const segments = segmentSets[profile.primarySubgroup];
    context.segments = segments;
    context.metrics = rotate(metricPool, index).slice(0, 4);
    return {
      industry_boundaries: segments.map((segment, rowIndex) => ({
        industry: INDUSTRY,
        segment,
        adjacentSegments: [segments[1 - rowIndex]],
        userActivityShare: activityShares[(index + rowIndex) % activityShares.length],
        economicShare: economicShares[(index + rowIndex) % economicShares.length],
        assessmentRationale:
          `${segment} формирует устойчивый пользовательский сценарий. ` +
          `Оценка ${shortName} основана на динамике аудитории, частоте использования ` +
          `и наблюдаемой модели монетизации в ${profile.company}.`,
      })),
      analysis_object: [
        {
          industry: INDUSTRY,
          adjacentIndustries: rotate(
            ["Торговля", "Финансы", "Образование", "Занятость"],
            index,
          ).slice(0, 2),
          intersectionAssessment:
            "Основные пересечения возникают в платежах, рекламе, подготовке кадров и использовании данных. " +
            "Отрасли совместно формируют пользовательский путь, но предметом оценки остаются коммуникационные и медийные транзакции.",
        },
      ],
      current_state: [
        {
          startYear: "2018",
          endYear: "2019",
          keyFactor: "Ускорение цифровизации и изменение поведения пользователей",
          influence: "Позитивное влияние",
          influenceDescription:
            "Мобильное потребление стало регулярным, а платформы получили возможность масштабировать персонализированные сервисы.",
        },
        {
          startYear: "2020",
          endYear: "2021",
          keyFactor: "Пандемия COVID-19 и связанные ограничения",
          influence: index % 3 === 0 ? "Нейтральное влияние" : "Позитивное влияние",
          influenceDescription:
            "Удалённые форматы ускорили цифровое потребление и приток аудитории, одновременно повысив требования к инфраструктуре и модерации.",
        },
        {
          startYear: "2022",
          endYear: "2026",
          keyFactor: "Геополитические изменения, СВО и санкционное давление",
          influence: index % 2 === 0 ? "Негативное влияние" : "Позитивное влияние",
          influenceDescription:
            "Изменились рекламные, технологические и платёжные цепочки. Российские сервисы получили пространство для роста, но столкнулись с дефицитом технологий и контента.",
        },
      ],
      key_metrics: context.metrics.map((metric) => ({ metric })),
    };
  }

  if (order === 2) {
    context.participants = participantSets[profile.primarySubgroup];
    context.macros = macroSets[profile.primarySubgroup].map(
      (name, macroIndex) => `${name} — ${shortName} ${macroIndex + 1}`,
    );
    context.microtransactions = [
      {
        macro: context.macros[0],
        name: "Агрегация и структурирование данных",
        actor: context.participants[1],
        result: "Предложение доступно целевой аудитории",
        executionMode: "Преимущественно автоматизировано",
      },
      {
        macro: context.macros[0],
        name: "Поиск и сопоставление информации",
        actor: context.participants[2],
        result: "Пользователь получил релевантную подборку",
        executionMode: "Полностью автоматизировано",
      },
      {
        macro: context.macros[1],
        name: "Согласование решения",
        actor: context.participants[0],
        result: "Условия взаимодействия подтверждены",
        executionMode: "Частично автоматизировано",
      },
      {
        macro: context.macros[1],
        name: "Проведение расчётов",
        actor: context.participants[2],
        result: "Расчёт выполнен и зафиксирован",
        executionMode: "Преимущественно автоматизировано",
      },
    ];
    const kinds = [
      ["supply"],
      ["demand"],
      ["intermediary"],
      ["government"],
    ];
    return {
      participants: context.participants.map((name, participantIndex) => ({
        segments: context.segments,
        name,
        kind: kinds[participantIndex],
        role:
          participantIndex === 0
            ? "Создаёт и поставляет основную ценность"
            : participantIndex === 1
              ? "Формирует спрос и использует результат"
              : participantIndex === 2
                ? "Организует поиск, доступ, расчёты и доверие"
                : "Устанавливает обязательные правила и контролирует их соблюдение",
      })),
      macrotransactions: context.macros.map((name, macroIndex) => ({
        segments: context.segments,
        name,
        initiator: context.participants[macroIndex],
        recipient: context.participants[(macroIndex + 1) % 2],
        value:
          macroIndex === 0
            ? ["Контент или цифровой продукт", "Информация и данные"]
            : [
                "Денежные средства или вознаграждение",
                "Права, лицензия или разрешение",
              ],
        transactionType: "Сделка",
        description:
          macroIndex === 0
            ? "Участники создают предложение, обеспечивают его обнаружение и доставляют пользователю через платформу."
            : "Платформа фиксирует условия, обеспечивает расчёт и распределяет вознаграждение между участниками.",
      })),
      microtransactions: context.microtransactions,
      transaction_assessments: context.microtransactions.map(
        (micro, microIndex) => ({
          macro: micro.macro,
          micro: micro.name,
          actor: micro.actor,
          executionMode: micro.executionMode,
          frequency: microIndex % 2 === 0 ? "Очень высокая" : "Высокая",
          repeatability: "Высокая",
          standardization:
            microIndex === 2 ? "Низкая" : "Средняя",
          resourceIntensity:
            microIndex === 2 ? "Высокая" : "Средняя",
          costLevel: microIndex === 2 ? "Высокий" : "Средний",
          costSources:
            microIndex === 2
              ? [
                  "Переговоры и многоэтапные согласования",
                  "Подтверждение прав, получение лицензий или разрешений",
                ]
              : [
                  "Поиск и проверка информации или контрагента",
                  "Сбор, повторный ввод и низкое качество данных",
                ],
          rationale:
            "Оценка отражает частоту операции, долю ручных действий и необходимость согласования между несколькими сторонами.",
        }),
      ),
    };
  }

  if (order === 3) {
    context.platforms = platformSets[profile.primarySubgroup].map(
      (platform, platformIndex) =>
        platformIndex === 0 ? platform : `${platform} (${profile.company})`,
    );
    return {
      state_functions: [
        {
          participant: context.participants[3],
          role: "Регулятор",
          macros: context.macros,
          function:
            "Устанавливает единые требования к прозрачности взаимодействия, защите пользователей и обмену данными.",
          criticality: "Существенно",
          executionModel: "Рынок под государственным регулированием",
          rationale:
            "Единые обязательные рамки снижает неопределённость, а реализация сервисов остаётся за участниками рынка.",
        },
      ],
      interaction_formats: [
        {
          macros: context.macros,
          governmentParticipants: [context.participants[3]],
          marketParticipants: context.participants.slice(0, 3),
          format: "Стандартизация и аккредитация",
          description:
            "Государство определяет базовые требования и машиночитаемые правила, отрасль участвует в разработке и применении стандартов.",
          impact: "Скорее способствует",
          impactRationale:
            "Предсказуемые правила снижают стоимость интеграций и упрощают подключение новых участников.",
        },
      ],
      platforms: context.platforms.map((name, platformIndex) => ({
        segments: [context.segments[platformIndex % context.segments.length]],
        name,
        type: platformIndex === 0 ? "Рыночная" : "Гибридная",
        origin: platformIndex === 0 ? "Российская" : undefined,
        macros: context.macros,
        mau: `${8 + index + platformIndex * 4} млн пользователей`,
        gtv: `${12 + index * 2 + platformIndex * 5} млрд руб. в год`,
      })),
      platform_penetration: context.macros.map((macro, macroIndex) => ({
        macro,
        share:
          macroIndex === 0
            ? "30–50% — массовое использование"
            : "15–30% — значимый сегмент, активный рост",
        basis:
          index % 2 === 0
            ? "Экспертная оценка"
            : "Данные компании",
        rationale:
          "Диапазон учитывает долю регулярных цифровых сценариев и остающиеся неплатформенные взаимодействия.",
      })),
      network_effects: [
        {
          platform: context.platforms[0],
          effectTypes: ["Косвенный", "Основанный на данных"],
          stability: "Сохраняется частично",
          scalability: "Усиливается при росте пользователей",
          constraints: [
            index % 2 === 0
              ? "Дисбаланс сторон спроса и предложения"
              : "Недостаток или низкое качество данных",
          ],
          comment:
            "Рост одной стороны повышает ценность для другой, а накопленные данные улучшают подбор и качество сервиса.",
        },
      ],
    };
  }

  if (order === 4) {
    return {
      data_access: [
        {
          platforms: context.platforms,
          macros: context.macros,
          data: "Данные об аудитории и пользовательском поведении",
          owner: context.platforms[0],
          accessModel: "Доступ по соглашению",
          quality: index % 3 === 0 ? "Скорее высокие" : "Средние",
          restrictions: [
            "Ограничения по персональным данным",
            "Отсутствие единых форматов и классификаторов",
          ],
          impact: "Скорее ограничивает",
          rationale:
            "Данные существуют, но неодинаковые модели и форматы доступа повышают стоимость совместной аналитики.",
        },
        {
          platforms: [context.platforms[1]],
          macros: [context.macros[1]],
          data: "Данные о правах и лицензиях",
          owner: context.participants[0],
          accessModel: "Интеграция через информационную систему или API",
          quality: "Средние",
          restrictions: [
            "Авторские и смежные права",
            "Фрагментированное владение данными",
          ],
          impact: "Нейтрально",
          rationale:
            "Доступ возможен в партнёрском контуре, но полнота зависит от дисциплины правообладателей.",
        },
      ],
      service_access: [
        {
          platforms: context.platforms,
          service: "Аналитика и измерение аудитории",
          operator: profile.company,
          need:
            "Нужны сопоставимые показатели охвата, вовлечённости и результата транзакции для участников рынка.",
          integration: ["Партнёрский или закрытый API"],
          openness: "Доступна после проверки или аккредитации",
          maturity: "Средние",
          impact: "Скорее способствует",
          rationale:
            "Интеграции доступны крупным участникам, но требуют унификации метрик и условий подключения.",
        },
      ],
      user_access: [
        {
          platform: context.platforms[0],
          participants: context.participants.slice(0, 3),
          interactionTypes: ["B2C — бизнес и физические лица", "B2B — бизнес и бизнес"],
          connection: ["Самостоятельная регистрация", "Заключение договора"],
          openness: "Условия различаются по группам участников",
          restrictions: [
            index % 2 === 0
              ? "Неравные условия для разных групп участников"
              : "Технологические требования к участнику",
          ],
          impact: "Нейтрально",
          rationale:
            "Для пользователей вход прост, а профессиональным поставщикам нужны договор и дополнительная настройка.",
        },
      ],
    };
  }

  if (order === 5) {
    context.barriers = [
      `Фрагментированные правила обмена — ${shortName}`,
      `Неоднозначность требований — ${shortName}`,
      `Несовместимость систем — ${shortName}`,
    ];
    return {
      barriers: [
        {
          category: "Структурный",
          structuralType: "Фрагментированность отрасли",
          name: context.barriers[0],
          platforms: context.platforms,
          macros: context.macros,
          participants: context.participants,
          priorEvidence: ["Неодинаковые условия доступа к данным и сервисам"],
          description:
            "Участники используют разные правила, справочники и договорные модели для сходных транзакций.",
          consequences:
            "Растут сроки подключения, стоимость согласований и зависимость от индивидуальных интеграций.",
          solution:
            "Сформировать отраслевые профили данных и типовые правила подключения с участием основных групп участников.",
          responsible: ["Отраслевые объединения", "Операторы платформ"],
          expectedResult:
            "Сокращение времени подключения и доли ручных согласований.",
        },
        {
          category: "Регуляторный",
          regulatoryType: "Коллизия регулирования",
          name: context.barriers[1],
          platforms: context.platforms,
          macros: [context.macros[0]],
          participants: [context.participants[0], context.participants[3]],
          priorEvidence: ["Ограничения доступа к данным и правам"],
          description:
            "Смежные требования к данным, контенту и рекламе трактуются участниками неодинаково.",
          consequences:
            "Компании перестраховываются, вводят дополнительные проверки и ограничивают новые сценарии.",
          solution:
            "Подготовить согласованные разъяснения и машиночитаемые требования для типовых цифровых сценариев.",
          responsible: [
            "Федеральные органы государственной власти",
            "Отраслевые объединения",
          ],
          expectedResult:
            "Снижение правовой неопределённости и числа повторных проверок.",
        },
        {
          category: "Технологический",
          technologyType: "Недостаточная интероперабельность систем",
          name: context.barriers[2],
          platforms: context.platforms,
          macros: context.macros,
          participants: context.participants.slice(0, 3),
          priorEvidence: ["Закрытые API и неодинаковые форматы"],
          description:
            "Системы передают одни и те же сущности в разных форматах и не поддерживают единые идентификаторы.",
          consequences:
            "Возникают дублирование данных, ручные сверки и ошибки при расчётах.",
          solution:
            "Определить минимальный набор открытых интерфейсов, идентификаторов и правил качества данных.",
          responsible: [
            "Операторы платформ",
            "Технологические компании",
          ],
          expectedResult:
            "Рост доли автоматизированных обменов и снижение операционных ошибок.",
        },
      ],
    };
  }

  if (order === 6) {
    context.effects = [
      `Снижение стоимости взаимодействия — ${shortName}`,
      `Рост доступности цифровых сервисов — ${shortName}`,
      `Снижение затрат на администрирование — ${shortName}`,
    ];
    return {
      effects: [
        {
          category: "Экономический",
          economicType: "Снижение транзакционных издержек",
          name: context.effects[0],
          relatedMetrics: context.metrics.slice(0, 2),
          platforms: context.platforms,
          macros: context.macros,
          participants: context.participants.slice(0, 3),
          relatedBarriers: context.barriers,
          status: "Потенциальный — зависит от масштабирования или снятия барьеров",
          scale: "Высокий",
          mechanism:
            "Стандарты данных и типовые интеграции сокращают ручные операции, проверки и индивидуальные согласования.",
          assessmentFormat: "Экспертная качественная оценка",
          basis: "Смешанное основание",
          rationale:
            "Эффект подтверждается практикой крупных платформ, но отраслевой расчёт требует единой базы показателей.",
          conditions:
            "Критичны согласование стандартов и участие платформ с достаточной долей рынка.",
        },
        {
          category: "Социальный",
          socialType: "Доступность товаров и услуг",
          name: context.effects[1],
          relatedMetrics: [context.metrics[0]],
          platforms: context.platforms,
          macros: [context.macros[0]],
          participants: context.participants,
          relatedBarriers: [context.barriers[0]],
          status: "Начинает проявляться",
          scale: index % 2 === 0 ? "Высокий" : "Средний",
          mechanism:
            "Единые цифровые каналы расширяют выбор и снижают барьеры доступа для пользователей и небольших поставщиков.",
          assessmentFormat: "Экспертная качественная оценка",
          basis: "Экспертная оценка",
          rationale:
            "Рост доступности заметен в цифровых каналах, однако различается по территории и группе пользователей.",
        },
        {
          category: "Бюджетный",
          budgetType: "Экономия на государственном администрировании и контроле",
          name: context.effects[2],
          relatedMetrics: [context.metrics[2]],
          platforms: context.platforms,
          macros: [context.macros[1]],
          participants: [context.participants[2], context.participants[3]],
          relatedBarriers: [context.barriers[1], context.barriers[2]],
          status: "Потенциальный — зависит от масштабирования или снятия барьеров",
          scale: "Средний",
          mechanism:
            "Машиночитаемые требования и данные позволяют перейти от повторных ручных проверок к риск-ориентированному контролю.",
          assessmentFormat: "Экспертная качественная оценка",
          basis: "Сопоставление с аналогичным опытом",
          rationale:
            "Направление эффекта устойчиво, но размер зависит от состава процессов, переведённых в цифровой контур.",
          conditions:
            "Нужны доверенные источники данных и нормативное признание цифрового обмена.",
        },
      ],
    };
  }

  if (order === 7) {
    context.internationalConstraints = [
      "Языковая и продуктовая локализация",
      index % 2 === 0
        ? "Платёжная инфраструктура и расчёты"
        : "Высокая конкуренция на целевом рынке",
    ];
    return {
      international_platforms: context.platforms.map(
        (platform, platformIndex) => ({
          platform,
          presence:
            platformIndex === 0
              ? "Ограниченное или пилотное присутствие"
              : "Нет",
          pilotCountries:
            platformIndex === 0 ? ["Казахстан", "Беларусь"] : undefined,
          channels: ["Иностранные пользователи на российском рынке"],
          targetMarkets: ["ЕАЭС", "СНГ"],
          potential: platformIndex === 0 ? "Высокий" : "Средний",
          indicators:
            "Рост иностранной аудитории, доля локализованного предложения и число устойчивых партнёрств.",
          advantages:
            "Сильная технологическая база, крупный внутренний рынок и опыт работы с русскоязычной аудиторией.",
          relatedEffects: context.effects.slice(0, 2),
          constraints: context.internationalConstraints,
          conditions:
            "Нужны локализация продукта, региональные партнёры, устойчивые расчёты и соблюдение требований целевых юрисдикций.",
          basis:
            index % 2 === 0
              ? "Экспертная оценка"
              : "Сопоставление с зарубежными аналогами",
          rationale:
            "Наиболее реалистично поэтапное развитие на близких рынках с проверкой продуктовой гипотезы до масштабирования.",
        }),
      ),
    };
  }

  if (order === 8) {
    const targetDimensions = [
      "Распределение ролей государства и рынка",
      "Архитектура доступа к данным, сервисам и платформам",
      "Международное развитие российских платформ",
    ];
    const recommendationDirections = [
      "Транзакции и стандартизация",
      "Данные и архитектура взаимодействия",
      "Международная экспансия",
    ];
    return {
      target_transactions: context.macros.map((macro, macroIndex) => ({
        macro,
        currentShare:
          macroIndex === 0
            ? "30–50% — массовое использование"
            : "15–30% — значимый сегмент, активный рост",
        targetShare: macroIndex === 0 ? "Более 50%" : "30–50%",
        targetParticipantShare: "Более 50%",
        standardization:
          macroIndex === 0
            ? "Требуется стандартизация отдельных элементов"
            : "Требуется существенная стандартизация процесса",
        costReduction: macroIndex === 0 ? "10–25%" : "25–50%",
        targetDescription:
          "К 2036 году поиск, оформление, передача данных и подтверждение результата должны проходить через совместимые платформенные интерфейсы. " +
          "Индивидуальные творческие и редакционные решения остаются вне стандартизированного контура.",
      })),
      target_model: targetDimensions.map((dimension, dimensionIndex) => ({
        dimension,
        targetState:
          dimensionIndex === 0
            ? "Государство задаёт единые обязательные рамки, а участники рынка реализуют конкурентные сервисы и совместно развивают стандарты."
            : dimensionIndex === 1
              ? "Платформы используют совместимые модели данных, доверенные идентификаторы и прозрачные правила подключения."
              : "Российские платформы устойчиво работают на близких зарубежных рынках через локализованные продукты и партнёрства.",
        linkedBarriers:
          dimensionIndex < 2
            ? context.barriers.slice(dimensionIndex, dimensionIndex + 2)
            : undefined,
        internationalConstraints:
          dimensionIndex === 2 ? context.internationalConstraints : undefined,
        linkedEffects: context.effects.slice(0, 2),
        successCriteria:
          dimensionIndex === 0
            ? "Согласованы роли и единые правила минимум для двух ключевых макротранзакций."
            : dimensionIndex === 1
              ? "Не менее половины значимых участников используют типовые интерфейсы и справочники."
              : "Есть регулярная иностранная аудитория и выручка минимум на двух целевых рынках.",
        assumptions:
          "Участники сохраняют мотивацию к совместным стандартам; требования к безопасности и данным не блокируют добросовестные сценарии.",
      })),
      recommendations: recommendationDirections.map(
        (direction, recommendationIndex) => ({
          direction,
          title:
            recommendationIndex === 0
              ? `Стандартизировать ключевые транзакции — ${shortName}`
              : recommendationIndex === 1
                ? `Запустить совместимый контур данных — ${shortName}`
                : `Провести пилот на рынках ЕАЭС — ${shortName}`,
          barriers:
            recommendationIndex < 2
              ? context.barriers.slice(recommendationIndex, recommendationIndex + 2)
              : undefined,
          internationalPlatforms:
            recommendationIndex === 2 ? [context.platforms[0]] : undefined,
          internationalConstraints:
            recommendationIndex === 2 ? context.internationalConstraints : undefined,
          action:
            recommendationIndex === 0
              ? "Описать типовой процесс, минимальный состав данных и единые критерии подтверждения результата."
              : recommendationIndex === 1
                ? "Согласовать отраслевой профиль данных и реализовать референсные API для добровольного подключения."
                : "Выбрать один продукт и два рынка, локализовать сценарий и проверить спрос с региональными партнёрами.",
          responsible:
            recommendationIndex === 0
              ? ["Отраслевые объединения", "Операторы платформ"]
              : recommendationIndex === 1
                ? ["Операторы платформ", "Технологические компании"]
                : ["Операторы платформ"],
          firstStep:
            recommendationIndex === 0
              ? "Собрать рабочую группу владельцев процессов и утвердить границы пилота."
              : recommendationIndex === 1
                ? "Провести инвентаризацию данных и выбрать две приоритетные интеграции."
                : "Подтвердить продуктовую гипотезу и требования локализации с местными партнёрами.",
          horizon:
            recommendationIndex === 0
              ? "2026–2028"
              : recommendationIndex === 1
                ? "2029–2032"
                : "2033–2036",
          effects: context.effects.slice(0, 2),
          expectedResult:
            recommendationIndex === 0
              ? "Сокращено число ручных согласований и срок прохождения типовой транзакции."
              : recommendationIndex === 1
                ? "Увеличена доля автоматизированного обмена и снижено число ошибок данных."
                : "Получены подтверждённые показатели аудитории, удержания и экономики пилота.",
          risks:
            "Различия в зрелости участников и недостаточная мотивация к раскрытию данных могут замедлить реализацию.",
        }),
      ),
      disagreements:
        index % 4 === 0
          ? [
              {
                issue: "Темп обязательного перехода на единые стандарты",
                positions:
                  "Часть участников поддерживает обязательный быстрый переход, часть предлагает добровольные отраслевые пилоты.",
                arguments:
                  "Обязательность ускоряет масштабирование, но может увеличить нагрузку на небольших участников.",
                resolution:
                  "Провести ограниченный пилот, измерить издержки подключения и определить поэтапные требования.",
              },
            ]
          : [],
    };
  }

  throw new Error(`Unsupported module order: ${order}`);
}

function questionValueMap(
  questions: Question[],
  answersByKey: JsonRecord,
) {
  return Object.fromEntries(
    questions
      .filter((question) => answersByKey[question.key] !== undefined)
      .map((question) => [question.id, answersByKey[question.key]]),
  );
}

function validateConfiguredOptions(
  questions: Question[],
  answersByKey: JsonRecord,
) {
  const errors: string[] = [];
  for (const question of questions) {
    const value = answersByKey[question.key];
    if (!Array.isArray(value)) continue;
    const config = question.config as {
      columns?: Array<{
        key: string;
        type: string;
        allowCustom?: boolean;
        options?: Array<{ value: string }>;
      }>;
    };
    for (const [rowIndex, rawRow] of value.entries()) {
      if (typeof rawRow !== "object" || rawRow === null || Array.isArray(rawRow)) {
        continue;
      }
      const row = rawRow as Record<string, unknown>;
      for (const column of config.columns ?? []) {
        if (!column.options?.length || column.allowCustom === true) continue;
        if (
          column.type !== "select" &&
          column.type !== "multi_suggest" &&
          column.type !== "suggest"
        ) {
          continue;
        }
        const allowed = new Set(column.options.map((option) => option.value));
        const values: unknown[] = Array.isArray(row[column.key])
          ? (row[column.key] as unknown[])
          : [row[column.key]];
        const invalid = values
          .filter(
            (item): item is string =>
              typeof item === "string" && item.trim().length > 0,
          )
          .filter((item) => !allowed.has(item));
        if (invalid.length > 0) {
          errors.push(
            `${question.key}[${rowIndex + 1}].${column.key}: ${invalid.join(", ")}`,
          );
        }
      }
    }
  }
  return errors;
}

async function main() {
  const [admin, subgroups, modules] = await Promise.all([
    db.user.findUnique({ where: { id: ADMIN_ID } }),
    db.subgroup.findMany({ orderBy: { name: "asc" } }),
    db.module.findMany({
      where: { isActive: true },
      orderBy: { order: "asc" },
      include: {
        versions: {
          where: { publishedAt: { not: null } },
          orderBy: { version: "desc" },
          take: 1,
          include: { questions: { orderBy: { order: "asc" } } },
        },
      },
    }),
  ]);

  if (!admin || admin.role !== "ADMIN") {
    throw new Error(`Administrator ${ADMIN_ID} was not found`);
  }
  const subgroupByName = new Map(subgroups.map((item) => [item.name, item]));
  for (const subgroupName of SUBGROUPS) {
    if (!subgroupByName.has(subgroupName)) {
      throw new Error(`Required subgroup was not found: ${subgroupName}`);
    }
  }
  if (
    modules.length !== 8 ||
    modules.some((moduleRecord) => moduleRecord.versions.length !== 1)
  ) {
    throw new Error("Expected eight active modules with published versions");
  }

  const passwordHashes = new Map<string, string>();
  for (const profile of profiles) {
    passwordHashes.set(
      profile.id,
      await hashPassword(`${functionalTestPasswordSecret}:${profile.id}`),
    );
  }

  const before = {
    experts: await db.user.count({
      where: { role: { in: ["EXPERT", "LEAD"] } },
    }),
    requests: await db.registrationRequest.count(),
    submissions: await db.submission.count(),
    answers: await db.answer.count(),
    attachments: await db.attachment.count(),
  };

  const result = await db.$transaction(
    async (tx) => {
      await tx.registrationRequest.deleteMany();
      await tx.attachment.deleteMany();
      await tx.answer.deleteMany();
      await tx.reviewComment.deleteMany();
      await tx.statusHistory.deleteMany();
      await tx.submission.deleteMany();
      await tx.moduleAssignment.deleteMany();
      await tx.invitationToken.deleteMany({
        where: {
          OR: [
            { user: { role: { in: ["EXPERT", "LEAD"] } } },
            { createdBy: { role: { in: ["EXPERT", "LEAD"] } } },
          ],
        },
      });
      await tx.ministryEconomicData.updateMany({
        where: { updatedBy: { role: { in: ["EXPERT", "LEAD"] } } },
        data: { updatedById: admin.id },
      });
      await tx.subgroup.updateMany({ data: { leaderId: null } });
      await tx.user.deleteMany({
        where: { role: { in: ["EXPERT", "LEAD"] } },
      });
      await tx.company.deleteMany({
        where: {
          users: { none: {} },
          name: { not: "VK" },
        },
      });

      const createdExperts: User[] = [];
      for (const profile of profiles) {
        const company = await tx.company.upsert({
          where: { name: profile.company },
          update: {},
          create: { name: profile.company },
        });
        const subgroupNames = [
          profile.primarySubgroup,
          ...(profile.secondarySubgroup ? [profile.secondarySubgroup] : []),
        ];
        const expert = await tx.user.create({
          data: {
            id: profile.id,
            fullName: profile.fullName,
            maxLinkCode: await createExpertLinkCode(tx),
            passwordHash: passwordHashes.get(profile.id)!,
            companyId: company.id,
            position: profile.position,
            direction: profile.direction,
            experienceSummary: profile.experienceSummary,
            expertiseReason: profile.expertiseReason,
            role: profile.isLeader ? "LEAD" : "EXPERT",
            isActive: true,
            activatedAt: new Date("2026-07-29T06:00:00.000Z"),
            subgroupMemberships: {
              create: subgroupNames.map((name) => ({
                subgroupId: subgroupByName.get(name)!.id,
              })),
            },
          },
        });
        createdExperts.push(expert);
        if (profile.isLeader) {
          await tx.subgroup.update({
            where: { id: subgroupByName.get(profile.primarySubgroup)!.id },
            data: { leaderId: expert.id },
          });
        }
      }

      let submissionCount = 0;
      let answerCount = 0;
      let historyCount = 0;

      for (const [expertIndex, expert] of createdExperts.entries()) {
        const profile = profiles[expertIndex];
        const context: ExpertContext = {
          segments: [],
          participants: [],
          macros: [],
          microtransactions: [],
          platforms: [],
          metrics: [],
          barriers: [],
          effects: [],
          internationalConstraints: [],
        };

        for (const moduleRecord of modules) {
          const version = moduleRecord.versions[0];
          const activeQuestions = version.questions.filter(
            (question) => !isQuestionHidden(question.config),
          );
          const answersByKey = buildModuleAnswers(
            moduleRecord.order,
            profile,
            expertIndex,
            context,
          );
          const answersByQuestionId = questionValueMap(
            activeQuestions,
            answersByKey,
          );
          const validationErrors = validateAnswers(
            activeQuestions,
            answersByQuestionId,
          );
          const optionErrors = validateConfiguredOptions(
            activeQuestions,
            answersByKey,
          );
          if (Object.keys(validationErrors).length > 0) {
            const details = activeQuestions
              .filter((question) => validationErrors[question.id])
              .map(
                (question) =>
                  `${question.key}: ${validationErrors[question.id]}`,
              )
              .join("; ");
            throw new Error(
              `${profile.fullName}, module ${moduleRecord.order}: ${details}`,
            );
          }
          if (optionErrors.length > 0) {
            throw new Error(
              `${profile.fullName}, module ${moduleRecord.order}, invalid options: ${optionErrors.join("; ")}`,
            );
          }

          const startedAt = new Date(
            Date.UTC(2026, 6, 1 + expertIndex, 7 + moduleRecord.order, 0, 0),
          );
          const submittedAt = new Date(startedAt.getTime() + 40 * 60 * 1000);
          const acceptedAt = new Date(submittedAt.getTime() + 20 * 60 * 1000);

          const assignment = await tx.moduleAssignment.create({
            data: {
              userId: expert.id,
              moduleId: moduleRecord.id,
              moduleVersionId: version.id,
              assignedById: admin.id,
              createdAt: startedAt,
            },
          });
          const submission = await tx.submission.create({
            data: {
              assignmentId: assignment.id,
              status: "ACCEPTED",
              submittedAt,
              acceptedAt,
              createdAt: startedAt,
              answers: {
                create: activeQuestions
                  .filter(
                    (question) => answersByKey[question.key] !== undefined,
                  )
                  .map((question) => ({
                    questionId: question.id,
                    value: answersByKey[question.key],
                    updatedById: expert.id,
                    createdAt: startedAt,
                    updatedAt: submittedAt,
                  })),
              },
              history: {
                create: [
                  {
                    fromStatus: "NOT_STARTED",
                    toStatus: "DRAFT",
                    actorId: expert.id,
                    reason: "Эксперт начал заполнение тестового модуля",
                    createdAt: startedAt,
                  },
                  {
                    fromStatus: "DRAFT",
                    toStatus: "SUBMITTED",
                    actorId: expert.id,
                    reason: "Эксперт отправил заполненный тестовый модуль",
                    createdAt: submittedAt,
                  },
                  {
                    fromStatus: "SUBMITTED",
                    toStatus: "ACCEPTED",
                    actorId: admin.id,
                    reason: "Автоматически принято в рамках функционального тестирования",
                    createdAt: acceptedAt,
                  },
                ],
              },
            },
            include: {
              answers: true,
              history: true,
            },
          });
          submissionCount += 1;
          answerCount += submission.answers.length;
          historyCount += submission.history.length;
        }
      }

      return {
        experts: createdExperts.length,
        submissions: submissionCount,
        answers: answerCount,
        history: historyCount,
      };
    },
    { maxWait: 10_000, timeout: 120_000 },
  );

  const after = {
    admins: await db.user.count({ where: { role: "ADMIN" } }),
    experts: await db.user.count({ where: { role: "EXPERT" } }),
    leaders: await db.user.count({ where: { role: "LEAD" } }),
    requests: await db.registrationRequest.count(),
    acceptedSubmissions: await db.submission.count({
      where: { status: "ACCEPTED" },
    }),
    answers: await db.answer.count(),
    attachments: await db.attachment.count(),
  };

  console.log(JSON.stringify({ before, created: result, after }, null, 2));
  console.log("\nTest experts:");
  for (const profile of profiles) {
    console.log(
      `${profile.fullName} | ${profile.primarySubgroup}` +
        (profile.secondarySubgroup ? ` + ${profile.secondarySubgroup}` : "") +
        (profile.isLeader ? " | руководитель" : ""),
    );
  }
}

main()
  .finally(() => db.$disconnect())
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
