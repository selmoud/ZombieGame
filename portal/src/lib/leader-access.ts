import { db } from "@/lib/db";

export async function leadsExpertSubgroup(
  leaderId: string,
  expertId: string,
) {
  const subgroup = await db.subgroup.findFirst({
    where: {
      leaderId,
      userMemberships: {
        some: { userId: expertId },
      },
    },
    select: { id: true },
  });
  return Boolean(subgroup);
}
