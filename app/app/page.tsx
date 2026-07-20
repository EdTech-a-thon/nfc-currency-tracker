import Link from "next/link";
import { createClassroom, archiveYear, deleteYear } from "@/app/actions";
import { requireTeacher } from "@/lib/auth";
import { db } from "@/lib/db";

export default async function Dashboard() {
  const teacher = await requireTeacher();
  const classes = await db.classroom.findMany({ where: { teacherId: teacher.id }, orderBy: [{ archived: "asc" }, { name: "asc" }], include: { _count: { select: { students: true } } } });
  const years = [...new Set(classes.map((room) => room.schoolYear))];
  return <div className="grid gap-8">
    <section><p className="font-bold uppercase tracking-[.18em] text-[#e85d43]">Your classrooms</p><h1 className="mt-2 text-4xl md:text-6xl">Where are we learning?</h1></section>
    <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {classes.filter((room) => !room.archived).map((room) => <Link className="panel group p-6 hover:border-[#e85d43]" href={`/app/class/${room.id}`} key={room.id}><p className="text-sm text-slate-500">{room.schoolYear}</p><h2 className="mt-2 text-2xl group-hover:text-[#e85d43]">{room.name}</h2><p className="mt-6">{room._count.students} students · {room.currencyName}</p></Link>)}
      {!classes.some((room) => !room.archived) && <div className="panel p-6">No active classrooms yet. Create one below.</div>}
    </section>
    <details className="panel p-5"><summary className="cursor-pointer text-lg font-bold">Create a classroom</summary><form action={createClassroom} className="mt-5 grid gap-4 md:grid-cols-5"><input className="field" name="name" placeholder="Class name" required /><input className="field" name="schoolYear" placeholder="2026-2027" required /><input className="field" name="currencyName" defaultValue="Class Bucks" required /><input className="field" name="currencySymbol" defaultValue="$" maxLength={4} required /><button className="btn btn-accent">Create</button></form></details>
    <details className="panel p-5"><summary className="cursor-pointer text-lg font-bold">Archived classrooms & school years</summary><div className="mt-5 grid gap-4">
      {classes.filter((room) => room.archived).map((room) => <Link className="rounded-xl bg-black/5 p-4" href={`/app/class/${room.id}`} key={room.id}>{room.name} · {room.schoolYear}</Link>)}
      {years.map((year) => <div className="grid gap-3 rounded-xl border border-black/10 p-4 md:grid-cols-[1fr_auto_auto]" key={year}><strong>{year}</strong><form action={archiveYear}><input type="hidden" name="schoolYear" value={year} /><button className="btn btn-soft w-full">Archive year</button></form><form action={deleteYear} className="grid gap-2 sm:grid-cols-[1fr_auto]"><input type="hidden" name="schoolYear" value={year} /><input className="field" name="confirmation" placeholder={`DELETE ${year}`} required /><button className="btn bg-red-700">Delete year</button></form></div>)}
    </div></details>
  </div>;
}
