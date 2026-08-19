"use client";

import { useState } from "react";
import { checkout, fetchBalances } from "@/lib/api";
import { pb, readableError, type StoreItem } from "@/lib/pocketbase";

type Item = StoreItem;
type Student = { id: string; name: string; balance: number };

export function StoreItems({ items: initialItems, students, initialStudentId, symbol, classroomId }: { items: Item[]; students: Student[]; initialStudentId?: string; symbol: string; classroomId: string }) {
  const [items, setItems] = useState(initialItems);
  const [selected, setSelected] = useState<string[]>([]);
  const [studentId, setStudentId] = useState(initialStudentId ?? "");
  const [studentBalances, setStudentBalances] = useState(() => new Map(students.map((student) => [student.id, student.balance])));
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const total = items.reduce((sum, item) => sum + (selected.includes(item.id) ? item.price : 0), 0);
  const balance = studentBalances.get(studentId);

  async function completePurchase() {
    if (!studentId || !selected.length || saving) return;
    setSaving(true);
    setMessage("");
    try {
      await checkout({
        studentId,
        items: selected.map((id) => ({ id, quantity: 1 })),
        idempotencyKey: crypto.randomUUID(),
      });
      // Read the figures back rather than guessing them, so stock and balance
      // match what the ledger actually recorded.
      const [fresh, balances] = await Promise.all([
        pb.collection("store_items").getFullList<Item>({ filter: "active = true", sort: "sortOrder,name" }),
        fetchBalances(classroomId),
      ]);
      setItems(fresh);
      setStudentBalances(new Map(Object.entries(balances.balances)));
      setSelected([]);
      setMessage("Purchase recorded. Stock has been updated.");
    } catch (error) {
      setMessage(readableError(error, "Checkout could not be completed."));
    } finally {
      setSaving(false);
    }
  }

  return <div className="grid gap-5">
    {message && <div className={`rounded-xl p-4 font-bold ${message.startsWith("Purchase") ? "bg-[#cde7d8] text-green-900" : "bg-red-100 text-red-800"}`} role="status" aria-live="assertive">{message}</div>}
    <div className="panel p-5"><label className="label">Student<select className="field mt-1" value={studentId} onChange={(event) => setStudentId(event.target.value)} required><option value="">Choose a student</option>{students.map((student) => <option value={student.id} key={student.id}>{student.name} · {symbol}{studentBalances.get(student.id)}</option>)}</select></label></div>
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{items.map((item) => {
      const soldOut = item.trackStock && item.stock === 0;
      return <label className={`panel flex min-h-28 items-center gap-4 p-5 ${soldOut ? "cursor-not-allowed border-2 border-red-700 bg-red-50 opacity-70" : "cursor-pointer"}`} key={item.id}>
        <input className="h-6 w-6" type="checkbox" checked={selected.includes(item.id)} disabled={soldOut || saving} onChange={(event) => setSelected((current) => event.target.checked ? [...current, item.id] : current.filter((id) => id !== item.id))} />
        <span className="flex-1"><strong className="block text-lg">{item.name}</strong><small className={soldOut ? "font-bold text-red-700" : ""}>{soldOut ? "SOLD OUT" : !item.trackStock ? "Unlimited" : `${item.stock} left`}</small></span>
        <span className="display text-2xl">{symbol}{item.price}</span>
      </label>;
    })}</div>
    <div className="sticky bottom-4 grid gap-2 rounded-xl bg-[#23312c] p-4 text-white md:grid-cols-[1fr_1fr_auto]"><p className="display text-2xl">Cart: {symbol}{total}</p><p className={`display text-2xl ${balance !== undefined && balance - total < 0 ? "text-red-300" : "text-[#cde7d8]"}`}>{balance === undefined ? "Select a student" : `After: ${symbol}${balance - total}`}</p><button type="button" className="btn btn-accent" disabled={!studentId || !total || saving} onClick={() => void completePurchase()}>{saving ? "Completing..." : "Complete purchase"}</button></div>
  </div>;
}
