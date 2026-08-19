"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { readableError } from "@/lib/pocketbase";
import { deleteClassroom } from "@/lib/api";

export function DeleteClassroomButton({ classroomId, classroomName }: { classroomId: string; classroomName: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function remove() {
    if (!window.confirm(`Delete ${classroomName}? This permanently removes its students and transaction history. Your shared account store will remain. This cannot be undone.`)) return;
    setBusy(true);
    try {
      await deleteClassroom(classroomId);
      router.push("/app");
    } catch (problem) {
      window.alert(readableError(problem));
      setBusy(false);
    }
  }

  return <button className="btn bg-red-700" onClick={() => void remove()} disabled={busy}>Delete class</button>;
}
