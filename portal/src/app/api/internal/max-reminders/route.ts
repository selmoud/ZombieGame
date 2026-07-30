import { timingSafeEqual } from "node:crypto";
import { queueScheduledMaxReminders } from "@/lib/max-reminders";

export const runtime = "nodejs";

function authorized(request: Request) {
  const expected = process.env.MAX_WORKER_SECRET;
  const candidate = request.headers.get("authorization");
  const prefix = "Bearer ";
  if (!expected || !candidate?.startsWith(prefix)) return false;
  const left = Buffer.from(candidate.slice(prefix.length));
  const right = Buffer.from(expected);
  return left.length === right.length && timingSafeEqual(left, right);
}

export async function POST(request: Request) {
  if (!authorized(request)) {
    return Response.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }
  return Response.json(await queueScheduledMaxReminders());
}
