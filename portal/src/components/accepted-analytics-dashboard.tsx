import {
  buildAcceptedAnalytics,
  type AnalyticsSubmission,
} from "@/lib/accepted-analytics";

function Empty() {
  return (
    <p className="py-8 text-center text-sm text-neutral-400">
      Недостаточно принятых ответов
    </p>
  );
}

function PriorityBadge({ value }: { value: string }) {
  const colors =
    value === "Высокий"
      ? "bg-[#FFE0ED] text-[#A9004A]"
      : value === "Средний"
        ? "bg-[#FFF3D6] text-[#765300]"
        : "bg-[#DDF8FB] text-[#00616C]";
  return (
    <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${colors}`}>
      {value}
    </span>
  );
}

export function AcceptedAnalyticsDashboard({
  submissions,
}: {
  submissions: AnalyticsSubmission[];
}) {
  const analytics = buildAcceptedAnalytics(submissions);
  const maxMetricScore = Math.max(
    ...analytics.priorityMetrics.map((item) => item.score),
    1,
  );

  return (
    <div className="mt-7 space-y-7">
      <section className="paper overflow-hidden rounded-2xl">
        <div className="border-b border-neutral-200 px-6 py-5">
          <h2 className="text-2xl font-bold text-black">Карта сегментов</h2>
          <p className="mt-1 text-sm text-neutral-500">
            Медианные оценки и степень согласованности. Нажмите на сегмент,
            чтобы увидеть обоснования.
          </p>
        </div>
        {analytics.segmentComparison.length ? (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-[#E0EEFF] text-[#003F8F]">
                <tr>
                  <th className="px-5 py-3">Сегмент</th>
                  <th className="px-5 py-3">Активность</th>
                  <th className="px-5 py-3">Экономика</th>
                  <th className="px-5 py-3">Оценок</th>
                  <th className="px-5 py-3">Согласованность</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {analytics.segmentComparison.map((segment) => (
                  <tr key={segment.name} className="align-top">
                    <td className="px-5 py-4">
                      <details>
                        <summary className="cursor-pointer font-semibold text-black">
                          {segment.name}
                        </summary>
                        <div className="mt-3 max-w-2xl space-y-3 text-xs leading-5 text-neutral-600">
                          {segment.rationales.length ? (
                            segment.rationales.map((item, index) => (
                              <p key={`${item.expert}-${index}`}>
                                <strong className="text-black">{item.expert}:</strong>{" "}
                                {item.value}
                              </p>
                            ))
                          ) : (
                            <p>Обоснования не представлены.</p>
                          )}
                        </div>
                      </details>
                    </td>
                    <td className="px-5 py-4">{segment.activity}</td>
                    <td className="px-5 py-4">{segment.economy}</td>
                    <td className="px-5 py-4">{segment.responses}</td>
                    <td className="px-5 py-4">
                      <span
                        className={
                          segment.agreement === "Мнения расходятся"
                            ? "font-semibold text-[#A9004A]"
                            : "text-neutral-700"
                        }
                      >
                        {segment.agreement}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty />
        )}
      </section>

      <section className="paper overflow-hidden rounded-2xl">
        <div className="border-b border-neutral-200 px-6 py-5">
          <h2 className="text-2xl font-bold text-black">
            Платформы и уровень проникновения
          </h2>
          <p className="mt-1 text-sm text-neutral-500">
            Свод по принятым ответам раздела 3.
          </p>
        </div>
        <div className="grid gap-0 lg:grid-cols-2 lg:divide-x lg:divide-neutral-100">
          <div className="p-6">
            <h3 className="font-semibold text-black">Действующие платформы</h3>
            <div className="mt-4 space-y-3">
              {analytics.platforms.slice(0, 12).map((platform) => (
                <div key={platform.name} className="flex justify-between gap-4 text-sm">
                  <p className="font-medium text-black">{platform.name}</p>
                  <p className="text-right text-xs text-neutral-500">
                    {platform.types.join(", ") || "Тип не указан"} ·{" "}
                    {platform.mentions}
                  </p>
                </div>
              ))}
              {!analytics.platforms.length && <Empty />}
            </div>
          </div>
          <div className="overflow-x-auto">
            {analytics.platformPenetration.length ? (
              <table className="min-w-full text-left text-sm">
                <thead className="bg-[#E0EEFF] text-[#003F8F]">
                  <tr>
                    <th className="px-5 py-3">Макротранзакция</th>
                    <th className="px-5 py-3">Медиана</th>
                    <th className="px-5 py-3">Согласованность</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {analytics.platformPenetration.map((item) => (
                    <tr key={item.macro}>
                      <td className="px-5 py-4 font-medium text-black">
                        {item.macro}
                      </td>
                      <td className="px-5 py-4">{item.share}</td>
                      <td className="px-5 py-4">{item.agreement}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <Empty />
            )}
          </div>
        </div>
      </section>

      <div className="grid gap-7 xl:grid-cols-2">
        <section className="paper overflow-hidden rounded-2xl">
          <div className="border-b border-neutral-200 px-6 py-5">
            <h2 className="text-xl font-bold text-black">
              Ограничения архитектуры
            </h2>
            <p className="mt-1 text-sm text-neutral-500">
              Наиболее частые ограничения доступа к данным и платформам.
            </p>
          </div>
          <div className="divide-y divide-neutral-100">
            {analytics.architectureConstraints.slice(0, 12).map((item) => (
              <div
                key={item.name}
                className="flex justify-between gap-4 px-6 py-4 text-sm"
              >
                <p className="text-neutral-700">{item.name}</p>
                <strong className="shrink-0 text-black">{item.mentions}</strong>
              </div>
            ))}
            {!analytics.architectureConstraints.length && <Empty />}
          </div>
        </section>

        <section className="paper overflow-hidden rounded-2xl">
          <div className="border-b border-neutral-200 px-6 py-5">
            <h2 className="text-xl font-bold text-black">Карта барьеров</h2>
            <p className="mt-1 text-sm text-neutral-500">
              Распределение по категориям и повторяющиеся формулировки.
            </p>
          </div>
          <div className="p-6">
            <div className="flex flex-wrap gap-2">
              {analytics.barrierCategories.map((item) => (
                <span
                  key={item.category}
                  className="rounded-full bg-[#F1E5FB] px-3 py-1.5 text-xs font-semibold text-[#6815A8]"
                >
                  {item.category}: {item.mentions}
                </span>
              ))}
            </div>
            <div className="mt-5 space-y-3">
              {analytics.barrierNames.slice(0, 10).map((item) => (
                <div key={item.name} className="flex justify-between gap-4 text-sm">
                  <p className="text-neutral-700">{item.name}</p>
                  <strong className="shrink-0 text-black">{item.mentions}</strong>
                </div>
              ))}
              {!analytics.barrierNames.length && <Empty />}
            </div>
          </div>
        </section>
      </div>

      <section className="paper overflow-hidden rounded-2xl">
        <div className="border-b border-neutral-200 px-6 py-5">
          <h2 className="text-2xl font-bold text-black">
            Портфель эффектов платформизации
          </h2>
          <p className="mt-1 text-sm text-neutral-500">
            Количество принятых оценок по категориям и статусам эффекта.
          </p>
        </div>
        <div className="grid gap-6 p-6 lg:grid-cols-2">
          {[analytics.effectCategories, analytics.effectStatuses].map(
            (items, groupIndex) => (
              <div key={groupIndex}>
                <p className="text-sm font-semibold text-black">
                  {groupIndex === 0 ? "Категории" : "Статусы"}
                </p>
                <div className="mt-3 space-y-3">
                  {items.map((item) => {
                    const label =
                      "category" in item ? item.category : item.status;
                    return (
                      <div
                        key={label}
                        className="flex justify-between gap-4 text-sm"
                      >
                        <p className="text-neutral-600">{label}</p>
                        <strong>{item.mentions}</strong>
                      </div>
                    );
                  })}
                  {!items.length && <Empty />}
                </div>
              </div>
            ),
          )}
        </div>
      </section>

      <section className="paper overflow-hidden rounded-2xl">
        <div className="border-b border-neutral-200 px-6 py-5">
          <h2 className="text-2xl font-bold text-black">
            Международный потенциал
          </h2>
          <p className="mt-1 text-sm text-neutral-500">
            Медианная оценка, рынки и ограничения из раздела 7.
          </p>
        </div>
        {analytics.internationalPlatforms.length ? (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-neutral-50 text-neutral-500">
                <tr>
                  <th className="px-5 py-3">Платформа</th>
                  <th className="px-5 py-3">Потенциал</th>
                  <th className="px-5 py-3">Согласованность</th>
                  <th className="px-5 py-3">Приоритетные рынки</th>
                  <th className="px-5 py-3">Ограничения</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {analytics.internationalPlatforms.map((item) => (
                  <tr key={item.platform} className="align-top">
                    <td className="px-5 py-4 font-semibold text-black">
                      {item.platform}
                    </td>
                    <td className="px-5 py-4">{item.potential}</td>
                    <td className="px-5 py-4">{item.agreement}</td>
                    <td className="max-w-xs px-5 py-4 text-xs leading-5">
                      {item.markets
                        .slice(0, 4)
                        .map((value) => `${value.name} (${value.mentions})`)
                        .join("; ") || "—"}
                    </td>
                    <td className="max-w-sm px-5 py-4 text-xs leading-5">
                      {item.constraints
                        .slice(0, 4)
                        .map((value) => `${value.name} (${value.mentions})`)
                        .join("; ") || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty />
        )}
      </section>

      <section className="paper overflow-hidden rounded-2xl">
        <div className="border-b border-neutral-200 px-6 py-5">
          <h2 className="text-2xl font-bold text-black">
            Целевые ориентиры до 2036 года
          </h2>
          <p className="mt-1 text-sm text-neutral-500">
            Медианы итоговых оценок раздела 8.
          </p>
        </div>
        {analytics.targetTransactions.length ? (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-[#E0EEFF] text-[#003F8F]">
                <tr>
                  <th className="px-5 py-3">Макротранзакция</th>
                  <th className="px-5 py-3">Доля транзакций</th>
                  <th className="px-5 py-3">Доля участников</th>
                  <th className="px-5 py-3">Сокращение издержек</th>
                  <th className="px-5 py-3">Согласованность</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {analytics.targetTransactions.map((item) => (
                  <tr key={item.macro}>
                    <td className="px-5 py-4 font-semibold text-black">
                      {item.macro}
                    </td>
                    <td className="px-5 py-4">{item.transactionShare}</td>
                    <td className="px-5 py-4">{item.participantShare}</td>
                    <td className="px-5 py-4">{item.costReduction}</td>
                    <td className="px-5 py-4">{item.agreement}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty />
        )}
        {analytics.recommendationDirections.length > 0 && (
          <div className="border-t border-neutral-100 p-6">
            <p className="text-sm font-semibold text-black">
              Направления рекомендаций
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {analytics.recommendationDirections.map((item) => (
                <span
                  key={item.direction}
                  className="rounded-full bg-[#DDF8FB] px-3 py-1.5 text-xs font-semibold text-[#00616C]"
                >
                  {item.direction}: {item.mentions}
                </span>
              ))}
            </div>
          </div>
        )}
      </section>

      <div className="grid gap-7 xl:grid-cols-2">
        <section className="paper overflow-hidden rounded-2xl">
          <div className="border-b border-neutral-200 px-6 py-5">
            <h2 className="text-xl font-bold text-black">
              Ретроспектива 2018–2026
            </h2>
            <p className="mt-1 text-sm text-neutral-500">
              Распределение характера влияния по отмеченным факторам.
            </p>
          </div>
          {analytics.factors.length ? (
            <div className="divide-y divide-neutral-100">
              {analytics.factors.slice(0, 10).map((factor) => (
                <div key={factor.factor} className="px-6 py-4">
                  <div className="flex justify-between gap-4">
                    <div>
                      <p className="text-sm font-semibold text-black">
                        {factor.factor}
                      </p>
                      {factor.period && (
                        <p className="mt-1 text-xs font-medium text-[#0059C7]">
                          {factor.period}
                        </p>
                      )}
                    </div>
                    <span className="shrink-0 text-xs text-neutral-400">
                      {factor.total} оценок
                    </span>
                  </div>
                  <div className="mt-3 flex h-3 overflow-hidden rounded-full bg-neutral-100">
                    <div
                      className="bg-[#FF3186]"
                      title={`Негативное: ${factor.negative}`}
                      style={{ width: `${(factor.negative / factor.total) * 100}%` }}
                    />
                    <div
                      className="bg-[#BFC6CF]"
                      title={`Нейтральное: ${factor.neutral}`}
                      style={{ width: `${(factor.neutral / factor.total) * 100}%` }}
                    />
                    <div
                      className="bg-[#0D78F8]"
                      title={`Позитивное: ${factor.positive}`}
                      style={{ width: `${(factor.positive / factor.total) * 100}%` }}
                    />
                  </div>
                  <p className="mt-2 text-xs text-neutral-500">
                    Негативное {factor.negative} · нейтральное {factor.neutral} ·
                    позитивное {factor.positive}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <Empty />
          )}
        </section>

        <section className="paper overflow-hidden rounded-2xl">
          <div className="border-b border-neutral-200 px-6 py-5">
            <h2 className="text-xl font-bold text-black">
              Приоритетные показатели
            </h2>
            <p className="mt-1 text-sm text-neutral-500">
              Баллы учитывают выбор показателя и его место в списке эксперта.
            </p>
          </div>
          {analytics.priorityMetrics.length ? (
            <div className="space-y-4 p-6">
              {analytics.priorityMetrics.slice(0, 10).map((metric, index) => (
                <div key={metric.name}>
                  <div className="flex items-start justify-between gap-4 text-sm">
                    <p className="text-neutral-700">
                      <strong className="mr-2 text-black">{index + 1}.</strong>
                      {metric.name}
                    </p>
                    <span className="shrink-0 text-xs text-neutral-500">
                      выбрали {metric.selections}
                    </span>
                  </div>
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-neutral-100">
                    <div
                      className="h-full rounded-full bg-[#8125C8]"
                      style={{ width: `${(metric.score / maxMetricScore) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <Empty />
          )}
        </section>
      </div>

      <section className="paper overflow-hidden rounded-2xl">
        <div className="border-b border-neutral-200 px-6 py-5">
          <h2 className="text-2xl font-bold text-black">
            Основные связи между участниками
          </h2>
          <p className="mt-1 text-sm text-neutral-500">
            Точные совпадения структурированных ответов: инициатор → получатель.
          </p>
        </div>
        {analytics.routes.length ? (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-neutral-50 text-neutral-500">
                <tr>
                  <th className="px-5 py-3">Инициатор</th>
                  <th className="px-5 py-3">Получатель</th>
                  <th className="px-5 py-3">Тип</th>
                  <th className="px-5 py-3">Упоминаний</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {analytics.routes.slice(0, 15).map((route) => (
                  <tr key={`${route.initiator}-${route.recipient}-${route.type}`}>
                    <td className="px-5 py-4 font-semibold text-black">
                      {route.initiator}
                    </td>
                    <td className="px-5 py-4">{route.recipient}</td>
                    <td className="px-5 py-4">{route.type || "—"}</td>
                    <td className="px-5 py-4">{route.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty />
        )}
      </section>

      <section className="paper overflow-hidden rounded-2xl">
        <div className="border-b border-neutral-200 px-6 py-5">
          <h2 className="text-2xl font-bold text-black">
            Потенциал цифровизации действий
          </h2>
          <p className="mt-1 max-w-4xl text-sm leading-6 text-neutral-500">
            Рейтинг рассчитывается по массовости, повторяемости,
            ресурсоёмкости, издержкам, низкой стандартизированности и доле
            ручного выполнения. Это расчёт по фиксированной формуле, а не
            содержательный вывод системы.
          </p>
        </div>
        {analytics.actionPriorities.length ? (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-[#E0EEFF] text-[#003F8F]">
                <tr>
                  <th className="px-5 py-3">Действие</th>
                  <th className="px-5 py-3">Сценарий</th>
                  <th className="px-5 py-3">Оценок</th>
                  <th className="px-5 py-3">Источники издержек</th>
                  <th className="px-5 py-3">Приоритет</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {analytics.actionPriorities.slice(0, 20).map((action) => (
                  <tr key={`${action.macro}-${action.name}`} className="align-top">
                    <td className="px-5 py-4 font-semibold text-black">
                      {action.name}
                    </td>
                    <td className="px-5 py-4 text-neutral-600">
                      {action.macro || "—"}
                    </td>
                    <td className="px-5 py-4">{action.responses}</td>
                    <td className="max-w-sm px-5 py-4 text-xs leading-5 text-neutral-600">
                      {action.costSources
                        .slice(0, 3)
                        .map((source) => `${source.name} (${source.count})`)
                        .join("; ") || "—"}
                    </td>
                    <td className="px-5 py-4">
                      <PriorityBadge value={action.priority} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty />
        )}
      </section>
    </div>
  );
}
