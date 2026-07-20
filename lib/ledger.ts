import { Prisma, TransactionKind } from "@prisma/client";
import { db } from "@/lib/db";

export class ServiceError extends Error {}

export async function balance(studentId: string, client: Prisma.TransactionClient | typeof db = db) {
  const result = await client.transaction.aggregate({ where: { studentId }, _sum: { amount: true } });
  return result._sum.amount ?? 0;
}

type Entry = {
  teacherId: string;
  studentId: string;
  amount: number;
  reason: string;
  kind: TransactionKind;
  idempotencyKey: string;
};

export async function postEntry(input: Entry) {
  if (!Number.isInteger(input.amount) || input.amount === 0) throw new ServiceError("Amount must be a non-zero whole number.");
  const prior = await db.transaction.findUnique({
    where: { createdByTeacherId_idempotencyKey: { createdByTeacherId: input.teacherId, idempotencyKey: input.idempotencyKey } },
  });
  if (prior) return prior;
  return db.$transaction(async (tx) => {
    const student = await tx.student.findFirst({
      where: { id: input.studentId, teacherId: input.teacherId, active: true },
    });
    if (!student?.classroomId) throw new ServiceError("Student not found.");
    const classroom = await tx.classroom.findFirst({
      where: { id: student.classroomId, teacherId: input.teacherId, archived: false },
    });
    if (!classroom) throw new ServiceError("This classroom is archived or unavailable.");
    const current = await balance(student.id, tx);
    if (current + input.amount < 0) {
      throw new ServiceError(`Not enough ${classroom.currencyName}. Short by ${Math.abs(current + input.amount)}.`);
    }
    return tx.transaction.create({
      data: {
        studentId: student.id,
        classroomId: classroom.id,
        amount: input.amount,
        reason: input.reason.trim(),
        kind: input.kind,
        createdByTeacherId: input.teacherId,
        idempotencyKey: input.idempotencyKey,
      },
    });
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export async function undoEntry(teacherId: string, transactionId: string, idempotencyKey: string) {
  return db.$transaction(async (tx) => {
    const original = await tx.transaction.findFirst({
      where: { id: transactionId, createdByTeacherId: teacherId, correctedBy: null },
    });
    if (!original) throw new ServiceError("That action cannot be undone.");
    const current = await balance(original.studentId, tx);
    if (current - original.amount < 0) throw new ServiceError("Undo would make the balance negative.");
    return tx.transaction.create({
      data: {
        studentId: original.studentId,
        classroomId: original.classroomId,
        amount: -original.amount,
        reason: `Undo: ${original.reason}`,
        kind: "CORRECTION",
        voidedById: original.id,
        createdByTeacherId: teacherId,
        idempotencyKey,
      },
    });
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export async function checkout(input: {
  teacherId: string; studentId: string; items: Array<{ id: string; quantity: number }>; idempotencyKey: string;
}) {
  const prior = await db.transaction.findUnique({
    where: { createdByTeacherId_idempotencyKey: { createdByTeacherId: input.teacherId, idempotencyKey: input.idempotencyKey } },
  });
  if (prior) return prior;
  return db.$transaction(async (tx) => {
    const student = await tx.student.findFirst({ where: { id: input.studentId, teacherId: input.teacherId, active: true } });
    if (!student?.classroomId) throw new ServiceError("Student not found.");
    const requested = input.items.filter((item) => Number.isInteger(item.quantity) && item.quantity > 0);
    if (!requested.length) throw new ServiceError("Choose at least one item.");
    const items = await tx.storeItem.findMany({
      where: { id: { in: requested.map((item) => item.id) }, classroomId: student.classroomId, active: true },
    });
    if (items.length !== requested.length) throw new ServiceError("One of those items is unavailable.");
    const lines = requested.map((request) => {
      const item = items.find((candidate) => candidate.id === request.id)!;
      if (item.stock !== null && item.stock < request.quantity) throw new ServiceError(`${item.name} does not have enough stock.`);
      return { item, quantity: request.quantity };
    });
    const total = lines.reduce((sum, line) => sum + line.item.price * line.quantity, 0);
    const current = await balance(student.id, tx);
    if (current < total) throw new ServiceError(`Not enough balance. Short by ${total - current}.`);
    for (const line of lines) {
      if (line.item.stock !== null) await tx.storeItem.update({ where: { id: line.item.id }, data: { stock: { decrement: line.quantity } } });
    }
    return tx.transaction.create({
      data: {
        studentId: student.id, classroomId: student.classroomId, amount: -total,
        reason: `Store purchase: ${lines.map((line) => `${line.quantity} x ${line.item.name}`).join(", ")}`,
        kind: "PURCHASE", createdByTeacherId: input.teacherId, idempotencyKey: input.idempotencyKey,
        purchaseLines: { create: lines.map((line) => ({ storeItemId: line.item.id, itemName: line.item.name, unitPrice: line.item.price, quantity: line.quantity })) },
      },
    });
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}
