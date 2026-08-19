"use client";

import { use, useState } from "react";
import { pb, readableError, type Card, type CardAssignment, type Classroom, type Student, type Transaction } from "@/lib/pocketbase";
import { useLoader, useTeacher } from "@/lib/session";
import { postEntry, undoEntry } from "@/lib/api";

export default function StudentDetail({ params }: { params: Promise<{ studentId: string }> }) {
  const { studentId } = use(params);
  const teacher = useTeacher();
  const [message, setMessage] = useState("");

  const { data, error, reload } = useLoader(async () => {
    if (!teacher) return null;
    const student = await pb.collection("students").getOne<Student>(studentId);
    const [classroom, transactions, assignments] = await Promise.all([
      student.classroom ? pb.collection("classrooms").getOne<Classroom>(student.classroom) : Promise.resolve(null),
      pb.collection("transactions").getFullList<Transaction>({ filter: `student = "${studentId}"`, sort: "-created" }),
      pb.collection("card_assignments").getFullList<CardAssignment & { expand?: { card?: Card } }>({
        filter: `student = "${studentId}" && endedAt = null`, expand: "card",
      }),
    ]);
    return { student, classroom, transactions, card: assignments[0]?.expand?.card ?? null };
  }, [teacher?.id, studentId]);

  async function guard(work: () => Promise<void>, done: string) {
    try {
      await work();
      setMessage(done);
      reload();
    } catch (problem) {
      setMessage(readableError(problem));
    }
  }

  async function adjust(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = new FormData(form);
    const size = Number(values.get("amount"));
    const amount = String(values.get("direction")) === "remove" ? -size : size;
    await guard(async () => {
      await postEntry({
        studentId, amount, reason: String(values.get("reason")).trim(),
        kind: "ADJUSTMENT", idempotencyKey: crypto.randomUUID(),
      });
      form.reset();
    }, "Adjustment posted.");
  }

  if (!teacher) return null;
  if (error) return <p className="panel p-8">{error}</p>;
  if (!data) return <p className="panel p-8">Loading student...</p>;
  const { student, classroom, transactions, card } = data;
  const total = transactions.reduce((sum, entry) => sum + entry.amount, 0);

  return <div className="grid gap-6">
    {message && <p className="rounded-xl bg-[#cde7d8] p-4 font-bold text-green-900" role="status">{message}</p>}
    <section className="panel overflow-hidden">
      <div className="bg-[#23312c] p-7 text-white"><p>{classroom?.name ?? "Unassigned"}</p><h1 className="mt-2 text-4xl">{student.displayName}</h1><p className="display mt-5 text-6xl text-[#f9bd72]">{classroom?.currencySymbol}{total}</p></div>
      <div className="grid gap-4 p-5 md:grid-cols-2">
        <p>Assigned card: <strong>{card ? `#${card.label} · ${card.shortCode}` : "None"}</strong></p>
        <form onSubmit={(event) => { event.preventDefault(); const name = String(new FormData(event.currentTarget).get("displayName")).trim(); void guard(() => pb.collection("students").update(studentId, { displayName: name }).then(() => undefined), "Name saved."); }} className="flex gap-2"><input className="field" name="displayName" defaultValue={student.displayName} aria-label="Student name" required /><button className="btn btn-soft">Save name</button></form>
        <button className="btn btn-soft" onClick={() => void guard(() => pb.collection("students").update(studentId, { active: !student.active }).then(() => undefined), student.active ? "Student deactivated." : "Student reactivated.")}>{student.active ? "Deactivate student" : "Reactivate student"}</button>
      </div>
    </section>
    {student.active && classroom && !classroom.archived && <form onSubmit={(event) => void adjust(event)} className="panel grid gap-3 p-5 md:grid-cols-[140px_140px_1fr_auto]"><select className="field" name="direction"><option value="add">Add</option><option value="remove">Remove</option></select><input className="field" type="number" min="1" step="1" name="amount" placeholder="Amount" required /><input className="field" name="reason" placeholder="Required reason" required /><button className="btn btn-accent">Post adjustment</button></form>}
    <section className="panel overflow-hidden">
      <h2 className="p-5 text-2xl">Transaction history</h2>
      {transactions.map((entry) => <div className="grid grid-cols-[1fr_auto] gap-3 border-t border-black/10 p-4" key={entry.id}><div>{entry.reason && <strong>{entry.reason}</strong>}<p className="text-sm text-slate-500">{entry.kind} · {new Date(entry.created).toLocaleString()}</p></div><div className="text-right"><span className={`display text-xl ${entry.amount > 0 ? "text-green-700" : "text-red-700"}`}>{entry.amount > 0 ? "+" : ""}{entry.amount}</span>{!classroom?.archived && entry.kind !== "CORRECTION" && <button className="mt-1 block text-xs underline" onClick={() => void guard(() => undoEntry(entry.id).then(() => undefined), "Entry removed.")}>Undo</button>}</div></div>)}
      {!transactions.length && <p className="p-8 text-center">No transactions yet.</p>}
    </section>
  </div>;
}
