type SequencedAssignment = {
  module: { order: number };
  submission: { status: string } | null;
};

export function isModuleUnlockedFromAssignments(
  assignments: SequencedAssignment[],
  currentModuleOrder: number,
) {
  return assignments
    .filter((assignment) => assignment.module.order < currentModuleOrder)
    .every((assignment) => assignment.submission?.status === "ACCEPTED");
}
