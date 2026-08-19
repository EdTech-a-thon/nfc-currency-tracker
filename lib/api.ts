import { pb } from "@/lib/pocketbase";
import type { AwardPreset, CardStatus } from "@/lib/pocketbase";

// Calls to the PocketBase hook routes. Anything that weighs a balance or
// touches several records at once goes through one of these rather than
// writing to a collection from the browser.

export type TapView = {
  card: { id: string; label: string; shortCode: string };
  student: { id: string; displayName: string };
  classroom: { id: string; name: string; currencyName: string; currencySymbol: string };
  balance: number;
  transactions: Array<{ id: string; reason: string; amount: number; created: string }>;
  store: Array<{ id: string; name: string; price: number }>;
  canManage: boolean;
  presets: AwardPreset[];
};

export function cardUrl(token: string) {
  const base = process.env.NEXT_PUBLIC_CARD_BASE_URL ?? "https://nfc-currency-tracker.edtechathon.com";
  return `${base.replace(/\/$/, "")}/c/${token}`;
}

export function awardMany(input: { studentIds: string[]; amount: number; reason: string; idempotencyKey: string }) {
  return pb.send<{ awarded: number; transactionIds: string[] }>("/api/nfc/awards", { method: "POST", body: input });
}

export function postEntry(input: {
  studentId: string; amount: number; reason: string;
  kind: "AWARD" | "DEDUCT" | "ADJUSTMENT" | "CORRECTION"; idempotencyKey: string;
}) {
  return pb.send<{ id: string; repeated: boolean }>("/api/nfc/entry", { method: "POST", body: input });
}

export function undoEntry(transactionId: string) {
  return pb.send<null>("/api/nfc/undo", { method: "POST", body: { transactionId } });
}

export function checkout(input: {
  studentId: string; items: Array<{ id: string; quantity: number }>; idempotencyKey: string;
}) {
  return pb.send<{ id: string; repeated: boolean }>("/api/nfc/checkout", { method: "POST", body: input });
}

export function fetchBalances(classroomId: string) {
  return pb.send<{ balances: Record<string, number> }>(
    `/api/nfc/balances?classroom=${encodeURIComponent(classroomId)}`, { method: "GET" }
  );
}

export function tapCard(identifier: string) {
  return pb.send<TapView>(`/api/nfc/card/${encodeURIComponent(identifier)}`, { method: "GET" });
}

export function generateCards(count: number) {
  return pb.send<{ created: number }>("/api/nfc/cards/generate", { method: "POST", body: { count } });
}

export function assignCard(studentId: string, cardId: string) {
  return pb.send<null>("/api/nfc/cards/assign", { method: "POST", body: { studentId, cardId } });
}

export function unassignCard(studentId: string) {
  return pb.send<null>("/api/nfc/cards/unassign", { method: "POST", body: { studentId } });
}

export function autoAssignCards(classroomId: string) {
  return pb.send<{ paired: number }>("/api/nfc/cards/auto-assign", { method: "POST", body: { classroomId } });
}

export function resetAssignments(classroomId: string) {
  return pb.send<{ released: number }>("/api/nfc/cards/reset", { method: "POST", body: { classroomId } });
}

export function setCardStatus(cardIds: string[], status: CardStatus) {
  return pb.send<null>("/api/nfc/cards/status", { method: "POST", body: { cardIds, status } });
}

export function removeStudents(classroomId: string, studentIds: string[]) {
  return pb.send<null>("/api/nfc/students/remove", { method: "POST", body: { classroomId, studentIds } });
}

export function deleteClassroom(classroomId: string) {
  return pb.send<null>("/api/nfc/classrooms/delete", { method: "POST", body: { classroomId } });
}

export function archiveYear(schoolYear: string) {
  return pb.send<{ changed: number }>("/api/nfc/years/archive", { method: "POST", body: { schoolYear } });
}

export function deleteYear(schoolYear: string, confirmation: string) {
  return pb.send<{ removed: number }>("/api/nfc/years/delete", { method: "POST", body: { schoolYear, confirmation } });
}
