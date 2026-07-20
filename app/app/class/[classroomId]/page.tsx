import Link from "next/link";
import { requireTeacher } from "@/lib/auth";
import { ownedClassroom } from "@/lib/classes";
import { db } from "@/lib/db";
import { OptimisticAward } from "@/components/OptimisticAward";
import { Scanner } from "@/components/Scanner";

export default async function AwardPage({ params }: { params: Promise<{ classroomId: string }> }) {
  const teacher = await requireTeacher();
  const { classroomId } = await params;
  const classroom = await ownedClassroom(teacher.id, classroomId);
  const students = await db.student.findMany({ where: { teacherId: teacher.id, classroomId, active: true }, orderBy: { displayName: "asc" }, include: { transactions: { select: { amount: true } } } });
  const presets = await db.awardPreset.findMany({ where: { classroomId }, orderBy: { sortOrder: "asc" } });
  return <div className="grid gap-6">
    <div className="flex flex-wrap items-end justify-between gap-4"><div><p className="font-bold uppercase tracking-[.18em] text-[#e85d43]">{classroom.name}</p><h1 className="text-4xl md:text-6xl">Award {classroom.currencyName}</h1></div><Link className="btn" href={`/app/class/${classroomId}/checkout`}>Open checkout</Link></div>
    {classroom.archived ? <div className="panel p-8"><h2 className="text-2xl">This classroom is archived</h2><p className="mt-2">Its history remains available, but rewards and purchases are read-only.</p></div> : <><Scanner /><OptimisticAward classroomId={classroomId} symbol={classroom.currencySymbol} presets={presets} students={students.map((student) => ({ id: student.id, displayName: student.displayName, balance: student.transactions.reduce((sum, entry) => sum + entry.amount, 0) }))} /></>}
  </div>;
}
