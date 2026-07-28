export type FieldCondition = {
  columnKey: string;
  equals?: string;
  includes?: string;
};

export function matchesFieldCondition(
  row: Record<string, unknown>,
  condition?: FieldCondition,
) {
  if (!condition) return true;
  const value = row[condition.columnKey];
  if (condition.equals !== undefined) {
    return value === condition.equals;
  }
  if (condition.includes !== undefined) {
    return Array.isArray(value)
      ? value.map(String).includes(condition.includes)
      : false;
  }
  return false;
}
