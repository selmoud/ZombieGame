import { strToU8, zipSync } from "fflate";
import { describe, expect, it } from "vitest";
import {
  sanitizeUploadName,
  validateUpload,
} from "../src/lib/file-security";

describe("uploaded file validation", () => {
  it("checks the declared type, extension and file signature together", () => {
    const pdf = Buffer.from("%PDF-1.7\n...");
    expect(validateUpload("report.pdf", "application/pdf", pdf).allowed).toBe(
      true,
    );
    expect(validateUpload("report.jpg", "application/pdf", pdf).allowed).toBe(
      false,
    );
    expect(
      validateUpload(
        "report.pdf",
        "application/pdf",
        Buffer.from("<script>alert(1)</script>"),
      ).allowed,
    ).toBe(false);
  });

  it("distinguishes OOXML documents from arbitrary zip archives", () => {
    const docx = Buffer.from(
      zipSync({
        "[Content_Types].xml": strToU8("<Types/>"),
        "word/document.xml": strToU8("<document/>"),
      }),
    );
    expect(
      validateUpload(
        "report.docx",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        docx,
      ).allowed,
    ).toBe(true);
    expect(
      validateUpload(
        "report.xlsx",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        docx,
      ).allowed,
    ).toBe(false);
  });

  it("removes path components and control characters from file names", () => {
    expect(sanitizeUploadName("../folder/отчёт\u0000.pdf")).toBe("отчёт.pdf");
  });
});
