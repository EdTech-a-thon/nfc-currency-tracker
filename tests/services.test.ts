import { beforeAll, describe, expect, it } from "vitest";
import PocketBase from "pocketbase";

// These exercise the rules through PocketBase itself rather than a stand-in, so
// they need a local instance running: npm run pb
const BASE = process.env.NEXT_PUBLIC_POCKETBASE_URL ?? "http://127.0.0.1:8092";

beforeAll(async () => {
  const health = await fetch(`${BASE}/api/health`).catch(() => null);
  if (!health?.ok) throw new Error(`No PocketBase at ${BASE}. Start one with: npm run pb`);
});

// A teacher account with its own class and one student, isolated from the rest.
async function setup() {
  const pb = new PocketBase(BASE);
  pb.autoCancellation(false);
  const email = `${crypto.randomUUID()}@example.com`;
  await pb.collection("teachers").create({
    email, password: "supersecret123", passwordConfirm: "supersecret123", displayName: "Teacher",
  });
  const auth = await pb.collection("teachers").authWithPassword(email, "supersecret123");
  const teacherId = auth.record.id;
  // Signing up creates a starting class automatically.
  const classroom = (await pb.collection("classrooms").getFullList())[0];
  const student = await pb.collection("students").create({
    teacher: teacherId, classroom: classroom.id, displayName: "Student", active: true,
  });
  return { pb, teacherId, classroom, student };
}

const award = (pb: PocketBase, studentId: string, amount: number, key: string) =>
  pb.send("/api/nfc/entry", {
    method: "POST",
    body: { studentId, amount, reason: "Earned", kind: "AWARD", idempotencyKey: key },
  });

const balance = async (pb: PocketBase, classroomId: string, studentId: string) => {
  const result = await pb.send<{ balances: Record<string, number> }>(
    `/api/nfc/balances?classroom=${classroomId}`, { method: "GET" }
  );
  return result.balances[studentId] ?? 0;
};

const addItem = (pb: PocketBase, teacherId: string, values: { name: string; price: number; stock?: number }) =>
  pb.collection("store_items").create({
    teacher: teacherId, name: values.name, price: values.price,
    trackStock: values.stock !== undefined, stock: values.stock ?? 0, active: true, sortOrder: 0,
  });

describe("currency service invariants", () => {
  it("returns not found behavior for cross-teacher access", async () => {
    const first = await setup();
    const second = await setup();
    await expect(award(second.pb, first.student.id, 1, crypto.randomUUID())).rejects.toThrow();
  });

  it("never allows a negative balance", async () => {
    const { pb, student } = await setup();
    await expect(award(pb, student.id, -1, crypto.randomUUID())).rejects.toThrow();
  });

  it("adds credit to a group of students in one request", async () => {
    const { pb, teacherId, classroom, student } = await setup();
    const classmate = await pb.collection("students").create({
      teacher: teacherId, classroom: classroom.id, displayName: "Classmate", active: true,
    });
    await pb.send("/api/nfc/awards", {
      method: "POST",
      body: { studentIds: [student.id, classmate.id], amount: 3, reason: "Great work", idempotencyKey: "group-award" },
    });
    expect(await balance(pb, classroom.id, student.id)).toBe(3);
    expect(await balance(pb, classroom.id, classmate.id)).toBe(3);
  });

  it("ignores a repeated request instead of paying twice", async () => {
    const { pb, classroom, student } = await setup();
    const key = crypto.randomUUID();
    await pb.send("/api/nfc/awards", {
      method: "POST", body: { studentIds: [student.id], amount: 4, reason: "Once", idempotencyKey: key },
    });
    const repeat = await pb.send<{ awarded: number }>("/api/nfc/awards", {
      method: "POST", body: { studentIds: [student.id], amount: 4, reason: "Once", idempotencyKey: key },
    });
    expect(repeat.awarded).toBe(0);
    expect(await balance(pb, classroom.id, student.id)).toBe(4);
  });

  it("removes an undone transaction without adding it to history", async () => {
    const { pb, classroom, student } = await setup();
    const entry = await award(pb, student.id, 5, crypto.randomUUID()) as { id: string };
    await pb.send("/api/nfc/undo", { method: "POST", body: { transactionId: entry.id } });
    expect(await balance(pb, classroom.id, student.id)).toBe(0);
    const history = await pb.collection("transactions").getFullList({ filter: `student = "${student.id}"` });
    expect(history).toHaveLength(0);
  });

  it("records each sold item and reduces its remaining stock", async () => {
    const { pb, teacherId, student } = await setup();
    const item = await addItem(pb, teacherId, { name: "Prize", price: 2, stock: 3 });
    await award(pb, student.id, 5, crypto.randomUUID());
    await pb.send("/api/nfc/checkout", {
      method: "POST", body: { studentId: student.id, items: [{ id: item.id, quantity: 1 }], idempotencyKey: crypto.randomUUID() },
    });
    expect((await pb.collection("store_items").getOne(item.id)).stock).toBe(2);
    const lines = await pb.collection("purchase_lines").getFullList({ filter: `storeItem = "${item.id}"` });
    expect(lines[0].quantity).toBe(1);
  });

  it("uses the same account store in another classroom", async () => {
    const { pb, teacherId, classroom, student } = await setup();
    const otherClassroom = await pb.collection("classrooms").create({
      teacher: teacherId, name: "Other room", schoolYear: "2026",
      currencyName: "Class Bucks", currencySymbol: "$", archived: false,
    });
    const otherStudent = await pb.collection("students").create({
      teacher: teacherId, classroom: otherClassroom.id, displayName: "Other student", active: true,
    });
    const item = await addItem(pb, teacherId, { name: "Shared prize", price: 2, stock: 2 });
    await award(pb, otherStudent.id, 3, crypto.randomUUID());
    await pb.send("/api/nfc/checkout", {
      method: "POST", body: { studentId: otherStudent.id, items: [{ id: item.id, quantity: 1 }], idempotencyKey: crypto.randomUUID() },
    });
    expect((await pb.collection("store_items").getOne(item.id)).stock).toBe(1);
    expect(await balance(pb, classroom.id, student.id)).toBe(0);
  });

  it("does not allow another account to buy an account store item", async () => {
    const first = await setup();
    const second = await setup();
    const item = await addItem(first.pb, first.teacherId, { name: "Private prize", price: 2 });
    await award(second.pb, second.student.id, 3, crypto.randomUUID());
    await expect(second.pb.send("/api/nfc/checkout", {
      method: "POST", body: { studentId: second.student.id, items: [{ id: item.id, quantity: 1 }], idempotencyKey: crypto.randomUUID() },
    })).rejects.toThrow();
  });

  it("rejects checkout when an item is sold out", async () => {
    const { pb, teacherId, classroom, student } = await setup();
    const item = await addItem(pb, teacherId, { name: "Sold out prize", price: 2, stock: 0 });
    await award(pb, student.id, 5, crypto.randomUUID());
    await expect(pb.send("/api/nfc/checkout", {
      method: "POST", body: { studentId: student.id, items: [{ id: item.id, quantity: 1 }], idempotencyKey: crypto.randomUUID() },
    })).rejects.toThrow();
    expect(await balance(pb, classroom.id, student.id)).toBe(5);
  });

  it("reassignment clears the prior active student", async () => {
    const { pb, teacherId, classroom, student } = await setup();
    const replacement = await pb.collection("students").create({
      teacher: teacherId, classroom: classroom.id, displayName: "Replacement", active: true,
    });
    await pb.send("/api/nfc/cards/generate", { method: "POST", body: { count: 1 } });
    const card = (await pb.collection("cards").getFullList())[0];
    await pb.send("/api/nfc/cards/assign", { method: "POST", body: { studentId: student.id, cardId: card.id } });
    // A card has to come back in before it can go out again, as in the app.
    await pb.send("/api/nfc/cards/unassign", { method: "POST", body: { studentId: student.id } });
    await pb.send("/api/nfc/cards/assign", { method: "POST", body: { studentId: replacement.id, cardId: card.id } });
    const open = await pb.collection("card_assignments").getFullList({ filter: `card = "${card.id}" && endedAt = null` });
    expect(open).toHaveLength(1);
    expect(open[0].student).toBe(replacement.id);
  });

  it("a permanent card URL resolves to its currently assigned student", async () => {
    const { pb, teacherId, classroom, student } = await setup();
    const replacement = await pb.collection("students").create({
      teacher: teacherId, classroom: classroom.id, displayName: "Replacement", active: true,
    });
    await pb.send("/api/nfc/cards/generate", { method: "POST", body: { count: 1 } });
    const card = (await pb.collection("cards").getFullList())[0];
    await pb.send("/api/nfc/cards/assign", { method: "POST", body: { studentId: student.id, cardId: card.id } });

    const anonymous = new PocketBase(BASE);
    const first = await anonymous.send<{ student: { id: string } }>(`/api/nfc/card/${card.token}`, { method: "GET" });
    expect(first.student.id).toBe(student.id);

    await pb.send("/api/nfc/cards/unassign", { method: "POST", body: { studentId: student.id } });
    await pb.send("/api/nfc/cards/assign", { method: "POST", body: { studentId: replacement.id, cardId: card.id } });
    const second = await anonymous.send<{ student: { id: string } }>(`/api/nfc/card/${card.token}`, { method: "GET" });
    expect(second.student.id).toBe(replacement.id);
  });

  it("does not resolve a card that is no longer assigned", async () => {
    const { pb, student } = await setup();
    await pb.send("/api/nfc/cards/generate", { method: "POST", body: { count: 1 } });
    const card = (await pb.collection("cards").getFullList())[0];
    await pb.send("/api/nfc/cards/assign", { method: "POST", body: { studentId: student.id, cardId: card.id } });
    await pb.send("/api/nfc/cards/unassign", { method: "POST", body: { studentId: student.id } });
    const anonymous = new PocketBase(BASE);
    await expect(anonymous.send(`/api/nfc/card/${card.token}`, { method: "GET" })).rejects.toThrow();
  });

  it("a card tapped by a stranger stays read-only", async () => {
    const { pb, student } = await setup();
    await pb.send("/api/nfc/cards/generate", { method: "POST", body: { count: 1 } });
    const card = (await pb.collection("cards").getFullList())[0];
    await pb.send("/api/nfc/cards/assign", { method: "POST", body: { studentId: student.id, cardId: card.id } });
    const anonymous = new PocketBase(BASE);
    const view = await anonymous.send<{ canManage: boolean; presets: unknown[] }>(
      `/api/nfc/card/${card.token}`, { method: "GET" }
    );
    expect(view.canManage).toBe(false);
    expect(view.presets).toHaveLength(0);
  });

  it("balance follows a student across a class transfer", async () => {
    const { pb, teacherId, student } = await setup();
    await award(pb, student.id, 7, crypto.randomUUID());
    const next = await pb.collection("classrooms").create({
      teacher: teacherId, name: "Next", schoolYear: "2026",
      currencyName: "Class Bucks", currencySymbol: "$", archived: false,
    });
    await pb.collection("students").update(student.id, { classroom: next.id });
    expect(await balance(pb, next.id, student.id)).toBe(7);
  });
});
