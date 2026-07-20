"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

export function Scanner({ mode = "award" }: { mode?: "award" | "checkout" }) {
  const router = useRouter();
  const scanner = useRef<{ stop: () => Promise<void> } | null>(null);
  const [open, setOpen] = useState(false);
  const [manual, setManual] = useState("");
  const [error, setError] = useState("");
  const [student, setStudent] = useState<{ id: string; name: string; balance: number; symbol: string; currencyName: string } | null>(null);
  const [status, setStatus] = useState("");

  async function resolve(value: string) {
    const token = value.match(/\/(?:c|s)\/([^/?#]+)/)?.[1] ?? value.trim();
    if (mode === "checkout") return router.push(`/scan/${encodeURIComponent(token)}?mode=checkout`);
    setStatus("Finding student...");
    const response = await fetch(`/api/cards/resolve?identifier=${encodeURIComponent(token)}`);
    const result = await response.json();
    if (!response.ok) { setStudent(null); setStatus(result.error ?? "Card not assigned."); return; }
    setStudent(result); setStatus("Ready to award. Keep scanning when finished.");
  }

  async function award(amount: number) {
    if (!student) return;
    setStudent({ ...student, balance: student.balance + amount }); setStatus("Saving...");
    try {
      const response = await fetch("/api/transactions", { method: "POST", headers: { "Content-Type": "application/json", "Idempotency-Key": crypto.randomUUID() }, body: JSON.stringify({ studentIds: [student.id], amount, reason: "" }) });
      const result = await response.json(); if (!response.ok) throw new Error(result.error);
      setStatus(`Synced +${amount} ${student.currencyName}. Scan the next card.`);
    } catch (failure) { setStudent({ ...student, balance: student.balance - amount }); setStatus(failure instanceof Error ? failure.message : "Could not save."); }
  }

  useEffect(() => {
    if (!open) return;
    let active = true;
    import("html5-qrcode").then(async ({ Html5Qrcode }) => {
      if (!active) return;
      const reader = new Html5Qrcode("qr-reader");
      scanner.current = reader;
      try {
        await reader.start({ facingMode: "environment" }, { fps: 10, qrbox: { width: 240, height: 240 } }, (value) => {
          const token = value.match(/\/(?:c|s)\/([^/?#]+)/)?.[1] ?? value.trim();
          void resolve(token);
        }, () => undefined);
      } catch { setError("Camera access was unavailable. Check permission or enter the 4-character code."); }
    });
    return () => { active = false; if (scanner.current) void scanner.current.stop().catch(() => undefined); };
  }, [open, mode, router]);

  function submit() { if (manual.trim()) void resolve(manual.trim()); }
  return <div className="panel p-4"><div className="grid gap-2 sm:grid-cols-[auto_1fr_auto] sm:items-center"><button className="btn btn-accent" onClick={() => setOpen((value) => !value)}>{open ? "Close camera" : "Scan QR card"}</button><input className="field uppercase" maxLength={40} value={manual} onChange={(event) => setManual(event.target.value)} onKeyDown={(event) => event.key === "Enter" && submit()} placeholder="Enter short code" /><button className="btn" onClick={submit}>Find card</button></div>{error && <p className="mt-3 text-red-700">{error}</p>}{open && <div id="qr-reader" className="mx-auto mt-4 max-w-lg overflow-hidden rounded-xl" />}{student && mode === "award" && <div className="mt-4 rounded-xl bg-[#cde7d8] p-4"><div className="flex items-center justify-between gap-3"><strong className="text-xl">{student.name}</strong><span className="display whitespace-nowrap text-3xl">{student.symbol}{student.balance}</span></div><div className="mt-3 grid grid-cols-3 gap-2">{[1, 3, 5].map((amount) => <button className="btn btn-accent text-lg" onClick={() => void award(amount)} key={amount}>+{amount}</button>)}</div></div>}<p className="mt-3 text-sm">{status}</p></div>;
}
