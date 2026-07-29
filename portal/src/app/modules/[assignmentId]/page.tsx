import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import ReactMarkdown from "react-markdown";
import { AppShell } from "@/components/app-shell";
import { DraftStatus } from "@/components/draft-status";
import { DynamicForm } from "@/components/dynamic-form";
import { GlossaryModal } from "@/components/glossary-modal";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { isModuleUnlocked } from "@/lib/module-access-db";
import { isQuestionHidden } from "@/lib/questions";
import {
  canDownloadSubmissionResults,
  statusLabels,
  statusStyles,
} from "@/lib/status";

export default async function ModulePage({
  params,
}: {
  params: Promise<{ assignmentId: string }>;
}) {
  const user = await requireUser();
  const { assignmentId } = await params;
  const assignment = await db.moduleAssignment.findUnique({
    where: { id: assignmentId },
    include: {
      module: true,
      moduleVersion: {
        include: { questions: { orderBy: { order: "asc" } } },
      },
      submission: {
        include: {
          answers: true,
          comments: {
            include: { author: true, question: true },
            orderBy: { createdAt: "desc" },
          },
        },
      },
    },
  });
  if (!assignment || assignment.userId !== user.id || !assignment.submission) {
    notFound();
  }
  if (!(await isModuleUnlocked(user.id, assignment.module.order))) {
    redirect("/dashboard?locked=1");
  }
  const status = assignment.submission.status;
  const canDownload = canDownloadSubmissionResults(status);
  const answers = Object.fromEntries(
    assignment.submission.answers.map((answer) => [
      answer.questionId,
      answer.value,
    ]),
  );
  const foundationOrders =
    assignment.module.order === 2
      ? [1]
      : assignment.module.order === 3
        ? [1, 2]
        : assignment.module.order === 4
          ? [1, 2, 3]
          : assignment.module.order === 5
            ? [1, 2, 3, 4]
            : [];
  const foundationAssignments = foundationOrders.length
    ? await db.moduleAssignment.findMany({
        where: {
          userId: user.id,
          module: { order: { in: foundationOrders } },
          submission: { status: "ACCEPTED" },
        },
        include: {
          module: true,
          submission: {
            include: {
              answers: { include: { question: true } },
            },
          },
        },
      })
    : [];
  const answersForOrder = (order: number) =>
    Object.fromEntries(
      foundationAssignments
        .find((item) => item.module.order === order)
        ?.submission?.answers.map((answer) => [
          answer.question.key,
          answer.value,
        ]) ?? [],
    );
  const sectionOneAnswers = answersForOrder(1);
  const sectionTwoAnswers = answersForOrder(2);
  const sectionThreeAnswers = answersForOrder(3);
  const sectionFourAnswers = answersForOrder(4);
  const boundaryRows = Array.isArray(sectionOneAnswers.analysis_object)
    ? (sectionOneAnswers.analysis_object as Array<Record<string, unknown>>)
    : [];
  const segmentRows = Array.isArray(sectionOneAnswers.industry_boundaries)
    ? (sectionOneAnswers.industry_boundaries as Array<Record<string, unknown>>)
    : [];
  const industry =
    String(boundaryRows[0]?.industry ?? "") ||
    "Коммуникации, медиа и развлечения";
  const segments = segmentRows
    .map((row) => ({
      name:
        String(row.segment ?? "") === "Другое"
          ? String(row.customSegment ?? "")
          : String(row.segment ?? ""),
      userActivityShare: String(row.userActivityShare ?? ""),
      economicShare: String(row.economicShare ?? ""),
    }))
    .filter((segment) => segment.name);
  const participantRows = Array.isArray(sectionTwoAnswers.participants)
    ? (sectionTwoAnswers.participants as Array<Record<string, unknown>>)
    : [];
  const macroRows = Array.isArray(sectionTwoAnswers.macrotransactions)
    ? (sectionTwoAnswers.macrotransactions as Array<Record<string, unknown>>)
    : [];
  const participantKinds = (row: Record<string, unknown>) =>
    (Array.isArray(row.kind) ? row.kind : [row.kind])
      .map(String)
      .filter(Boolean);
  const governmentParticipants = participantRows
    .filter((row) => participantKinds(row).includes("government"))
    .map((row) => String(row.name ?? "").trim())
    .filter(Boolean);
  const marketParticipants = participantRows
    .filter((row) =>
      participantKinds(row).some((kind) => kind !== "government"),
    )
    .map((row) => String(row.name ?? "").trim())
    .filter(Boolean);
  const macroTransactions = macroRows
    .map((row) => String(row.name ?? "").trim())
    .filter(Boolean);
  const participantGroups = participantRows
    .map((row) => String(row.name ?? "").trim())
    .filter(Boolean);
  const platformRows = Array.isArray(sectionThreeAnswers.platforms)
    ? (sectionThreeAnswers.platforms as Array<Record<string, unknown>>)
    : [];
  const acceptedPlatforms = platformRows
    .map((row) => String(row.name ?? "").trim())
    .filter(Boolean);
  const stateFunctionRows = Array.isArray(sectionThreeAnswers.state_functions)
    ? (sectionThreeAnswers.state_functions as Array<Record<string, unknown>>)
    : [];
  const stateParticipants = stateFunctionRows
    .map((row) => String(row.participant ?? "").trim())
    .filter(Boolean);
  const industryParticipants = Array.from(
    new Set([...participantGroups, ...stateParticipants]),
  );
  const transactionAssessmentRows = Array.isArray(
    sectionTwoAnswers.transaction_assessments,
  )
    ? (sectionTwoAnswers.transaction_assessments as Array<
        Record<string, unknown>
      >)
    : [];
  const networkEffectRows = Array.isArray(sectionThreeAnswers.network_effects)
    ? (sectionThreeAnswers.network_effects as Array<Record<string, unknown>>)
    : [];
  const architectureRows = [
    ...(Array.isArray(sectionFourAnswers.data_access)
      ? (sectionFourAnswers.data_access as Array<Record<string, unknown>>)
      : []),
    ...(Array.isArray(sectionFourAnswers.user_access)
      ? (sectionFourAnswers.user_access as Array<Record<string, unknown>>)
      : []),
  ];
  const priorConstraints = Array.from(
    new Set(
      [
        ...transactionAssessmentRows.flatMap((row) =>
          Array.isArray(row.costSources) ? row.costSources.map(String) : [],
        ),
        ...networkEffectRows.flatMap((row) =>
          Array.isArray(row.constraints) ? row.constraints.map(String) : [],
        ),
        ...architectureRows.flatMap((row) =>
          Array.isArray(row.restrictions) ? row.restrictions.map(String) : [],
        ),
      ]
        .map((value) => value.trim())
        .filter(
          (value) =>
            value &&
            value !== "Другое" &&
            !value.startsWith("Существенных ограничений не выявлено"),
        ),
    ),
  );
  const acceptedParticipantAnswers =
    assignment.module.order === 2
      ? await db.answer.findMany({
          where: {
            question: {
              key: "participants",
              moduleVersion: { module: { order: 2 } },
            },
            submission: { status: "ACCEPTED" },
          },
          select: { value: true },
        })
      : [];
  const approvedParticipantGroups = Array.from(
    new Set(
      acceptedParticipantAnswers.flatMap((answer) =>
        Array.isArray(answer.value)
          ? answer.value
              .map((row) =>
                typeof row === "object" && row && "name" in row
                  ? String(row.name ?? "").trim()
                  : "",
              )
              .filter(Boolean)
          : [],
      ),
    ),
  );
  const contextualOptions = {
    industrySegments: segments.map((segment) => ({
      value: segment.name,
      label: segment.name,
    })),
    approvedParticipantGroups: approvedParticipantGroups.map((group) => ({
      value: group,
      label: `${group} (добавлено экспертом)`,
    })),
    governmentParticipants: governmentParticipants.map((name) => ({
      value: name,
      label: name,
    })),
    marketParticipants: marketParticipants.map((name) => ({
      value: name,
      label: name,
    })),
    macroTransactions: macroTransactions.map((name) => ({
      value: name,
      label: name,
    })),
    participantGroups: participantGroups.map((name) => ({
      value: name,
      label: name,
    })),
    industryParticipants: industryParticipants.map((name) => ({
      value: name,
      label: name,
    })),
    acceptedPlatforms: acceptedPlatforms.map((name) => ({
      value: name,
      label: name,
    })),
    priorConstraints: priorConstraints.map((name) => ({
      value: name,
      label: name,
    })),
  };
  const questions = assignment.moduleVersion.questions
    .filter((question) => !isQuestionHidden(question.config))
    .map((question) => ({
      id: question.id,
      key: question.key,
      type: question.type,
      title: question.title,
      description: question.description,
      required: question.required,
      config: question.config as {
      options?: Array<{ value: string; label: string }>;
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
      columns?: Array<{
        key: string;
        title: string;
        description?: string;
        type: string;
        required?: boolean;
        options?: Array<{ value: string; label: string }>;
        allowCustom?: boolean;
        contextKey?: string;
        defaultValue?: string;
        excludeColumnKey?: string;
        excludeOptionValues?: string[];
        fullWidth?: boolean;
        lastOptionValue?: string;
        notBeforeColumnKey?: string;
        optionsFromColumnKey?: string;
        requiredWhen?: {
          columnKey: string;
          equals?: string;
          includes?: string;
        };
        requiredWhenAny?: Array<{
          columnKey: string;
          equals?: string;
          includes?: string;
        }>;
        sortOptions?: boolean;
        sourceQuestionKey?: string;
        sourceColumnKey?: string;
        sourceFilterColumnKey?: string;
        sourceFilterValueFromColumnKey?: string;
        sourceLabelSuffix?: string;
        uniqueAcrossRows?: boolean;
        visibleWhen?: {
          columnKey: string;
          equals?: string;
          includes?: string;
        };
        min?: number;
        max?: number;
        step?: number;
      }>;
      },
    }));
  const initialAnswers = { ...answers };
  const penetrationQuestion = questions.find(
    (question) => question.key === "platform_penetration",
  );
  const savedPenetrationRows = penetrationQuestion
    ? initialAnswers[penetrationQuestion.id]
    : undefined;

  if (
    assignment.module.order === 3 &&
    penetrationQuestion &&
    (!Array.isArray(savedPenetrationRows) || savedPenetrationRows.length === 0)
  ) {
    initialAnswers[penetrationQuestion.id] = macroTransactions.map((macro) => ({
      macro,
      share: "",
      basis: "",
      customBasis: "",
      rationale: "",
    }));
  }

  return (
    <AppShell user={user}>
      <Link href="/dashboard" className="text-sm font-semibold text-[#0059C7]">
        ← Все разделы
      </Link>
      <div className="mt-5 grid gap-7 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <div>
          <div className="paper rounded-2xl p-6 sm:p-8">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold uppercase tracking-wider text-[#0059C7]">
                  Раздел {String(assignment.module.order).padStart(2, "0")}
                </p>
                <h1 className="mt-2 text-3xl text-[#000000] sm:text-4xl">
                  {assignment.module.title}
                </h1>
                <p className="mt-3 max-w-2xl leading-7 text-neutral-600">
                  {assignment.moduleVersion.description}
                </p>
                {canDownload && (
                  <a
                    href={`/api/assignments/${assignment.id}/pdf`}
                    className="mt-5 inline-flex rounded-xl bg-[#0059C7] px-5 py-3 text-center text-sm font-semibold text-white hover:bg-[#00479F]"
                  >
                    Скачать PDF
                  </a>
                )}
              </div>
              {status !== "DRAFT" && (
                <span
                  className={`rounded-full px-3 py-1.5 text-xs font-semibold ${statusStyles[status]}`}
                >
                  {statusLabels[status]}
                </span>
              )}
            </div>
          </div>

          {assignment.submission.comments.length > 0 && (
            <section className="mt-5 rounded-2xl border border-[#D8B1F5] bg-[#F1E5FB] p-5">
              <h2 className="font-semibold text-[#541087]">Комментарии проверки</h2>
              <div className="mt-3 space-y-3">
                {assignment.submission.comments.map((comment) => (
                  <div key={comment.id} className="rounded-lg bg-white/70 p-3 text-sm">
                    <p className="text-[#541087]">{comment.body}</p>
                    <p className="mt-1 text-xs text-[#6815A8]">
                      {comment.author.fullName}
                      {comment.question ? ` · ${comment.question.title}` : ""}
                    </p>
                  </div>
                ))}
              </div>
            </section>
          )}

          <section className="paper mt-5 rounded-2xl p-6 sm:p-8">
            <p className="text-sm font-semibold uppercase tracking-wider text-[#8125C8]">
              Теоретическая часть
            </p>
            <h2 className="mt-2 text-2xl font-bold text-black">
              Что нужно знать перед заполнением
            </h2>
            <div className="prose mt-5">
              <ReactMarkdown>{assignment.moduleVersion.theoryMarkdown}</ReactMarkdown>
            </div>
          </section>
          {assignment.module.order === 2 &&
            foundationAssignments.some(
              (foundation) => foundation.module.order === 1,
            ) && (
            <section className="paper mt-5 rounded-2xl border border-[#7EE0EC] p-6 sm:p-8">
              <p className="text-sm font-semibold uppercase tracking-wider text-[#0059C7]">
                Основа из раздела 1
              </p>
              <h2 className="mt-2 text-2xl font-bold text-black">
                Принятые сегменты
              </h2>
              <p className="mt-2 text-sm leading-6 text-neutral-500">
                Эти данные уже согласованы модератором и используются в полях
                раздела 2. Повторно вводить их не нужно.
              </p>
              <div className="mt-5 rounded-xl bg-[#E0EEFF] p-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-[#0059C7]">
                  Отрасль
                </p>
                <p className="mt-1 font-semibold text-black">{industry}</p>
              </div>
              {segments.length > 0 && (
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  {segments.map((segment) => (
                    <div
                      key={segment.name}
                      className="rounded-xl border border-neutral-200 bg-white p-4"
                    >
                      <p className="font-semibold text-black">{segment.name}</p>
                      <div className="mt-2 space-y-1 text-xs leading-5 text-neutral-500">
                        {segment.userActivityShare && (
                          <p>
                            Пользовательская активность:{" "}
                            {segment.userActivityShare}
                          </p>
                        )}
                        {segment.economicShare && (
                          <p>Экономическая доля: {segment.economicShare}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}
          {assignment.module.order === 3 &&
            foundationAssignments.some(
              (foundation) => foundation.module.order === 1,
            ) &&
            foundationAssignments.some(
              (foundation) => foundation.module.order === 2,
            ) && (
              <section className="paper mt-5 rounded-2xl border border-[#7EE0EC] p-6 sm:p-8">
                <p className="text-sm font-semibold uppercase tracking-wider text-[#0059C7]">
                  Основа из разделов 1 и 2
                </p>
                <h2 className="mt-2 text-2xl font-bold text-black">
                  Принятые сегменты, участники и макротранзакции
                </h2>
                <p className="mt-2 text-sm leading-6 text-neutral-500">
                  Ниже показаны данные, уже согласованные модератором. Они
                  доступны для выбора в полях раздела 3, поэтому повторно
                  описывать их не нужно.
                </p>

                <div className="mt-5 grid gap-4 lg:grid-cols-3">
                  <div className="rounded-xl bg-[#E0EEFF] p-4">
                    <p className="text-xs font-semibold uppercase tracking-wider text-[#0059C7]">
                      Сегменты
                    </p>
                    <div className="mt-3 space-y-2 text-sm text-black">
                      {segments.map((segment) => (
                        <p key={segment.name}>{segment.name}</p>
                      ))}
                    </div>
                  </div>
                  <div className="rounded-xl bg-[#DDF8FB] p-4">
                    <p className="text-xs font-semibold uppercase tracking-wider text-[#0059C7]">
                      Государственные участники
                    </p>
                    <div className="mt-3 space-y-2 text-sm text-black">
                      {governmentParticipants.length > 0 ? (
                        governmentParticipants.map((participant) => (
                          <p key={participant}>{participant}</p>
                        ))
                      ) : (
                        <p className="leading-5 text-neutral-600">
                          В разделе 2 отдельные государственные участники не
                          выделены. Их можно указать в разделе 3.
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="rounded-xl bg-[#F1E5FB] p-4">
                    <p className="text-xs font-semibold uppercase tracking-wider text-[#6815A8]">
                      Макротранзакции
                    </p>
                    <div className="mt-3 space-y-2 text-sm text-black">
                      {macroTransactions.map((macro) => (
                        <p key={macro}>{macro}</p>
                      ))}
                    </div>
                  </div>
                </div>
              </section>
            )}
          {assignment.module.order === 4 &&
            [1, 2, 3].every((order) =>
              foundationAssignments.some(
                (foundation) => foundation.module.order === order,
              ),
            ) && (
              <section className="paper mt-5 rounded-2xl border border-[#7EE0EC] p-6 sm:p-8">
                <p className="text-sm font-semibold uppercase tracking-wider text-[#0059C7]">
                  Основа из разделов 1–3
                </p>
                <h2 className="mt-2 text-2xl font-bold text-black">
                  Принятые платформы и контекст взаимодействия
                </h2>
                <p className="mt-2 text-sm leading-6 text-neutral-500">
                  Эти данные уже согласованы модератором и доступны для выбора
                  в разделе 4. Здесь нужно оценить существующие условия доступа,
                  а не повторно описывать платформы и участников.
                </p>
                <div className="mt-5 grid gap-4 lg:grid-cols-3">
                  <div className="rounded-xl bg-[#E0EEFF] p-4">
                    <p className="text-xs font-semibold uppercase tracking-wider text-[#0059C7]">
                      Платформы
                    </p>
                    <div className="mt-3 space-y-2 text-sm text-black">
                      {acceptedPlatforms.map((platform) => (
                        <p key={platform}>{platform}</p>
                      ))}
                    </div>
                  </div>
                  <div className="rounded-xl bg-[#DDF8FB] p-4">
                    <p className="text-xs font-semibold uppercase tracking-wider text-[#0059C7]">
                      Группы участников
                    </p>
                    <div className="mt-3 space-y-2 text-sm text-black">
                      {participantGroups.map((participant) => (
                        <p key={participant}>{participant}</p>
                      ))}
                    </div>
                  </div>
                  <div className="rounded-xl bg-[#F1E5FB] p-4">
                    <p className="text-xs font-semibold uppercase tracking-wider text-[#6815A8]">
                      Макротранзакции
                    </p>
                    <div className="mt-3 space-y-2 text-sm text-black">
                      {macroTransactions.map((macro) => (
                        <p key={macro}>{macro}</p>
                      ))}
                    </div>
                  </div>
                </div>
              </section>
            )}
          {assignment.module.order === 5 &&
            [1, 2, 3, 4].every((order) =>
              foundationAssignments.some(
                (foundation) => foundation.module.order === order,
              ),
            ) && (
              <section className="paper mt-5 rounded-2xl border border-[#7EE0EC] p-6 sm:p-8">
                <p className="text-sm font-semibold uppercase tracking-wider text-[#0059C7]">
                  Основа из разделов 1–4
                </p>
                <h2 className="mt-2 text-2xl font-bold text-black">
                  Контекст для выявления системных барьеров
                </h2>
                <p className="mt-2 text-sm leading-6 text-neutral-500">
                  Используйте принятые данные как основание для выводов.
                  Наблюдение из предыдущего раздела ещё не является барьером:
                  в карточке нужно сформулировать его системную причину,
                  последствия и способ устранения.
                </p>
                <div className="mt-5 grid gap-4 lg:grid-cols-3">
                  <div className="rounded-xl bg-[#E0EEFF] p-4">
                    <p className="text-xs font-semibold uppercase tracking-wider text-[#0059C7]">
                      Платформы
                    </p>
                    <div className="mt-3 space-y-2 text-sm text-black">
                      {acceptedPlatforms.map((platform) => (
                        <p key={platform}>{platform}</p>
                      ))}
                    </div>
                  </div>
                  <div className="rounded-xl bg-[#DDF8FB] p-4">
                    <p className="text-xs font-semibold uppercase tracking-wider text-[#0059C7]">
                      Макротранзакции
                    </p>
                    <div className="mt-3 space-y-2 text-sm text-black">
                      {macroTransactions.map((macro) => (
                        <p key={macro}>{macro}</p>
                      ))}
                    </div>
                  </div>
                  <div className="rounded-xl bg-[#F1E5FB] p-4">
                    <p className="text-xs font-semibold uppercase tracking-wider text-[#6815A8]">
                      Ранее выявленные ограничения
                    </p>
                    <div className="mt-3 space-y-2 text-sm text-black">
                      {priorConstraints.length > 0 ? (
                        priorConstraints.map((constraint) => (
                          <p key={constraint}>{constraint}</p>
                        ))
                      ) : (
                        <p className="leading-5 text-neutral-600">
                          В принятых разделах отдельные ограничения не
                          зафиксированы.
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </section>
            )}
          <section className="mt-5 rounded-2xl bg-[#0D78F8] p-6 text-white sm:p-8">
            <p className="text-sm font-semibold uppercase tracking-wider text-white/80">
              Практическая часть
            </p>
            <h2 className="mt-2 text-2xl font-bold">
              Ответьте на вопросы раздела
            </h2>
            <p className="mt-2 max-w-2xl leading-7 text-white/90">
              <span className="block">
                Опирайтесь на собственную экспертизу, проверяемые данные и
                конкретные примеры.
              </span>
              <span className="block">Обязательные поля отмечены *</span>
              <span className="block">Черновик сохраняется автоматически.</span>
            </p>
          </section>
          <div className="mt-4">
            <DynamicForm
              assignmentId={assignment.id}
              questions={questions}
              initialAnswers={initialAnswers}
              initialRevision={assignment.submission.revision}
              initialStatus={status}
              contextualOptions={contextualOptions}
            />
          </div>
        </div>

        <aside className="space-y-4 xl:sticky xl:top-5 xl:self-start">
          <section className="paper rounded-2xl p-5">
            <p className="text-xs font-semibold uppercase tracking-wider text-neutral-400">
              Как работать
            </p>
            <ol className="mt-4 space-y-4 text-sm leading-6 text-neutral-600">
              <li><strong className="text-[#000000]">1.</strong> Изучите методические материалы.</li>
              <li><strong className="text-[#000000]">2.</strong> Заполните вопросы и таблицы.</li>
              <li><strong className="text-[#000000]">3.</strong> Проверьте ответы в предварительном PDF.</li>
              <li><strong className="text-[#000000]">4.</strong> Отправьте раздел на проверку.</li>
            </ol>
          </section>
          <GlossaryModal />
          <section className="rounded-2xl bg-[#DDF8FB] p-5">
            <p className="text-lg text-[#000000]">Важно</p>
            <p className="mt-2 text-sm leading-6 text-neutral-600">
              Подкрепляйте выводы измеримыми показателями, источниками и
              конкретными примерами.
            </p>
          </section>
          <DraftStatus assignmentId={assignment.id} initialStatus={status} />
        </aside>
      </div>
    </AppShell>
  );
}
