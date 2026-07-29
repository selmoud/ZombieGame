import path from "node:path";

const allowedFiles = {
  "application/pdf": {
    extensions: new Set([".pdf"]),
    signature: (bytes: Buffer) => bytes.subarray(0, 5).equals(Buffer.from("%PDF-")),
  },
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": {
    extensions: new Set([".docx"]),
    signature: (bytes: Buffer) =>
      isZip(bytes) &&
      bytes.includes(Buffer.from("[Content_Types].xml")) &&
      bytes.includes(Buffer.from("word/document.xml")),
  },
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": {
    extensions: new Set([".xlsx"]),
    signature: (bytes: Buffer) =>
      isZip(bytes) &&
      bytes.includes(Buffer.from("[Content_Types].xml")) &&
      bytes.includes(Buffer.from("xl/workbook.xml")),
  },
  "image/png": {
    extensions: new Set([".png"]),
    signature: (bytes: Buffer) =>
      bytes
        .subarray(0, 8)
        .equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
  },
  "image/jpeg": {
    extensions: new Set([".jpg", ".jpeg"]),
    signature: (bytes: Buffer) =>
      bytes.length >= 3 &&
      bytes[0] === 0xff &&
      bytes[1] === 0xd8 &&
      bytes[2] === 0xff,
  },
} satisfies Record<
  string,
  { extensions: Set<string>; signature: (bytes: Buffer) => boolean }
>;

function isZip(bytes: Buffer) {
  return (
    bytes.length >= 4 &&
    bytes[0] === 0x50 &&
    bytes[1] === 0x4b &&
    ((bytes[2] === 0x03 && bytes[3] === 0x04) ||
      (bytes[2] === 0x05 && bytes[3] === 0x06) ||
      (bytes[2] === 0x07 && bytes[3] === 0x08))
  );
}

export function sanitizeUploadName(value: string) {
  const baseName = value.replace(/\\/g, "/").split("/").pop() ?? "";
  return baseName
    .replace(/[\u0000-\u001f\u007f\u202a-\u202e\u2066-\u2069]/g, "")
    .trim()
    .slice(0, 180);
}

export function validateUpload(
  originalName: string,
  mimeType: string,
  bytes: Buffer,
) {
  const name = sanitizeUploadName(originalName);
  const definition = allowedFiles[mimeType as keyof typeof allowedFiles];
  const extension = path.extname(name).toLocaleLowerCase("en");
  if (
    !name ||
    !definition ||
    !definition.extensions.has(extension) ||
    !definition.signature(bytes)
  ) {
    return { allowed: false as const };
  }
  return { allowed: true as const, name, mimeType };
}

export function isAllowedUploadMimeType(value: string) {
  return value in allowedFiles;
}
