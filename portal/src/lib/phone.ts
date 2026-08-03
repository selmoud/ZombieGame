export function normalizePhoneNumber(value: FormDataEntryValue | null) {
  const compact = String(value ?? "")
    .trim()
    .replace(/[\s()-]/g, "");
  if (!/^(?:\+7|7|8)\d{10}$/.test(compact)) return null;
  const nationalNumber = compact.startsWith("+7")
    ? compact.slice(2)
    : compact.slice(1);
  return `+7${nationalNumber}`;
}
