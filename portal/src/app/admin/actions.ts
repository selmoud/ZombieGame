"use server";

import { unlink } from "node:fs/promises";
import path from "node:path";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  portalLink,
  queueMaxNotification,
  resolveMaxAdminNotification,
} from "@/lib/max-bot";
import { hashPassword } from "@/lib/password";
import { normalizePhoneNumber } from "@/lib/phone";

export type CreateExpertState = {
  error?: string;
  success?: boolean;
  expert?: string;
};

const INDUSTRY_NAME = "Коммуникации, медиа и развлечения";

function boundedText(formData: FormData, key: string, maxLength: number) {
  const value = String(formData.get(key) ?? "").trim();
  return value.length <= maxLength ? value : null;
}

function optionalPercentage(formData: FormData, key: string) {
  const raw = String(formData.get(key) ?? "")
    .trim()
    .replace(",", ".");
  if (!raw) return null;
  const value = Number(raw);
  return Number.isFinite(value) && value >= 0 && value <= 100
    ? value
    : undefined;
}

export async function saveMinistryEconomicData(formData: FormData) {
  const admin = await requireRole("ADMIN");
  const gdpShare = optionalPercentage(formData, "gdpShare");
  const gvaShare = optionalPercentage(formData, "gvaShare");
  const employmentShare = optionalPercentage(formData, "employmentShare");
  if (
    gdpShare === undefined ||
    gvaShare === undefined ||
    employmentShare === undefined
  ) {
    redirect("/admin?economy=invalid#economic-data");
  }
  const reportingPeriod = boundedText(formData, "reportingPeriod", 120);
  const investmentActivity = boundedText(
    formData,
    "investmentActivity",
    4_000,
  );
  const productivityComparison = boundedText(
    formData,
    "productivityComparison",
    4_000,
  );
  const source = boundedText(formData, "source", 2_000);
  const comment = boundedText(formData, "comment", 10_000);
  if (
    reportingPeriod === null ||
    investmentActivity === null ||
    productivityComparison === null ||
    source === null ||
    comment === null
  ) {
    redirect("/admin?economy=invalid#economic-data");
  }
  const data = {
    reportingPeriod: reportingPeriod || null,
    gdpShare,
    gvaShare,
    employmentShare,
    investmentActivity: investmentActivity || null,
    productivityComparison: productivityComparison || null,
    source: source || null,
    comment: comment || null,
    updatedById: admin.id,
  };
  await db.ministryEconomicData.upsert({
    where: { industry: INDUSTRY_NAME },
    update: data,
    create: {
      industry: INDUSTRY_NAME,
      ...data,
    },
  });
  revalidatePath("/admin");
  revalidatePath("/admin/analytics");
  redirect("/admin?economy=saved#economic-data");
}

export async function createExpert(
  _previousState: CreateExpertState,
  formData: FormData,
): Promise<CreateExpertState> {
  const admin = await requireRole("ADMIN");
  const fullName = String(formData.get("fullName") ?? "")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .trim()
    .replace(/\s+/g, " ");
  const companyName = String(formData.get("company") ?? "")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .trim()
    .replace(/\s+/g, " ");
  const phoneNumber = normalizePhoneNumber(formData.get("phoneNumber"));
  const subgroupIds = [
    ...new Set(formData.getAll("subgroupIds").map(String).filter(Boolean)),
  ];
  const password = String(formData.get("password") ?? "");
  const passwordConfirmation = String(
    formData.get("passwordConfirmation") ?? "",
  );
  if (
    fullName.length > 120 ||
    companyName.length > 160 ||
    subgroupIds.length > 10 ||
    fullName.split(/\s+/).length < 2 ||
    !companyName ||
    !phoneNumber ||
    !subgroupIds.length
  ) {
    return {
      error:
        "Укажите фамилию, имя, организацию, номер телефона в формате +7 и хотя бы одну подгруппу.",
    };
  }
  if (password.length < 8 || password.length > 128) {
    return { error: "Пароль должен содержать не менее 8 символов." };
  }
  if (password !== passwordConfirmation) {
    return { error: "Пароли не совпадают." };
  }
  const [existingUser, selectedSubgroups] = await Promise.all([
    db.user.findFirst({
      where: { fullName: { equals: fullName, mode: "insensitive" } },
      select: { id: true },
    }),
    db.subgroup.findMany({
      where: { id: { in: subgroupIds } },
      select: { id: true },
    }),
  ]);
  if (existingUser) {
    return { error: "Пользователь с такими ФИО уже существует." };
  }
  if (selectedSubgroups.length !== subgroupIds.length) {
    return { error: "Одна из выбранных подгрупп больше недоступна." };
  }

  await db.$transaction(async (tx) => {
    const [company, modules] = await Promise.all([
      tx.company.upsert({
        where: { name: companyName },
        update: {},
        create: { name: companyName },
      }),
      tx.module.findMany({
        where: { isActive: true },
        include: {
          versions: {
            where: { publishedAt: { not: null } },
            orderBy: { version: "desc" },
            take: 1,
          },
        },
      }),
    ]);
    const user = await tx.user.create({
      data: {
        fullName,
        phoneNumber,
        direction: "Коммуникации, медиа и развлечения",
        role: "EXPERT",
        companyId: company.id,
        subgroupMemberships: {
          create: selectedSubgroups.map((subgroup) => ({
            subgroupId: subgroup.id,
          })),
        },
        isActive: true,
        activatedAt: new Date(),
        passwordHash: await hashPassword(password),
      },
    });
    for (const moduleRecord of modules) {
      const version = moduleRecord.versions[0];
      if (!version) continue;
      const assignment = await tx.moduleAssignment.create({
        data: {
          userId: user.id,
          moduleId: moduleRecord.id,
          moduleVersionId: version.id,
          assignedById: admin.id,
        },
      });
      await tx.submission.create({ data: { assignmentId: assignment.id } });
    }
  });
  revalidatePath("/admin");
  return {
    success: true,
    expert: fullName,
  };
}

export type ResetExpertPasswordState = {
  error?: string;
  success?: boolean;
};

export type UpdateExpertCompanyState = {
  error?: string;
  success?: boolean;
};

export async function updateExpertCompany(
  _previousState: UpdateExpertCompanyState,
  formData: FormData,
): Promise<UpdateExpertCompanyState> {
  await requireRole("ADMIN");
  const userId = String(formData.get("userId") ?? "");
  const companyName = String(formData.get("company") ?? "")
    .trim()
    .replace(/\s+/g, " ");
  if (!companyName || companyName.length > 160) {
    return { error: "Укажите название компании длиной до 160 символов." };
  }
  const expert = await db.user.findFirst({
    where: { id: userId, role: { in: ["EXPERT", "LEAD"] } },
    include: {
      company: { include: { _count: { select: { users: true } } } },
    },
  });
  if (!expert) return { error: "Эксперт не найден." };
  if (expert.company?.name === companyName) return { success: true };

  await db.$transaction(async (tx) => {
    const matchingCompany = await tx.company.findFirst({
      where: {
        id: expert.companyId ? { not: expert.companyId } : undefined,
        name: { equals: companyName, mode: "insensitive" },
      },
      select: { id: true },
    });
    let companyId = matchingCompany?.id;
    if (!companyId && expert.company && expert.company._count.users === 1) {
      const renamed = await tx.company.update({
        where: { id: expert.company.id },
        data: { name: companyName },
        select: { id: true },
      });
      companyId = renamed.id;
    }
    if (!companyId) {
      const created = await tx.company.create({
        data: { name: companyName },
        select: { id: true },
      });
      companyId = created.id;
    }
    await tx.user.update({
      where: { id: expert.id },
      data: { companyId },
    });
    if (expert.companyId && expert.companyId !== companyId) {
      await tx.company.deleteMany({
        where: {
          id: expert.companyId,
          users: { none: {} },
        },
      });
    }
  });
  revalidatePath("/admin");
  revalidatePath("/admin/submissions");
  return { success: true };
}

export async function resetExpertPassword(
  _previousState: ResetExpertPasswordState,
  formData: FormData,
): Promise<ResetExpertPasswordState> {
  await requireRole("ADMIN");
  const userId = String(formData.get("userId") ?? "");
  const password = String(formData.get("password") ?? "");
  const passwordConfirmation = String(
    formData.get("passwordConfirmation") ?? "",
  );
  if (password.length < 8 || password.length > 128) {
    return { error: "Пароль должен содержать не менее 8 символов." };
  }
  if (password !== passwordConfirmation) {
    return { error: "Пароли не совпадают." };
  }
  const user = await db.user.findFirst({
    where: { id: userId, role: { in: ["EXPERT", "LEAD"] } },
    select: { id: true },
  });
  if (!user) return { error: "Эксперт не найден." };

  await db.$transaction([
    db.user.update({
      where: { id: user.id },
      data: {
        passwordHash: await hashPassword(password),
        isActive: true,
        activatedAt: new Date(),
      },
    }),
    db.session.updateMany({
      where: { userId: user.id, revokedAt: null },
      data: { revokedAt: new Date() },
    }),
  ]);
  revalidatePath("/admin");
  return { success: true };
}

export async function deleteExpert(formData: FormData) {
  await requireRole("ADMIN");
  const userId = String(formData.get("userId") ?? "");
  const expert = await db.user.findFirst({
    where: { id: userId, role: { in: ["EXPERT", "LEAD"] } },
    select: { id: true },
  });
  if (!expert) redirect("/admin?expert=not-found");

  const attachments = await db.attachment.findMany({
    where: {
      answer: {
        OR: [
          { updatedById: expert.id },
          { submission: { assignment: { userId: expert.id } } },
        ],
      },
    },
    select: { storageKey: true },
  });
  await db.$transaction(async (tx) => {
    await tx.answer.deleteMany({
      where: {
        OR: [
          { updatedById: expert.id },
          { submission: { assignment: { userId: expert.id } } },
        ],
      },
    });
    await tx.reviewComment.deleteMany({
      where: {
        OR: [
          { authorId: expert.id },
          { submission: { assignment: { userId: expert.id } } },
        ],
      },
    });
    await tx.statusHistory.deleteMany({
      where: {
        OR: [
          { actorId: expert.id },
          { submission: { assignment: { userId: expert.id } } },
        ],
      },
    });
    await tx.invitationToken.updateMany({
      where: { createdById: expert.id },
      data: { createdById: null },
    });
    await tx.moduleAssignment.updateMany({
      where: { assignedById: expert.id },
      data: { assignedById: null },
    });
    await tx.moduleAssignment.deleteMany({ where: { userId: expert.id } });
    await tx.user.delete({ where: { id: expert.id } });
  });

  const uploadRoot = path.join(
    /*turbopackIgnore: true*/ process.cwd(),
    process.env.UPLOAD_DIR ?? "data/uploads",
  );
  await Promise.all(
    attachments.map(async ({ storageKey }) => {
      if (!/^[0-9a-f-]{36}\/[0-9a-f-]{36}$/i.test(storageKey)) return;
      const target = path.join(
        /*turbopackIgnore: true*/ uploadRoot,
        storageKey,
      );
      await unlink(target).catch(() => undefined);
    }),
  );
  redirect("/admin?expert=deleted");
}

export async function approveRegistration(formData: FormData) {
  const admin = await requireRole("ADMIN");
  const requestId = String(formData.get("requestId") ?? "");
  const request = await db.registrationRequest.findUnique({
    where: { id: requestId },
    include: { subgroupMemberships: true, maxBotBinding: true },
  });
  if (!request || request.status !== "PENDING" || !request.passwordHash) {
    redirect("/admin?registration=unavailable");
  }
  const existingUser = await db.user.findFirst({
    where: { fullName: { equals: request.fullName, mode: "insensitive" } },
  });
  if (existingUser) {
    redirect("/admin?registration=duplicate");
  }

  await db.$transaction(async (tx) => {
    const company = await tx.company.upsert({
      where: { name: request.companyName },
      update: {},
      create: { name: request.companyName },
    });
    let subgroupIds = request.subgroupMemberships.map(
      (membership) => membership.subgroupId,
    );
    if (!subgroupIds.length) {
      subgroupIds = [
        (
          await tx.subgroup.upsert({
            where: { name: "Коммуникации" },
            update: {},
            create: { name: "Коммуникации" },
          })
        ).id,
      ];
    }
    const expert = await tx.user.create({
      data: {
        fullName: request.fullName,
        phoneNumber: request.phoneNumber,
        companyId: company.id,
        experienceSummary: request.experienceSummary,
        expertiseReason: request.expertiseReason,
        subgroupMemberships: {
          create: subgroupIds.map((subgroupId) => ({ subgroupId })),
        },
        direction: "Коммуникации, медиа и развлечения",
        role: "EXPERT",
        isActive: true,
        activatedAt: new Date(),
        passwordHash: request.passwordHash,
      },
    });
    if (request.maxBotBinding) {
      await tx.maxNotification.deleteMany({
        where: {
          bindingId: request.maxBotBinding.id,
          status: "PENDING",
          eventType: "REGISTRATION_LINKED",
        },
      });
      await tx.maxBotBinding.update({
        where: { id: request.maxBotBinding.id },
        data: { userId: expert.id, registrationRequestId: null },
      });
      await queueMaxNotification(tx, {
        bindingId: request.maxBotBinding.id,
        eventType: "ACCESS_GRANTED",
        dedupeKey: `registration-approved:${request.id}`,
        text: "Ваша заявка согласована. Доступ к порталу открыт — войдите с указанными при регистрации ФИО и паролем.",
        linkUrl: portalLink("/login"),
        linkLabel: "Войти на портал",
      });
    }
    const modules = await tx.module.findMany({
      where: { isActive: true },
      include: {
        versions: {
          where: { publishedAt: { not: null } },
          orderBy: { version: "desc" },
          take: 1,
        },
      },
    });
    for (const moduleRecord of modules) {
      const version = moduleRecord.versions[0];
      if (!version) continue;
      const assignment = await tx.moduleAssignment.create({
        data: {
          userId: expert.id,
          moduleId: moduleRecord.id,
          moduleVersionId: version.id,
          assignedById: admin.id,
        },
      });
      await tx.submission.create({ data: { assignmentId: assignment.id } });
    }
    await tx.registrationRequest.update({
      where: { id: request.id },
      data: {
        status: "APPROVED",
        passwordHash: null,
        reviewedById: admin.id,
        reviewedAt: new Date(),
        approvedUserId: expert.id,
      },
    });
    await resolveMaxAdminNotification(tx, {
      entityType: "REGISTRATION",
      entityId: request.id,
    });
  });
  redirect("/admin?registration=approved");
}

export async function sendRegistrationMessage(formData: FormData) {
  const admin = await requireRole("ADMIN");
  const requestId = String(formData.get("requestId") ?? "");
  const text = String(formData.get("message") ?? "")
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "")
    .trim();
  if (!text || text.length > 2_000) {
    redirect(
      `/admin?registration=message-invalid#registration-${requestId}`,
    );
  }

  const sent = await db.$transaction(async (tx) => {
    const request = await tx.registrationRequest.findFirst({
      where: { id: requestId, status: "PENDING" },
      include: { maxBotBinding: true },
    });
    if (!request?.maxBotBinding?.enabled) return false;
    const message = await tx.registrationMessage.create({
      data: {
        registrationRequestId: request.id,
        direction: "ADMIN_TO_EXPERT",
        text,
        adminAuthorId: admin.id,
      },
    });
    await queueMaxNotification(tx, {
      bindingId: request.maxBotBinding.id,
      eventType: "REGISTRATION_ADMIN_MESSAGE",
      dedupeKey: `registration-message:${message.id}`,
      text: `Администратор уточняет данные заявки:\n\n${text}\n\nОтветьте на это сообщение в чате.`,
    });
    return true;
  });
  if (!sent) {
    redirect(
      `/admin?registration=message-unavailable#registration-${requestId}`,
    );
  }
  revalidatePath("/admin");
  redirect(`/admin?registration=message-sent#registration-${requestId}`);
}

export async function rejectRegistration(formData: FormData) {
  const admin = await requireRole("ADMIN");
  const requestId = String(formData.get("requestId") ?? "");
  await db.$transaction(async (tx) => {
    const request = await tx.registrationRequest.findFirst({
      where: { id: requestId, status: "PENDING" },
      include: { maxBotBinding: true },
    });
    if (!request) return;
    await tx.registrationRequest.update({
      where: { id: request.id },
      data: {
        status: "REJECTED",
        passwordHash: null,
        reviewedById: admin.id,
        reviewedAt: new Date(),
      },
    });
    await resolveMaxAdminNotification(tx, {
      entityType: "REGISTRATION",
      entityId: request.id,
    });
    if (request.maxBotBinding) {
      await tx.maxNotification.deleteMany({
        where: {
          bindingId: request.maxBotBinding.id,
          status: "PENDING",
          eventType: "REGISTRATION_LINKED",
        },
      });
      await queueMaxNotification(tx, {
        bindingId: request.maxBotBinding.id,
        eventType: "REGISTRATION_REJECTED",
        dedupeKey: `registration-rejected:${request.id}`,
        text: "Заявка не согласована. Для уточнения или исправления данных обратитесь к администратору рабочей группы.",
      });
    }
  });
  redirect("/admin?registration=rejected");
}

function subgroupName(formData: FormData) {
  return String(formData.get("name") ?? "")
    .trim()
    .replace(/\s+/g, " ");
}

export async function createSubgroup(formData: FormData) {
  await requireRole("ADMIN");
  const name = subgroupName(formData);
  if (!name || name.length > 80) redirect("/admin?subgroup=invalid");
  const existing = await db.subgroup.findFirst({
    where: { name: { equals: name, mode: "insensitive" } },
    select: { id: true },
  });
  if (existing) redirect("/admin?subgroup=duplicate");
  const supervisors = await db.user.findMany({
    where: {
      isActive: true,
      OR: [
        { role: "SUPERVISOR" },
        { id: "00000000-0000-4000-8000-000000000004" },
      ],
    },
    select: { id: true },
  });
  await db.subgroup.create({
    data: {
      name,
      userMemberships: {
        create: supervisors.map(({ id }) => ({ userId: id })),
      },
    },
  });
  revalidatePath("/");
  revalidatePath("/admin");
  redirect("/admin?subgroup=created");
}

export async function renameSubgroup(formData: FormData) {
  await requireRole("ADMIN");
  const id = String(formData.get("id") ?? "");
  const name = subgroupName(formData);
  if (!id || !name || name.length > 80) {
    redirect("/admin?subgroup=invalid");
  }
  const duplicate = await db.subgroup.findFirst({
    where: {
      id: { not: id },
      name: { equals: name, mode: "insensitive" },
    },
    select: { id: true },
  });
  if (duplicate) redirect("/admin?subgroup=duplicate");
  const updated = await db.subgroup.updateMany({
    where: { id },
    data: { name },
  });
  if (!updated.count) redirect("/admin?subgroup=not-found");
  revalidatePath("/");
  revalidatePath("/admin");
  redirect("/admin?subgroup=updated");
}

export async function assignSubgroupLeader(formData: FormData) {
  await requireRole("ADMIN");
  const subgroupId = String(formData.get("subgroupId") ?? "");
  const leaderId = String(formData.get("leaderId") ?? "") || null;
  const subgroup = await db.subgroup.findUnique({
    where: { id: subgroupId },
    select: { id: true, leaderId: true },
  });
  if (!subgroup) redirect("/admin?subgroup=not-found#subgroups");

  if (leaderId) {
    const membership = await db.userSubgroup.findUnique({
      where: {
        userId_subgroupId: { userId: leaderId, subgroupId },
      },
      include: { user: { select: { role: true, isActive: true } } },
    });
    if (
      !membership ||
      !membership.user.isActive ||
      !["EXPERT", "LEAD"].includes(membership.user.role)
    ) {
      redirect("/admin?subgroup=invalid-leader#subgroups");
    }
  }

  await db.$transaction(async (tx) => {
    await tx.subgroup.update({
      where: { id: subgroup.id },
      data: { leaderId },
    });
    if (leaderId) {
      await tx.user.update({
        where: { id: leaderId },
        data: { role: "LEAD" },
      });
    }
    if (subgroup.leaderId && subgroup.leaderId !== leaderId) {
      const remainingLeaderships = await tx.subgroup.count({
        where: { leaderId: subgroup.leaderId },
      });
      if (!remainingLeaderships) {
        await tx.user.updateMany({
          where: { id: subgroup.leaderId, role: "LEAD" },
          data: { role: "EXPERT" },
        });
      }
    }
  });
  revalidatePath("/admin");
  revalidatePath("/dashboard");
  revalidatePath("/lead");
  redirect("/admin?subgroup=leader-updated#subgroups");
}

export async function deleteSubgroup(formData: FormData) {
  await requireRole("ADMIN");
  const id = String(formData.get("id") ?? "");
  const subgroup = await db.subgroup.findUnique({
    where: { id },
    select: {
      id: true,
      _count: {
        select: {
          userMemberships: {
            where: { user: { role: { in: ["EXPERT", "LEAD"] } } },
          },
          registrationMemberships: {
            where: { registrationRequest: { status: "PENDING" } },
          },
        },
      },
    },
  });
  if (!subgroup) redirect("/admin?subgroup=not-found");
  if (
    subgroup._count.userMemberships > 0 ||
    subgroup._count.registrationMemberships > 0
  ) {
    redirect("/admin?subgroup=in-use");
  }
  await db.subgroup.delete({ where: { id: subgroup.id } });
  revalidatePath("/");
  revalidatePath("/admin");
  redirect("/admin?subgroup=deleted");
}
