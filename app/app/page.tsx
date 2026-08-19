"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { pb, readableError, type Classroom, type Transaction } from "@/lib/pocketbase";
import { useLoader, useTeacher } from "@/lib/session";
import { deleteYear } from "@/lib/api";
import { ClassroomActions } from "@/components/ClassroomActions";

type Summary = Classroom & { studentCount: number; lastActivity: string | null };

export default function Dashboard() {
  const teacher = useTeacher();
  const router = useRouter();
  const [message, setMessage] = useState("");

  const { data: classes, reload } = useLoader<Summary[]>(async () => {
    if (!teacher) return [];
    const rooms = await pb.collection("classrooms").getFullList<Classroom>({ sort: "archived,name" });
    return Promise.all(rooms.map(async (room) => {
      const students = await pb.collection("students").getList(1, 1, { filter: `classroom = "${room.id}"` });
      const latest = await pb.collection("transactions").getList<Transaction>(1, 1, {
        filter: `classroom = "${room.id}"`, sort: "-created",
      });
      return { ...room, studentCount: students.totalItems, lastActivity: latest.items[0]?.created ?? null };
    }));
  }, [teacher?.id]);

  async function createClassroom(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try {
      const created = await pb.collection("classrooms").create<Classroom>({
        teacher: teacher!.id,
        name: String(form.get("name")).trim(),
        schoolYear: String(form.get("schoolYear")).trim(),
        currencyName: String(form.get("currencyName")).trim() || "Class Bucks",
        currencySymbol: String(form.get("currencySymbol")).trim().slice(0, 4) || "$",
        archived: false,
      });
      const presets = [
        { label: "Great choice", amount: 1, sortOrder: 0 },
        { label: "Helping out", amount: 2, sortOrder: 1 },
        { label: "Above & beyond", amount: 5, sortOrder: 2 },
      ];
      for (const preset of presets) await pb.collection("award_presets").create({ classroom: created.id, ...preset });
      router.push(`/app/class/${created.id}`);
    } catch (problem) {
      setMessage(readableError(problem, "That classroom could not be created."));
    }
  }

  async function removeYear(event: React.FormEvent<HTMLFormElement>, schoolYear: string) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try {
      const result = await deleteYear(schoolYear, String(form.get("confirmation")));
      setMessage(`Removed ${result.removed} class${result.removed === 1 ? "" : "es"} from ${schoolYear}.`);
      reload();
    } catch (problem) {
      setMessage(readableError(problem, "That school year could not be deleted."));
    }
  }

  if (!teacher) return null;
  const rooms = classes ?? [];
  const years = [...new Set(rooms.map((room) => room.schoolYear))];

  return <div className="grid gap-8">
    <section><p className="font-bold uppercase tracking-[.18em] text-[#e85d43]">Your classrooms</p><h1 className="mt-2 text-4xl md:text-6xl">Where are we learning?</h1></section>
    {message && <p className="rounded-xl bg-[#cde7d8] p-4 font-bold text-green-900" role="status">{message}</p>}
    <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {rooms.filter((room) => !room.archived).map((room) => <article className="panel p-6" key={room.id}><Link className="group block hover:text-[#e85d43]" href={`/app/class/${room.id}`}><p className="text-sm text-slate-500">{room.schoolYear}</p><h2 className="mt-2 text-2xl">{room.name}</h2><p className="mt-6">{room.studentCount} student{room.studentCount === 1 ? "" : "s"}</p><p className="mt-1 text-sm text-slate-500">{room.lastActivity ? `Last activity ${new Date(room.lastActivity).toLocaleDateString()}` : "No activity yet"} · {room.currencyName}</p></Link></article>)}
      {!rooms.some((room) => !room.archived) && <div className="panel p-6">No active classrooms yet. Create one below.</div>}
    </section>
    <details className="panel p-5"><summary className="cursor-pointer text-lg font-bold">Create a classroom</summary><form onSubmit={createClassroom} className="mt-5 grid gap-4 md:grid-cols-5"><input className="field" name="name" placeholder="Class name" required /><input className="field" name="schoolYear" placeholder="2026-2027" required /><input className="field" name="currencyName" defaultValue="Class Bucks" required /><input className="field" name="currencySymbol" defaultValue="$" maxLength={4} required /><button className="btn btn-accent">Create</button></form></details>
    <details className="panel p-5"><summary className="cursor-pointer text-lg font-bold">Archived classrooms & school years</summary><div className="mt-5 grid gap-4">
       {rooms.filter((room) => room.archived).map((room) => <article className="rounded-xl bg-black/5 p-4" key={room.id}><Link className="font-bold hover:text-[#e85d43]" href={`/app/class/${room.id}`}>{room.name} · {room.schoolYear}</Link></article>)}
      </div></details>
      <details className="panel p-5"><summary className="cursor-pointer text-lg font-bold">End-of-year tools</summary><p className="mt-3 text-sm text-slate-600">Archive, restore, or permanently delete individual classes here. Deleting a school year permanently removes every archived class in that year.</p><div className="mt-5 grid gap-4"><section><h2 className="text-lg font-bold">Individual classes</h2><div className="mt-3 grid gap-3">{rooms.map((room) => <div className="grid gap-3 rounded-xl border border-black/10 p-4 md:grid-cols-[1fr_auto]" key={room.id}><div><strong>{room.name}</strong><p className="mt-1 text-sm text-slate-600">{room.schoolYear} · {room.archived ? "Archived" : "Active"}</p></div><ClassroomActions classroomId={room.id} classroomName={room.name} archived={room.archived} onDone={reload} /></div>)}</div></section><section><h2 className="text-lg font-bold">School years</h2><div className="mt-3 grid gap-4">{years.map((year) => <div className="grid gap-3 rounded-xl border border-black/10 p-4 md:grid-cols-[1fr_auto]" key={year}><strong>{year}</strong><form onSubmit={(event) => void removeYear(event, year)} className="grid gap-2 sm:grid-cols-[1fr_auto]"><input className="field" name="confirmation" placeholder={`DELETE ${year}`} required /><button className="btn bg-red-700">Delete all classes</button></form></div>)}</div></section></div></details>
  </div>;
}
