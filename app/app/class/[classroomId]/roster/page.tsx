"use client";

import { use, useState } from "react";
import Link from "next/link";
import { pb, readableError, type AwardPreset, type Card, type CardAssignment, type Classroom, type Student, type Transaction } from "@/lib/pocketbase";
import { useLoader, useTeacher } from "@/lib/session";
import { fetchBalances, removeStudents, resetAssignments } from "@/lib/api";
import { CsvNames } from "@/components/CsvNames";
import { DeleteClassroomButton } from "@/components/DeleteClassroomButton";

type Row = Student & { balance: number; cardLabel: string | null };

export default function Roster({ params }: { params: Promise<{ classroomId: string }> }) {
  const { classroomId } = use(params);
  const teacher = useTeacher();
  const [sort, setSort] = useState<"name" | "balance">("name");
  const [selected, setSelected] = useState<string[]>([]);
  const [message, setMessage] = useState("");

  const { data, error, reload } = useLoader(async () => {
    if (!teacher) return null;
    const classroom = await pb.collection("classrooms").getOne<Classroom>(classroomId);
    const [students, destinations, presets, balances, assignments] = await Promise.all([
      pb.collection("students").getFullList<Student>({ filter: `classroom = "${classroomId}"` }),
      pb.collection("classrooms").getFullList<Classroom>({ filter: `archived = false && id != "${classroomId}"`, sort: "name" }),
      pb.collection("award_presets").getFullList<AwardPreset>({ filter: `classroom = "${classroomId}"`, sort: "sortOrder" }),
      fetchBalances(classroomId),
      pb.collection("card_assignments").getFullList<CardAssignment & { expand?: { card?: Card } }>({
        filter: `student.classroom = "${classroomId}" && endedAt = null`, expand: "card",
      }),
    ]);
    const cardByStudent = new Map(assignments.map((row) => [row.student, row.expand?.card?.label ?? null]));
    const rows: Row[] = students.map((student) => ({
      ...student, balance: balances.balances[student.id] ?? 0, cardLabel: cardByStudent.get(student.id) ?? null,
    }));
    return { classroom, destinations, presets, rows };
  }, [teacher?.id, classroomId]);

  async function guard(work: () => Promise<void>, done: string) {
    try {
      await work();
      setMessage(done);
      setSelected([]);
      reload();
    } catch (problem) {
      setMessage(readableError(problem));
    }
  }

  async function addStudents(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const names = String(new FormData(form).get("names")).split(/[,\r\n]+/).map((name) => name.trim()).filter(Boolean).slice(0, 200);
    if (!names.length) return setMessage("Add at least one name.");
    await guard(async () => {
      for (const displayName of names) {
        await pb.collection("students").create({ teacher: teacher!.id, classroom: classroomId, displayName, active: true });
      }
      form.reset();
    }, `Added ${names.length} student${names.length === 1 ? "" : "s"}.`);
  }

  async function moveSelected(destinationId: string) {
    if (!destinationId) return setMessage("Choose a destination class.");
    if (!selected.length) return setMessage("Select at least one student.");
    await guard(async () => {
      for (const studentId of selected) await pb.collection("students").update(studentId, { classroom: destinationId });
    }, "Students moved.");
  }

  async function removeSelected() {
    if (!selected.length) return setMessage("Select at least one student.");
    await guard(() => removeStudents(classroomId, selected).then(() => undefined), "Students removed from this class.");
  }

  async function saveClassroom(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await guard(async () => {
      await pb.collection("classrooms").update(classroomId, {
        name: String(form.get("name")).trim(),
        schoolYear: String(form.get("schoolYear")).trim(),
        currencyName: String(form.get("currencyName")).trim(),
        currencySymbol: String(form.get("currencySymbol")).trim().slice(0, 4) || "$",
      });
    }, "Classroom settings saved.");
  }

  async function savePreset(event: React.FormEvent<HTMLFormElement>, presetId?: string) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = new FormData(form);
    const payload = { label: String(values.get("label")).trim(), amount: Number(values.get("amount")) };
    await guard(async () => {
      if (presetId) await pb.collection("award_presets").update(presetId, payload);
      else await pb.collection("award_presets").create({ classroom: classroomId, ...payload, sortOrder: (data?.presets.length ?? 0) });
      form.reset();
    }, "Award preset saved.");
  }

  async function exportTransactions() {
    const entries = await pb.collection("transactions").getFullList<Transaction & { expand?: { student?: Student } }>({
      filter: `classroom = "${classroomId}"`, sort: "-created", expand: "student",
    });
    const cell = (value: string | number) => `"${String(value).replace(/"/g, '""')}"`;
    const csv = [
      ["Date", "Student", "Amount", "Kind", "Reason"].map(cell).join(","),
      ...entries.map((entry) => [
        new Date(entry.created).toLocaleString(), entry.expand?.student?.displayName ?? "", entry.amount, entry.kind, entry.reason,
      ].map(cell).join(",")),
    ].join("\n");
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    link.download = `transactions-${data?.classroom.name ?? "class"}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  }

  if (!teacher) return null;
  if (error) return <p className="panel p-8">{error}</p>;
  if (!data) return <p className="panel p-8">Loading your roster...</p>;
  const { classroom, destinations, presets } = data;
  const rows = [...data.rows].sort(sort === "balance" ? (a, b) => b.balance - a.balance : (a, b) => a.displayName.localeCompare(b.displayName));

  return <div className="grid gap-6">
    <div><p className="font-bold text-[#e85d43]">{classroom.name}</p><h1 className="text-4xl">Roster</h1></div>
    {message && <p className="rounded-xl bg-[#cde7d8] p-4 font-bold text-green-900" role="status">{message}</p>}
    <div className="grid grid-cols-2 gap-2 sm:flex"><button className="btn btn-soft" onClick={() => setSort("name")}>Sort A-Z</button><button className="btn btn-soft" onClick={() => setSort("balance")}>Sort by balance</button><button className="btn col-span-2" onClick={() => void exportTransactions()}>Export transactions</button><DeleteClassroomButton classroomId={classroomId} classroomName={classroom.name} /></div>
    {!classroom.archived && <details className="panel p-5"><summary className="font-bold">Bulk add students</summary><form onSubmit={(event) => void addStudents(event)} className="mt-4 grid gap-3"><label className="label">Student names<textarea className="field min-h-36" name="names" placeholder="Avery Johnson, Sam Rivera, Jordan Lee" required /></label><p className="text-sm text-slate-600">Separate names with commas or put one name on each line.</p><CsvNames /><button className="btn btn-accent">Add students</button></form></details>}
    <section className="panel overflow-hidden">
      <div className="grid gap-3 border-b border-black/10 p-4 md:grid-cols-[1fr_240px_auto_auto]"><strong>{selected.length} selected</strong><select className="field" id="destination"><option value="">Destination class</option>{destinations.map((room) => <option value={room.id} key={room.id}>{room.name}</option>)}</select><button className="btn" onClick={() => void moveSelected((document.getElementById("destination") as HTMLSelectElement).value)}>Move selected</button><button className="btn btn-soft text-red-700" onClick={() => void removeSelected()}>Remove selected</button></div>
      {rows.map((student) => <div className="grid min-h-20 grid-cols-[28px_1fr_auto] items-center gap-3 border-b border-black/5 px-4 py-3 sm:grid-cols-[28px_1fr_auto_auto]" key={student.id}><input className="h-5 w-5" aria-label={`Select ${student.displayName}`} type="checkbox" checked={selected.includes(student.id)} onChange={(event) => setSelected((current) => event.target.checked ? [...current, student.id] : current.filter((id) => id !== student.id))} /><span><Link className="font-bold underline" href={`/app/student/${student.id}`}>{student.displayName}</Link><Link className="ml-2 text-sm underline" href={`/app/student/${student.id}`}>Edit name</Link>{!student.active && <small className="ml-2 text-red-700">Inactive</small>}<small className="mt-1 block text-slate-500 sm:hidden">{student.cardLabel ? `Card ${student.cardLabel}` : "No card"}</small></span><span className="display text-xl">{classroom.currencySymbol}{student.balance}</span><span className="hidden text-sm sm:block">{student.cardLabel ? `Card ${student.cardLabel}` : "No card"}</span></div>)}
      {!rows.length && <p className="p-8 text-center">No students are in this classroom.</p>}
    </section>
    <details className="panel p-5"><summary className="font-bold">Classroom settings</summary>
      <form onSubmit={(event) => void saveClassroom(event)} className="mt-4 grid gap-3 md:grid-cols-5"><input className="field" name="name" defaultValue={classroom.name} required /><input className="field" name="schoolYear" defaultValue={classroom.schoolYear} required /><input className="field" name="currencyName" defaultValue={classroom.currencyName} required /><input className="field" name="currencySymbol" defaultValue={classroom.currencySymbol} required /><button className="btn">Save</button></form>
      <h3 className="mt-6 text-lg">Award presets</h3>
      <div className="mt-2 grid gap-2"><div className="hidden grid-cols-[1fr_100px_auto] gap-2 px-1 text-xs font-bold uppercase tracking-wide text-slate-600 md:grid"><span>Label</span><span>Amount</span><span>Action</span></div>
        {presets.map((preset) => <form onSubmit={(event) => void savePreset(event, preset.id)} className="grid gap-2 md:grid-cols-[1fr_100px_auto]" key={preset.id}><input className="field" name="label" defaultValue={preset.label} aria-label="Preset label" /><input className="field" name="amount" type="number" min="1" defaultValue={preset.amount} aria-label="Preset amount" /><button className="btn btn-soft">Save</button></form>)}
        {!classroom.archived && <form onSubmit={(event) => void savePreset(event)} className="grid gap-2 md:grid-cols-[1fr_100px_auto]"><input className="field" name="label" placeholder="New preset" required aria-label="New preset label" /><input className="field" name="amount" type="number" min="1" placeholder="Amount" required aria-label="New preset amount" /><button className="btn">Add</button></form>}
      </div>
      <div className="mt-5 flex flex-wrap gap-3">
        <button className="btn btn-soft" onClick={() => void guard(async () => { await pb.collection("classrooms").update(classroomId, { archived: !classroom.archived, archivedAt: classroom.archived ? "" : new Date().toISOString() }); }, classroom.archived ? "Classroom restored." : "Classroom archived.")}>{classroom.archived ? "Restore classroom" : "Archive classroom"}</button>
        {!classroom.archived && <button className="btn btn-soft" onClick={() => void guard(() => resetAssignments(classroomId).then(() => undefined), "Card assignments removed.")}>Remove all card assignments</button>}
      </div>
    </details>
  </div>;
}
