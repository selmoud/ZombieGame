"use client";

import { useEffect, useState } from "react";

const glossary = [
  {
    term: "Цифровой сервис",
    definition:
      "Самостоятельная услуга, предоставляемая с использованием цифровых технологий и удовлетворяющая конкретную потребность пользователя. Примеры: СБП, ЕБС, «Честный знак».",
  },
  {
    term: "Цифровая платформа",
    definition:
      "Бизнес-модель, которая создаёт ценность через содействие транзакциям между двумя или более взаимозависимыми группами пользователей. Платформа создаёт среду взаимодействия и автоматизирует транзакции или их отдельные этапы. Примеры: «Яндекс Go», Wildberries, ЕМИАС.",
  },
  {
    term: "Цифровая экосистема",
    definition:
      "Совокупность взаимосвязанных цифровых сервисов, платформ и участников, которая помогает удовлетворять широкий круг взаимодополняющих потребностей пользователей в единой цифровой среде. Примеры: «Яндекс», «Сбер».",
  },
  {
    term: "Транзакция",
    definition:
      "Совокупность действий между сторонами спроса и предложения для обмена ценностями: информацией, товарами, услугами, денежными средствами и другим.",
  },
  {
    term: "Транзакционные издержки",
    definition:
      "Издержки использования рыночного механизма, связанные с поиском информации о контрагенте, переговорами, заключением и исполнением контрактов, а также контролем их соблюдения.",
  },
  {
    term: "Сетевой эффект",
    definition:
      "Механизм, при котором ценность цифровой платформы для одной стороны возрастает при увеличении числа участников другой стороны. Бывает прямым, косвенным и основанным на данных.",
  },
  {
    term: "Платформизация экономики",
    definition:
      "Процесс системного внедрения цифровых платформ в деятельность участников отрасли, который изменяет цепочки создания стоимости, рыночные структуры и способы взаимодействия пользователей.",
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
        className="w-full rounded-xl border border-[#0D78F8] bg-white px-5 py-3.5 font-bold text-[#0059C7] transition hover:bg-[#EEF6FF]"
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
                      {item.definition}
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
