type AssignmentProgress = {
  submission: { status: string } | null;
};

export function acceptedModuleProgress(assignments: AssignmentProgress[]) {
  const accepted = assignments.filter(
    (assignment) => assignment.submission?.status === "ACCEPTED",
  ).length;
  return {
    accepted,
    total: assignments.length,
    percent: assignments.length
      ? Math.round((accepted / assignments.length) * 100)
      : 0,
  };
}
