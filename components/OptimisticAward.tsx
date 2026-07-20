"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Student = { id: string; displayName: string; balance: number };
type Preset = { id: string; label: string; amount: number };
type Pending = { key: string; studentIds: string[]; amount: number; reason: string; status: "syncing" | "failed" };

const CACHE = "nfc-roster-cache";
const QUEUE = "nfc-award-queue";
const VIEW = "nfc-student-view";

export function OptimisticAward({ classroomId, students: initial, presets, symbol }: { classroomId: string; students: Student[]; presets: Preset[]; symbol: string }) {
  const [students, setStudents] = useState(initial);
  const [selected, setSelected] = useState<string[]>([]);
  const [pending, setPending] = useState<Pending[]>([]);
  const [reason, setReason] = useState("");
  const [message, setMessage] = useState("");
  const [customAmount, setCustomAmount] = useState("");
  const [view, setView] = useState<"cards" | "list">("cards");

  useEffect(() => {
    const cached = localStorage.getItem(`${CACHE}-${classroomId}`);
    if (cached) setStudents(JSON.parse(cached));
    setStudents(initial);
    localStorage.setItem(`${CACHE}-${classroomId}`, JSON.stringify(initial));
    const queued = JSON.parse(localStorage.getItem(QUEUE) ?? "[]") as Pending[];
    const failed = queued.filter((item) => item.status === "failed");
    setPending(failed);
    setView(localStorage.getItem(VIEW) === "list" ? "list" : "cards");
  }, [classroomId, initial]);

  useEffect(() => {
    const markOnline = () => setMessage("Connection restored. Tap Retry all to sync waiting awards.");
    window.addEventListener("online", markOnline);
    return () => window.removeEventListener("online", markOnline);
  }, []);

  async function send(item: Pending) {
    setPending((current) => [...current.filter((row) => row.key !== item.key), { ...item, status: "syncing" }]);
    try {
      const response = await fetch("/api/transactions", { method: "POST", headers: { "Content-Type": "application/json", "Idempotency-Key": item.key }, body: JSON.stringify({ studentIds: item.studentIds, amount: item.amount, reason: item.reason }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Could not sync");
      setPending((current) => current.filter((row) => row.key !== item.key));
      localStorage.setItem(QUEUE, JSON.stringify((JSON.parse(localStorage.getItem(QUEUE) ?? "[]") as Pending[]).filter((row) => row.key !== item.key)));
      setMessage(`Synced ${item.studentIds.length} award${item.studentIds.length === 1 ? "" : "s"}.`);
    } catch (error) {
      const failed = { ...item, status: "failed" as const };
      setPending((current) => [...current.filter((row) => row.key !== item.key), failed]);
      const queue = JSON.parse(localStorage.getItem(QUEUE) ?? "[]") as Pending[];
      localStorage.setItem(QUEUE, JSON.stringify([...queue.filter((row) => row.key !== item.key), failed]));
      setMessage(error instanceof Error ? error.message : "Award waiting to retry.");
    }
  }

  function award(preset: Pick<Preset, "amount" | "label">) {
    if (!selected.length) return setMessage("Choose at least one student first.");
    const item: Pending = { key: crypto.randomUUID(), studentIds: selected, amount: preset.amount, reason: reason.trim() || preset.label, status: "syncing" };
    setStudents((current) => current.map((student) => selected.includes(student.id) ? { ...student, balance: student.balance + preset.amount } : student));
    setSelected([]); setReason(""); setMessage("Saving..."); void send(item);
  }

  function awardCustom() {
    const amount = Number(customAmount);
    if (!Number.isInteger(amount) || amount < 1 || amount > 100000) return setMessage("Enter a whole-number award amount.");
    award({ amount, label: "Custom award" });
    setCustomAmount("");
  }

  function changeView(nextView: "cards" | "list") {
    setView(nextView);
    localStorage.setItem(VIEW, nextView);
  }

  function toggleStudent(studentId: string) {
    setSelected((current) => current.includes(studentId) ? current.filter((id) => id !== studentId) : [...current, studentId]);
  }

  return <div className="grid gap-5">
    {pending.length > 0 && <div className="sticky top-24 z-20 flex items-center justify-between rounded-xl bg-amber-200 p-3 font-bold"><span>{pending.length} action{pending.length === 1 ? "" : "s"} not synced</span><button className="btn" onClick={() => pending.forEach((item) => void send(item))}>Retry all</button></div>}
    <div className="sticky top-20 z-10 panel grid gap-3 p-4 md:grid-cols-[1fr_auto]">
      <input className="field" value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Optional reason" />
      <div className="flex gap-2 overflow-x-auto">{presets.map((preset) => <button className="btn btn-accent whitespace-nowrap" onClick={() => award(preset)} key={preset.id}>+{preset.amount} {preset.label}</button>)}</div>
      <div className="flex gap-2"><input className="field max-w-44" type="number" inputMode="numeric" min="1" step="1" max="100000" value={customAmount} onChange={(event) => setCustomAmount(event.target.value)} onKeyDown={(event) => event.key === "Enter" && awardCustom()} placeholder="Custom amount" aria-label="Custom award amount" /><button className="btn" onClick={awardCustom}>Award custom</button></div>
      <div className="flex justify-end gap-2" aria-label="Student view"><button className={`btn ${view === "cards" ? "btn-accent" : "btn-soft"}`} aria-pressed={view === "cards"} onClick={() => changeView("cards")}>Cards</button><button className={`btn ${view === "list" ? "btn-accent" : "btn-soft"}`} aria-pressed={view === "list"} onClick={() => changeView("list")}>List</button></div>
      <p className="text-sm text-slate-600 md:col-span-2">{selected.length} selected · {message || "Choose students, then tap an award."}</p>
    </div>
    {view === "cards" ? <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">{students.map((student) => <div className={`panel p-4 transition ${selected.includes(student.id) ? "border-[#e85d43] bg-[#fff0e8] ring-2 ring-[#e85d43]" : ""}`} key={student.id}><button aria-pressed={selected.includes(student.id)} onClick={() => toggleStudent(student.id)} className="min-h-20 w-full text-left"><span className="block font-bold">{student.displayName}</span><span className="display mt-4 block text-3xl">{symbol}{student.balance}</span></button><Link href={`/app/student/${student.id}`} className="mt-2 inline-block text-xs underline">Details</Link></div>)}</div> : <div className="panel overflow-hidden">{students.map((student) => <div className={`grid grid-cols-[1fr_auto_auto] items-center gap-3 border-b border-black/10 p-3 last:border-0 ${selected.includes(student.id) ? "bg-[#fff0e8]" : ""}`} key={student.id}><button aria-pressed={selected.includes(student.id)} onClick={() => toggleStudent(student.id)} className="min-h-12 text-left font-bold"><span className={`mr-3 inline-block h-6 w-6 rounded-md border align-middle ${selected.includes(student.id) ? "border-[#e85d43] bg-[#e85d43]" : "border-black/30"}`} />{student.displayName}</button><span className="display text-2xl">{symbol}{student.balance}</span><Link href={`/app/student/${student.id}`} className="btn btn-soft">Details</Link></div>)}</div>}
    {!students.length && <div className="panel p-8 text-center">No active students yet. Add your roster to start awarding.</div>}
  </div>;
}
