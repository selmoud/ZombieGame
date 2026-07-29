import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { createGroupSummaryPdf } from "@/lib/group-summary-pdf";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user || (user.role !== "ADMIN" && user.role !== "LEAD")) {
    return Response.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const url = new URL(request.url);
  const subgroupId = url.searchParams.get("subgroup");
  const wantsAll = url.searchParams.get("scope") === "all";
  let subgroup: { id: string; name: string } | null = null;

  if (wantsAll) {
    if (user.role !== "ADMIN") {
      return Response.json({ error: "FORBIDDEN" }, { status: 403 });
    }
  } else {
    if (!subgroupId) {
      return Response.json({ error: "SUBGROUP_REQUIRED" }, { status: 400 });
    }
    subgroup = await db.subgroup.findFirst({
      where: {
        id: subgroupId,
        ...(user.role === "LEAD" ? { leaderId: user.id } : {}),
      },
      select: { id: true, name: true },
    });
    if (!subgroup) {
      return Response.json({ error: "NOT_FOUND" }, { status: 404 });
    }
  }

  const subgroupFilter = subgroup
    ? {
        user: {
          subgroupMemberships: {
            some: { subgroupId: subgroup.id },
          },
        },
      }
    : {};
  const [submissions, moduleCount, memberCount, economicData] =
    await Promise.all([
      db.submission.findMany({
        where: {
          status: "ACCEPTED",
          assignment: subgroupFilter,
        },
        include: {
          assignment: {
            include: {
              module: true,
              user: { select: { id: true, fullName: true } },
            },
          },
          answers: {
            include: {
              question: { select: { key: true } },
            },
          },
        },
      }),
      db.module.count({ where: { isActive: true } }),
      subgroup
        ? db.userSubgroup.count({
            where: {
              subgroupId: subgroup.id,
              user: {
                role: { in: ["EXPERT", "LEAD"] },
                isActive: true,
              },
            },
          })
        : db.user.count({
            where: {
              role: { in: ["EXPERT", "LEAD"] },
              isActive: true,
              subgroupMemberships: { some: {} },
            },
          }),
      db.ministryEconomicData.findUnique({
        where: { industry: "Коммуникации, медиа и развлечения" },
      }),
    ]);

  const pdf = await createGroupSummaryPdf({
    scopeTitle: subgroup?.name ?? "Все подгруппы",
    scopeKind: subgroup ? "subgroup" : "all",
    generatedBy: user.fullName,
    memberCount,
    moduleCount,
    submissions,
    economicData,
  });
  const fileName = subgroup
    ? `subgroup-summary-${new Date().toISOString().slice(0, 10)}.pdf`
    : `all-groups-summary-${new Date().toISOString().slice(0, 10)}.pdf`;
  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${fileName}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
