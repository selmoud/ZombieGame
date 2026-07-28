"use client";

import { useEffect, useState } from "react";

const glossary = [
  {
    term: "Цифровой сервис",
    definition:
      "Самостоятельная услуга, предоставляемая с использованием цифровых технологий и удовлетворяющая конкретную потребность пользователя. Примеры: СБП, ЕБС, «Честный знак».",
    note:
      "Сервис решает отдельную задачу пользователя, но сам по себе не обязательно создаёт среду для взаимодействия нескольких групп участников.",
  },
  {
    term: "Цифровая платформа",
    definition:
      "Бизнес-модель, которая создаёт ценность через содействие транзакциям между двумя или более взаимозависимыми группами пользователей. Платформа создаёт среду взаимодействия и автоматизирует транзакции или их отдельные этапы. Примеры: «Яндекс Go», Wildberries, ЕМИАС.",
    note:
      "Главное отличие от цифрового сервиса — платформа организует взаимодействие между пользователями, а не только предоставляет им самостоятельную услугу.",
  },
  {
    term: "Цифровая экосистема",
    definition:
      "Совокупность взаимосвязанных цифровых сервисов, платформ и участников, которая помогает удовлетворять широкий круг взаимодополняющих потребностей пользователей в единой цифровой среде. Примеры: «Яндекс», «Сбер».",
    note:
      "Экосистема шире отдельной платформы: она объединяет несколько взаимосвязанных решений и пользовательских сценариев.",
  },
  {
    term: "Транзакция",
    definition:
      "Совокупность действий между сторонами спроса и предложения, направленных на обмен контентом, информацией, данными, услугами, денежными средствами, правами или другой ценностью.",
    kindsTitle: "Виды транзакций по классификации Дж. Коммонса",
    kinds: [
      {
        name: "Транзакции сделки",
        description:
          "Обмен между сторонами на согласованных условиях. Примеры: купля-продажа товаров, оказание услуг, аренда, обмен, подряд.",
      },
      {
        name: "Рационирующие транзакции",
        description:
          "Распределение прав, обязанностей или ресурсов на основании обязательных правил. Примеры: уплата налогов, получение лицензий и разрешений, соблюдение тарифов и нормативов, распределение квот.",
      },
      {
        name: "Управленческие транзакции",
        description:
          "Взаимодействия, связанные с организацией и управлением деятельностью. Примеры: постановка задач, распределение ресурсов, контроль исполнения, координация труда.",
      },
    ],
  },
  {
    term: "Транзакционные издержки",
    definition:
      "Затраты времени, труда и денежных средств на организацию взаимодействия: поиск и проверку информации, согласование условий, оформление прав и документов, обмен данными, расчёты и контроль исполнения.",
    note:
      "Это не себестоимость самого контента или услуги, а дополнительные затраты на взаимодействие участников. В разделе оцениваются их общий уровень и основные источники.",
  },
  {
    term: "Сетевой эффект",
    definition:
      "Механизм, при котором ценность цифровой платформы для одной стороны возрастает при увеличении числа участников другой стороны. Бывает прямым, косвенным и основанным на данных.",
    kindsTitle: "Ключевые типы сетевого эффекта",
    kinds: [
      {
        name: "Прямой (односторонний)",
        description:
          "Ценность растёт по мере увеличения числа участников на той же стороне платформы.",
      },
      {
        name: "Косвенный (перекрёстный)",
        description:
          "Рост числа участников одной стороны повышает ценность платформы для другой стороны.",
      },
      {
        name: "Основанный на данных",
        description:
          "Накопление данных позволяет улучшать сопоставление участников, персонализацию и качество платформенных решений.",
      },
    ],
  },
  {
    term: "Платформизация экономики",
    definition:
      "Процесс системного внедрения цифровых платформ в деятельность участников отрасли, который изменяет цепочки создания стоимости, рыночные структуры и способы взаимодействия пользователей.",
    note:
      "В отличие от традиционной автоматизации, платформизация меняет механизмы координации, взаимодействия и создания ценности между участниками рынка.",
  },
];

export function GlossaryModal() {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setIsOpen(false);
    }

    window.addEventListener("keydown", closeOnEscape);
    return () => {
      window.removeEventListener("keydown", closeOnEscape);
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen]);

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="w-full rounded-xl border border-[#0059C7] bg-[#0059C7] px-5 py-3.5 font-bold text-white transition hover:border-[#00479F] hover:bg-[#00479F]"
      >
        Глоссарий
      </button>

      {isOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4 sm:p-6"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setIsOpen(false);
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="glossary-title"
            className="flex max-h-[85vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
          >
            <div className="flex items-center justify-between gap-4 border-b border-neutral-200 px-5 py-4 sm:px-7">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-[#8125C8]">
                  Методические рекомендации
                </p>
                <h2
                  id="glossary-title"
                  className="mt-1 text-2xl font-bold text-black"
                >
                  Глоссарий
                </h2>
              </div>
              <button
                type="button"
                autoFocus
                onClick={() => setIsOpen(false)}
                aria-label="Закрыть глоссарий"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-neutral-100 text-2xl leading-none text-black transition hover:bg-neutral-200"
              >
                ×
              </button>
            </div>

            <div className="overflow-y-auto px-5 py-2 sm:px-7">
              <dl className="divide-y divide-neutral-200">
                {glossary.map((item) => (
                  <div key={item.term} className="py-5">
                    <dt className="font-bold text-[#0059C7]">{item.term}</dt>
                    <dd className="mt-2 text-sm leading-6 text-neutral-600">
                      <p>{item.definition}</p>
                      {"note" in item && item.note && (
                        <p className="mt-3">{item.note}</p>
                      )}
                      {"kinds" in item && item.kinds && (
                        <div className="mt-4 rounded-xl bg-[#F4F8FF] p-4">
                          <p className="font-semibold text-black">
                            {item.kindsTitle}
                          </p>
                          <ul className="mt-3 space-y-3">
                            {item.kinds.map((kind) => (
                              <li key={kind.name}>
                                <strong className="text-[#0059C7]">
                                  {kind.name}.
                                </strong>{" "}
                                {kind.description}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          </section>
        </div>
      )}
    </>
  );
}
