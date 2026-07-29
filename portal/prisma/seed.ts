import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, type Prisma } from "../src/generated/prisma/client";
import { loadModuleDefinitions, questionTypeToDatabase } from "../src/lib/modules";
import { hashPassword } from "../src/lib/password";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is required");

const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});

async function main() {
  await db.subgroup.upsert({
    where: { name: "Коммуникации" },
    update: {},
    create: { name: "Коммуникации" },
  });
  const vkCompany = await db.company.upsert({
    where: { name: "VK" },
    update: {},
    create: { name: "VK" },
  });

  async function ensureAdmin({
    id,
    fullName,
    passwordEnvironmentVariable,
  }: {
    id: string;
    fullName: string;
    passwordEnvironmentVariable: string;
  }) {
    const existing = await db.user.findUnique({ where: { id } });
    const commonData = {
      fullName,
      position: "Администратор рабочей группы",
      role: "ADMIN" as const,
      isActive: true,
      companyId: vkCompany.id,
    };
    if (existing) {
      return db.user.update({
        where: { id },
        data: commonData,
      });
    }
    const bootstrapPassword =
      process.env[passwordEnvironmentVariable] ?? "";
    if (bootstrapPassword.length < 16 || bootstrapPassword.length > 128) {
      throw new Error(
        `${passwordEnvironmentVariable} must contain 16–128 characters for a new installation`,
      );
    }
    return db.user.create({
      data: {
        id,
        ...commonData,
        activatedAt: new Date(),
        passwordHash: await hashPassword(bootstrapPassword),
      },
    });
  }

  await ensureAdmin({
    id: "00000000-0000-4000-8000-000000000001",
    fullName: "Тимофей Мальцев",
    passwordEnvironmentVariable: "BOOTSTRAP_ADMIN_1_PASSWORD",
  });
  await ensureAdmin({
    id: "00000000-0000-4000-8000-000000000003",
    fullName: "Киселев Виталий",
    passwordEnvironmentVariable: "BOOTSTRAP_ADMIN_2_PASSWORD",
  });
  const modules = await loadModuleDefinitions();
  for (const definition of modules) {
    const moduleRecord = await db.module.upsert({
      where: { slug: definition.slug },
      update: { title: definition.title, order: definition.order },
      create: {
        slug: definition.slug,
        order: definition.order,
        title: definition.title,
      },
    });
    const version = await db.moduleVersion.upsert({
      where: {
        moduleId_version: {
          moduleId: moduleRecord.id,
          version: definition.version,
        },
      },
      update: {
        description: definition.description,
        theoryMarkdown: definition.theory,
        sourceChecksum: definition.checksum,
        publishedAt: new Date(),
      },
      create: {
        moduleId: moduleRecord.id,
        version: definition.version,
        description: definition.description,
        theoryMarkdown: definition.theory,
        sourceChecksum: definition.checksum,
        publishedAt: new Date(),
      },
    });
    for (const [index, question] of definition.questions.entries()) {
      const data = {
        type: questionTypeToDatabase(question.type),
        title: question.title,
        description: question.description,
        required: question.required,
        order: question.order ?? index + 1,
        config: question.config as Prisma.InputJsonValue,
      };
      await db.question.upsert({
        where: {
          moduleVersionId_key: {
            moduleVersionId: version.id,
            key: question.key,
          },
        },
        update: data,
        create: {
          moduleVersionId: version.id,
          key: question.key,
          ...data,
        },
      });
    }
    const activeQuestionKeys = definition.questions.map(
      (question) => question.key,
    );
    const removedQuestions = await db.question.findMany({
      where: {
        moduleVersionId: version.id,
        key: { notIn: activeQuestionKeys },
      },
    });
    for (const question of removedQuestions) {
      const currentConfig =
        typeof question.config === "object" &&
        question.config !== null &&
        !Array.isArray(question.config)
          ? question.config
          : {};
      await db.question.update({
        where: { id: question.id },
        data: {
          config: {
            ...currentConfig,
            hidden: true,
          } as Prisma.InputJsonValue,
        },
      });
    }
  }

  await db.invitationToken.updateMany({
    where: {
      user: { role: "ADMIN" },
      usedAt: null,
      revokedAt: null,
    },
    data: { revokedAt: new Date() },
  });

  console.log("Seed complete");
  console.log("Existing administrator passwords were preserved");
}

main()
  .finally(() => db.$disconnect())
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
