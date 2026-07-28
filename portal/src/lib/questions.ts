export function isQuestionHidden(config: unknown) {
  return (
    typeof config === "object" &&
    config !== null &&
    !Array.isArray(config) &&
    (config as { hidden?: unknown }).hidden === true
  );
}
