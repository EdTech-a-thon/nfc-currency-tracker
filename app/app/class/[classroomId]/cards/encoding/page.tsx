import { requireTeacher } from "@/lib/auth";
import { ownedClassroom } from "@/lib/classes";
import { cardUrl } from "@/lib/cards";
import { db } from "@/lib/db";

export default async function Encoding({ params }: { params: Promise<{ classroomId: string }> }) {
  const teacher = await requireTeacher(); const { classroomId } = await params; await ownedClassroom(teacher.id, classroomId);
  const cards = await db.card.findMany({ where: { teacherId: teacher.id }, orderBy: { label: "asc" } });
  return <div className="grid gap-5"><div><h1 className="text-4xl">NFC encoding sheet</h1><p className="mt-2 max-w-2xl">Write each URL to the matching physical card once. The card stores only this URL, never a name or balance.</p></div><a className="btn w-fit" href={`/api/cards.csv`}>Download CSV</a><pre className="panel overflow-auto p-5 text-sm">{cards.map((card) => `${card.label} → ${cardUrl(card.token)}`).join("\n") || "No cards generated yet."}</pre></div>;
}
