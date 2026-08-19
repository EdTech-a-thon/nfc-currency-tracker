"use client";

import { useState } from "react";
import { pb, readableError } from "@/lib/pocketbase";
import { deleteClassroom } from "@/lib/api";

export function ClassroomActions({ classroomId, classroomName, archived, onDone }: {
  classroomId: string; classroomName: string; archived: boolean; onDone: () => void;
}) {
  const [busy, setBusy] = useState(false);

  async function toggleArchived() {
    setBusy(true);
    try {
      await pb.collection("classrooms").update(classroomId, {
        archived: !archived, archivedAt: archived ? "" : new Date().toISOString(),
      });
      onDone();
    } catch (problem) {
      window.alert(readableError(problem));
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!window.confirm(`Delete ${classroomName}? This permanently removes its students and transaction history. Your shared account store will remain. This cannot be undone.`)) return;
    setBusy(true);
    try {
      await deleteClassroom(classroomId);
      onDone();
    } catch (problem) {
      window.alert(readableError(problem));
    } finally {
      setBusy(false);
    }
  }

  return <div className="flex flex-wrap gap-2">
    <button className="btn btn-soft" onClick={() => void toggleArchived()} disabled={busy}>{archived ? "Restore class" : "Archive class"}</button>
    <button className="btn bg-red-700" onClick={() => void remove()} disabled={busy}>Delete</button>
  </div>;
}
