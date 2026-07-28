export type SubgroupMembership = {
  subgroup: { name: string };
};

export function formatSubgroups(memberships: SubgroupMembership[]) {
  return (
    memberships
      .map((membership) => membership.subgroup.name)
      .sort((left, right) => left.localeCompare(right, "ru"))
      .join(", ") || "—"
  );
}
