import { db } from "@/lib/db";
import { isModuleUnlockedFromAssignments } from "@/lib/module-access";

export async function isModuleUnlocked(
  userId: string,
  currentModuleOrder: number,
) {
  const [user, previousAssignments] = await Promise.all([
    db.user.findUnique({
      where: { id: userId },
      select: { unlockAllModules: true },
    }),
    db.moduleAssignment.findMany({
      where: {
        userId,
        module: { order: { lt: currentModuleOrder } },
      },
      select: {
        module: { select: { order: true } },
        submission: { select: { status: true } },
      },
    }),
  ]);
  return isModuleUnlockedFromAssignments(
    previousAssignments,
    currentModuleOrder,
    user?.unlockAllModules ?? false,
  );
}
