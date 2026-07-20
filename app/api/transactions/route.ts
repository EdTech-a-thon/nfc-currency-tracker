import { NextResponse } from "next/server";
import { currentTeacher } from "@/lib/auth";
import { postEntry, ServiceError } from "@/lib/ledger";

export async function POST(request: Request) {
  const teacher = await currentTeacher();
  if (!teacher) return NextResponse.json({ error: "Log in again to sync." }, { status: 401 });
  try {
    const body = await request.json() as { studentIds?: string[]; amount?: number; reason?: string };
    const key = request.headers.get("Idempotency-Key");
    if (!key || !Array.isArray(body.studentIds) || !Number.isInteger(body.amount) || Number(body.amount) <= 0) return NextResponse.json({ error: "Invalid award." }, { status: 400 });
    const entries = [];
    for (const [index, studentId] of body.studentIds.slice(0, 100).entries()) entries.push(await postEntry({ teacherId: teacher.id, studentId, amount: Number(body.amount), reason: String(body.reason ?? "").trim().slice(0, 200), kind: "AWARD", idempotencyKey: `${key}-${index}` }));
    return NextResponse.json({ ok: true, entries });
  } catch (error) {
    return NextResponse.json({ error: error instanceof ServiceError ? error.message : "Could not save that award." }, { status: error instanceof ServiceError ? 400 : 500 });
  }
}
