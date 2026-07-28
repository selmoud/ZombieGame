import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { parse } from "yaml";
import { z } from "zod";

const optionSchema = z.object({
  value: z.string(),
  label: z.string(),
});

const conditionSchema = z.object({
  columnKey: z.string().min(1),
  equals: z.string(),
});

const columnSchema = z.object({
  key: z.string().min(1),
  title: z.string().min(1),
  description: z.string().optional(),
  type: z.enum([
    "short_text",
    "long_text",
    "number",
    "scale",
    "select",
    "suggest",
    "multi_suggest",
    "readonly",
    "link",
  ]),
  required: z.boolean().optional().default(false),
  options: z.array(optionSchema).optional(),
  allowCustom: z.boolean().optional(),
  defaultValue: z.string().optional(),
  excludeColumnKey: z.string().optional(),
  excludeOptionValues: z.array(z.string()).optional(),
  fullWidth: z.boolean().optional(),
  lastOptionValue: z.string().optional(),
  optionsFromColumnKey: z.string().optional(),
  requiredWhen: conditionSchema.optional(),
  sortOptions: z.boolean().optional(),
  sourceQuestionKey: z.string().optional(),
  sourceColumnKey: z.string().optional(),
  sourceLabelSuffix: z.string().optional(),
  visibleWhen: conditionSchema.optional(),
  min: z.number().optional(),
  max: z.number().optional(),
  step: z.number().positive().optional(),
});

const questionSchema = z.object({
  key: z.string().min(1),
  order: z.number().int().positive().optional(),
  type: z.enum([
    "short_text",
    "long_text",
    "number",
    "scale",
    "select",
    "multi_select",
    "table",
    "file",
    "link",
  ]),
  title: z.string().min(1),
  description: z.string().optional(),
  required: z.boolean().optional().default(false),
  config: z
    .object({
      options: z.array(optionSchema).optional(),
      min: z.number().optional(),
      max: z.number().optional(),
      minRows: z.number().int().min(0).optional(),
      maxRows: z.number().int().positive().optional(),
      addRowLabel: z.string().optional(),
      numberRows: z.boolean().optional(),
      rowLabel: z.string().optional(),
      columns: z.array(columnSchema).optional(),
    })
    .passthrough()
    .optional()
    .default({}),
});

const moduleSchema = z.object({
  slug: z.string().min(1),
  version: z.number().int().positive(),
  order: z.number().int().min(1).max(8),
  title: z.string().min(1),
  description: z.string().min(1),
  theory: z.string().min(1),
  questions: z.array(questionSchema).min(1),
});

export type ModuleDefinition = z.infer<typeof moduleSchema>;
export type QuestionDefinition = ModuleDefinition["questions"][number];
export type QuestionConfig = QuestionDefinition["config"];
export type TableColumn = NonNullable<QuestionConfig["columns"]>[number];

export async function loadModuleDefinitions(): Promise<
  Array<ModuleDefinition & { checksum: string }>
> {
  const directory = path.join(process.cwd(), "modules");
  const files = (await readdir(directory))
    .filter((file) => file.endsWith(".yaml"))
    .sort();

  const definitions = await Promise.all(
    files.map(async (file) => {
      const source = await readFile(path.join(directory, file), "utf8");
      const definition = moduleSchema.parse(parse(source));
      return {
        ...definition,
        checksum: createHash("sha256").update(source).digest("hex"),
      };
    }),
  );

  const uniqueOrders = new Set(definitions.map((item) => item.order));
  const uniqueSlugs = new Set(definitions.map((item) => item.slug));
  if (
    definitions.length !== 8 ||
    uniqueOrders.size !== 8 ||
    uniqueSlugs.size !== 8
  ) {
    throw new Error("Ожидаются восемь модулей с уникальными slug и order");
  }

  return definitions.sort((a, b) => a.order - b.order);
}

export function questionTypeToDatabase(type: QuestionDefinition["type"]) {
  return type.toUpperCase() as
    | "SHORT_TEXT"
    | "LONG_TEXT"
    | "NUMBER"
    | "SCALE"
    | "SELECT"
    | "MULTI_SELECT"
    | "TABLE"
    | "FILE"
    | "LINK";
}
