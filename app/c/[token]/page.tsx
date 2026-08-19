"use client";

import { use, useState } from "react";
import Link from "next/link";
import { readableError } from "@/lib/pocketbase";
import { useLoader } from "@/lib/session";
import { tapCard, undoEntry, type TapView } from "@/lib/api";
import { CardAward } from "@/components/CardAward";

// A tapped card. Anyone holding the card sees the balance; only the teacher who
// owns it gets the controls, and PocketBase decides which of those applies.
export default function CardView({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const [message, setMessage] = useState("");
  const { data, error, loading, reload } = useLoader<TapView>(() => tapCard(token), [token]);

  if (loading) return <main className="grid min-h-screen place-items-center p-5"><p>Loading this card...</p></main>;
  if (error || !data) return <main className="grid min-h-screen place-items-center p-5"><div className="panel max-w-md p-8 text-center"><p className="font-bold text-[#e85d43]">NFC Currency Tracker</p><h1 className="mt-3 text-3xl">This card isn’t assigned yet</h1><p className="mt-3 text-slate-600">Ask your teacher to assign or replace this card.</p></div></main>;

  const { student, classroom, balance, transactions, store, canManage, presets } = data;

  async function undo(transactionId: string) {
    try {
      await undoEntry(transactionId);
      reload();
    } catch (problem) {
      setMessage(readableError(problem));
    }
  }

  return <main className="mx-auto grid min-h-screen max-w-xl gap-5 p-4 py-8">
    <section className="overflow-hidden rounded-[2rem] bg-[#23312c] p-7 text-white"><p className="font-bold text-[#f9bd72]">{classroom.name}</p><h1 className="mt-2 text-3xl">{student.displayName}</h1><p className="display mt-8 text-7xl text-[#f9bd72]">{classroom.currencySymbol}{balance}</p><p>{classroom.currencyName}</p></section>
    {message && <p className="rounded-xl bg-red-100 p-4 font-bold text-red-800" role="alert">{message}</p>}
    {canManage && <CardAward studentId={student.id} presets={presets} currencyName={classroom.currencyName} onPosted={reload} />}
    {canManage && <Link className="btn" href={`/app/student/${student.id}`}>Open full teacher controls</Link>}
    <section className="panel overflow-hidden"><h2 className="p-5 text-xl">Recent activity</h2>{transactions.map((entry) => <div className="flex justify-between border-t border-black/10 p-4" key={entry.id}><div>{entry.reason && <strong>{entry.reason}</strong>}<p className="text-sm text-slate-500">{new Date(entry.created).toLocaleDateString()}</p></div><div className="text-right"><span className={entry.amount > 0 ? "text-green-700" : "text-red-700"}>{entry.amount > 0 ? "+" : ""}{entry.amount}</span>{canManage && <button className="mt-1 block text-xs underline" onClick={() => void undo(entry.id)}>Undo</button>}</div></div>)}{!transactions.length && <p className="p-5 text-slate-600">No activity yet.</p>}</section>
    <section className="panel p-5"><h2 className="text-xl">Account store</h2>{store.length ? <div className="mt-3 grid gap-2">{store.map((item) => <div className="flex justify-between" key={item.id}><span>{item.name}</span><strong>{classroom.currencySymbol}{item.price}</strong></div>)}</div> : <p className="mt-2 text-slate-600">No store items are available.</p>}</section>
  </main>;
}
