import PocketBase from "pocketbase";

// One client for the whole app. The browser talks to PocketBase directly, so
// this is the only place the address of the backend is spelled out.
export const pb = new PocketBase(process.env.NEXT_PUBLIC_POCKETBASE_URL ?? "http://127.0.0.1:8092");

// Every screen is drawn in the browser, so cancel-on-duplicate would abort
// the earlier of two lists loaded side by side.
pb.autoCancellation(false);

export type CardStatus = "AVAILABLE" | "ASSIGNED" | "LOST" | "RETIRED";
export type TransactionKind = "AWARD" | "DEDUCT" | "PURCHASE" | "ADJUSTMENT" | "CORRECTION";

export type Teacher = { id: string; email: string; displayName: string };

export type Classroom = {
  id: string;
  teacher: string;
  name: string;
  schoolYear: string;
  currencyName: string;
  currencySymbol: string;
  archived: boolean;
  archivedAt: string;
  created: string;
};

export type Student = {
  id: string;
  teacher: string;
  classroom: string;
  displayName: string;
  active: boolean;
  created: string;
};

export type Card = {
  id: string;
  teacher: string;
  token: string;
  shortCode: string;
  label: string;
  status: CardStatus;
  created: string;
};

export type CardAssignment = {
  id: string;
  card: string;
  student: string;
  assignedAt: string;
  endedAt: string;
};

export type StoreItem = {
  id: string;
  teacher: string;
  name: string;
  price: number;
  trackStock: boolean;
  stock: number;
  active: boolean;
  sortOrder: number;
};

export type Transaction = {
  id: string;
  student: string;
  classroom: string;
  amount: number;
  reason: string;
  kind: TransactionKind;
  storeItem: string;
  createdBy: string;
  idempotencyKey: string;
  created: string;
};

export type AwardPreset = {
  id: string;
  classroom: string;
  label: string;
  amount: number;
  sortOrder: number;
};

export function currentTeacher(): Teacher | null {
  if (!pb.authStore.isValid) return null;
  const record = pb.authStore.record;
  if (!record) return null;
  return { id: record.id, email: record.email, displayName: record.displayName };
}

// PocketBase reports rule and hook failures with its own shape; this pulls out
// the sentence worth showing a teacher.
export function readableError(error: unknown, fallback = "Something went wrong. Please try again.") {
  if (error && typeof error === "object") {
    const response = (error as { response?: { message?: string; data?: Record<string, { message?: string }> } }).response;
    const fieldMessage = response?.data && Object.values(response.data).find((field) => field?.message)?.message;
    if (fieldMessage) return fieldMessage;
    if (response?.message) return response.message;
    if (error instanceof Error && error.message) return error.message;
  }
  return fallback;
}
