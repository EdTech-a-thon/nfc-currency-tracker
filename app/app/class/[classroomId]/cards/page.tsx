"use client";

import { use, useState } from "react";
import Link from "next/link";
import { pb, readableError, type Card, type CardAssignment, type Classroom, type Student } from "@/lib/pocketbase";
import { useLoader, useTeacher } from "@/lib/session";
import { autoAssignCards, cardUrl, generateCards, resetAssignments } from "@/lib/api";
import { BulkCardManager } from "@/components/BulkCardManager";
import { StudentCardAssignments } from "@/components/StudentCardAssignments";

const byLabel = (first: Card, second: Card) =>
  Number(first.label) - Number(second.label) || first.label.localeCompare(second.label, undefined, { numeric: true });

export default function Cards({ params }: { params: Promise<{ classroomId: string }> }) {
  const { classroomId } = use(params);
  const teacher = useTeacher();
  const [message, setMessage] = useState("");

  const { data, error, reload } = useLoader(async () => {
    if (!teacher) return null;
    const [classroom, students, cards, openAssignments] = await Promise.all([
      pb.collection("classrooms").getOne<Classroom>(classroomId),
      pb.collection("students").getFullList<Student>({ filter: `classroom = "${classroomId}" && active = true`, sort: "displayName" }),
      pb.collection("cards").getFullList<Card>(),
      pb.collection("card_assignments").getFullList<CardAssignment & { expand?: { student?: Student } }>({
        filter: "endedAt = null", expand: "student",
      }),
    ]);
    const classrooms = await pb.collection("classrooms").getFullList<Classroom>();
    const classroomNames = new Map(classrooms.map((room) => [room.id, room.name]));
    const holderByCard = new Map(openAssignments.map((row) => [row.card, row.expand?.student ?? null]));
    const cardByStudent = new Map(openAssignments.map((row) => [row.student, row.card]));
    return { classroom, students, cards: [...cards].sort(byLabel), holderByCard, cardByStudent, classroomNames };
  }, [teacher?.id, classroomId]);

  async function guard(work: () => Promise<void>, done: string) {
    try {
      await work();
      setMessage(done);
      reload();
    } catch (problem) {
      setMessage(readableError(problem));
    }
  }

  if (!teacher) return null;
  if (error) return <p className="panel p-8">{error}</p>;
  if (!data) return <p className="panel p-8">Loading your cards...</p>;
  const { classroom, students, cards, holderByCard, cardByStudent, classroomNames } = data;
  const cardById = new Map(cards.map((card) => [card.id, card]));
  const available = cards.filter((card) => card.status === "AVAILABLE");
  const counts = {
    available: available.length,
    assigned: cards.filter((card) => card.status === "ASSIGNED").length,
    lost: cards.filter((card) => card.status === "LOST").length,
    retired: cards.filter((card) => card.status === "RETIRED").length,
  };

  return <div className="grid gap-6">
    <div><p className="font-bold text-[#e85d43]">Reusable card set</p><h1 className="text-4xl">Cards for {classroom.name}</h1><p className="mt-2 max-w-3xl text-slate-600">A permanent URL belongs to each numbered card, not to a student. Write Card #1’s URL to physical Card #1 once. When you assign Card #1 below, that same URL immediately opens the assigned student. Reassigning it later requires no NFC rewrite.</p></div>
    {message && <p className="rounded-xl bg-[#cde7d8] p-4 font-bold text-green-900" role="status">{message}</p>}
    <div className="panel grid gap-3 p-5 md:grid-cols-2"><Link className="rounded-xl bg-[#fff0e8] p-4" href={`/app/class/${classroomId}/cards/encoding`}><strong className="block text-lg">1. Write NFC cards</strong><span className="text-sm">Copy each URL into NFC Tools and write the matching physical card.</span></Link><div className="rounded-xl bg-[#cde7d8] p-4"><strong className="block text-lg">2. Assign students</strong><span className="text-sm">Choose the numbered card beside each student below.</span></div></div>
    <section className="grid grid-cols-2 gap-3 md:grid-cols-4"><div className="panel p-4"><p className="text-sm text-slate-500">Available</p><p className="display text-3xl">{counts.available}</p></div><div className="panel p-4"><p className="text-sm text-slate-500">Assigned</p><p className="display text-3xl">{counts.assigned}</p></div><div className="panel p-4"><p className="text-sm text-slate-500">Lost</p><p className="display text-3xl">{counts.lost}</p></div><div className="panel p-4"><p className="text-sm text-slate-500">Retired</p><p className="display text-3xl">{counts.retired}</p></div></section>
    {!classroom.archived && <form onSubmit={(event) => { event.preventDefault(); const count = Number(new FormData(event.currentTarget).get("count")); void guard(() => generateCards(count).then(() => undefined), `Created ${count} card${count === 1 ? "" : "s"}.`); }} className="panel flex flex-wrap items-end gap-3 p-5"><label className="label">New cards<input className="field max-w-32" type="number" name="count" min="1" max="200" defaultValue="30" required /></label><button className="btn btn-accent">Generate card set</button><span className="text-sm text-slate-600">Permanent tokens and labels continue from the highest existing number.</span></form>}
    <StudentCardAssignments
      students={students.map((student) => {
        const card = cardById.get(cardByStudent.get(student.id) ?? "");
        return {
          id: student.id, displayName: student.displayName,
          card: card ? { id: card.id, label: card.label, shortCode: card.shortCode, url: cardUrl(card.token) } : null,
        };
      })}
      availableCards={available.map((card) => ({ id: card.id, label: card.label, shortCode: card.shortCode }))}
      onChanged={reload}
    />
    {!classroom.archived && <div className="flex flex-wrap gap-3">
      <button className="btn btn-accent" onClick={() => void guard(() => autoAssignCards(classroomId).then(() => undefined), "Cards assigned in order.")}>Sequential auto-assign</button>
      <button className="btn bg-red-700" onClick={() => void guard(() => resetAssignments(classroomId).then(() => undefined), "All assignments in this class ended.")}>End all assignments in this class</button>
    </div>}
    <BulkCardManager
      cards={cards.map((card) => {
        const holder = holderByCard.get(card.id) ?? null;
        return {
          id: card.id, label: card.label, shortCode: card.shortCode, status: card.status,
          studentName: holder?.displayName ?? null,
          studentClassroom: holder?.classroom ? classroomNames.get(holder.classroom) ?? null : null,
        };
      })}
      onChanged={reload}
    />
  </div>;
}
