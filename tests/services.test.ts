import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { db } from "@/lib/db";
import { balance, postEntry, ServiceError } from "@/lib/ledger";

beforeAll(() => { execFileSync("npx", ["prisma", "db", "push", "--skip-generate", "--force-reset"], { env: process.env }); });
beforeEach(async () => { await db.teacher.deleteMany(); });

async function setup() {
  const teacher = await db.teacher.create({ data: { email: `${crypto.randomUUID()}@example.com`, passwordHash: "hash", displayName: "Teacher" } });
  const classroom = await db.classroom.create({ data: { teacherId: teacher.id, name: "Room", schoolYear: "2026" } });
  const student = await db.student.create({ data: { teacherId: teacher.id, classroomId: classroom.id, displayName: "Student" } });
  return { teacher, classroom, student };
}

describe("currency service invariants", () => {
  it("returns not found behavior for cross-teacher access", async () => {
    const first = await setup(); const second = await setup();
    await expect(postEntry({ teacherId: second.teacher.id, studentId: first.student.id, amount: 1, reason: "No", kind: "AWARD", idempotencyKey: "cross-teacher-test" })).rejects.toThrow("Student not found");
  });
  it("never allows a negative balance", async () => {
    const { teacher, student } = await setup();
    await expect(postEntry({ teacherId: teacher.id, studentId: student.id, amount: -1, reason: "Spend", kind: "DEDUCT", idempotencyKey: "negative-test" })).rejects.toBeInstanceOf(ServiceError);
  });
  it("reassignment clears the prior active student", async () => {
    const { teacher, classroom, student } = await setup(); const replacement = await db.student.create({ data: { teacherId: teacher.id, classroomId: classroom.id, displayName: "Replacement" } }); const card = await db.card.create({ data: { teacherId: teacher.id, token: crypto.randomUUID() + crypto.randomUUID(), shortCode: "7K2Q", label: "1", status: "ASSIGNED" } }); const old = await db.cardAssignment.create({ data: { cardId: card.id, studentId: student.id } }); await db.$transaction([db.cardAssignment.update({ where: { id: old.id }, data: { endedAt: new Date() } }), db.cardAssignment.create({ data: { cardId: card.id, studentId: replacement.id } })]); expect(await db.cardAssignment.count({ where: { cardId: card.id, endedAt: null } })).toBe(1); expect((await db.cardAssignment.findFirst({ where: { cardId: card.id, endedAt: null } }))?.studentId).toBe(replacement.id);
  });
  it("balance follows a student across a class transfer", async () => {
    const { teacher, student } = await setup(); await postEntry({ teacherId: teacher.id, studentId: student.id, amount: 7, reason: "Earned", kind: "AWARD", idempotencyKey: "transfer-test" }); const next = await db.classroom.create({ data: { teacherId: teacher.id, name: "Next", schoolYear: "2026" } }); await db.student.update({ where: { id: student.id }, data: { classroomId: next.id } }); expect(await balance(student.id)).toBe(7);
  });
});
