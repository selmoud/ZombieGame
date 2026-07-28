import { unzipSync, strFromU8 } from "fflate";
import { describe, expect, it } from "vitest";
import { createXlsx } from "../src/lib/xlsx";

describe("createXlsx", () => {
  it("creates an Office Open XML workbook with escaped values", () => {
    const archive = unzipSync(
      createXlsx([{ name: "Ответы", rows: [{ Эксперт: "Иванов & Петров" }] }]),
    );
    expect(archive["xl/workbook.xml"]).toBeDefined();
    expect(strFromU8(archive["xl/worksheets/sheet1.xml"])).toContain(
      "Иванов &amp; Петров",
    );
  });
});
