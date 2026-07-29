type SequencedAssignment = {
  module: { order: number };
  submission: { status: string } | null;
};

export function isModuleUnlockedFromAssignments(
  assignments: SequencedAssignment[],
  currentModuleOrder: number,
  unlockAllModules = false,
) {
  if (unlockAllModules) return true;
  if (currentModuleOrder <= 1) return true;
  const previousByOrder = new Map(
    assignments
      .filter((assignment) => assignment.module.order < currentModuleOrder)
      .map((assignment) => [assignment.module.order, assignment]),
  );
  return Array.from(
    { length: currentModuleOrder - 1 },
    (_, index) => index + 1,
  ).every(
    (order) =>
      previousByOrder.get(order)?.submission?.status === "ACCEPTED",
  );
}
