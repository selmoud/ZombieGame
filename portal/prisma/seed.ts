import "dotenv/config";
import { createHmac } from "node:crypto";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { loadModuleDefinitions, questionTypeToDatabase } from "../src/lib/modules";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is required");

const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});

function tokenHash(token: string) {
  const pepper = process.env.INVITATION_TOKEN_PEPPER;
  if (!pepper) throw new Error("INVITATION_TOKEN_PEPPER is required");
  return createHmac("sha256", pepper).update(token).digest("hex");
}

async function main() {
  const company = await db.company.upsert({
    where: { name: "АО «Медиаплатформа»" },
    update: {},
    create: { name: "АО «Медиаплатформа»" },
  });
  const subgroup = await db.subgroup.upsert({
    where: { name: "Медиа и контент" },
    update: {},
    create: { name: "Медиа и контент" },
  });

  const admin = await db.user.upsert({
    where: { id: "00000000-0000-4000-8000-000000000001" },
    update: { isActive: false },
    create: {
      id: "00000000-0000-4000-8000-000000000001",
      fullName: "Анна Смирнова",
      position: "Администратор рабочей группы",
      role: "ADMIN",
      isActive: false,
      companyId: company.id,
      subgroupId: subgroup.id,
    },
  });
  const expert = await db.user.upsert({
    where: { id: "00000000-0000-4000-8000-000000000002" },
    update: { isActive: false },
    create: {
      id: "00000000-0000-4000-8000-000000000002",
      fullName: "Алексей Волков",
      position: "Директор по цифровым продуктам",
      direction: "Медиа и контент",
      role: "EXPERT",
      isActive: false,
      companyId: company.id,
      subgroupId: subgroup.id,
    },
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
    await db.question.deleteMany({ where: { moduleVersionId: version.id } });
    await db.question.createMany({
      data: definition.questions.map((question, index) => ({
        moduleVersionId: version.id,
        key: question.key,
        type: questionTypeToDatabase(question.type),
        title: question.title,
        description: question.description,
        required: question.required,
        order: index + 1,
        config: question.config,
      })),
    });
    const assignment = await db.moduleAssignment.upsert({
      where: { userId_moduleId: { userId: expert.id, moduleId: moduleRecord.id } },
      update: { moduleVersionId: version.id },
      create: {
        userId: expert.id,
        moduleId: moduleRecord.id,
        moduleVersionId: version.id,
        assignedById: admin.id,
      },
    });
    await db.submission.upsert({
      where: { assignmentId: assignment.id },
      update: {},
      create: { assignmentId: assignment.id },
    });
  }

  for (const [user, rawToken] of [
    [admin, "demo-admin"],
    [expert, "demo-expert"],
  ] as const) {
    await db.invitationToken.upsert({
      where: { tokenHash: tokenHash(rawToken) },
      update: {
        userId: user.id,
        usedAt: null,
        revokedAt: null,
        expiresAt: new Date("2036-12-31T23:59:59Z"),
      },
      create: {
        userId: user.id,
        tokenHash: tokenHash(rawToken),
        expiresAt: new Date("2036-12-31T23:59:59Z"),
        createdById: admin.id,
      },
    });
  }

  console.log("Seed complete");
  console.log("Expert: http://localhost:3000/invite/demo-expert");
  console.log("Admin:  http://localhost:3000/invite/demo-admin");
}

main()
  .finally(() => db.$disconnect())
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
