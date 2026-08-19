"use client";

import { use } from "react";
import { pb, type AwardPreset, type Classroom, type Student } from "@/lib/pocketbase";
import { useLoader, useTeacher } from "@/lib/session";
import { fetchBalances } from "@/lib/api";
import { OptimisticAward } from "@/components/OptimisticAward";

export default function AwardPage({ params }: { params: Promise<{ classroomId: string }> }) {
  const { classroomId } = use(params);
  const teacher = useTeacher();

  const { data, error } = useLoader(async () => {
    if (!teacher) return null;
    const classroom = await pb.collection("classrooms").getOne<Classroom>(classroomId);
    const [students, presets, balances] = await Promise.all([
      pb.collection("students").getFullList<Student>({
        filter: `classroom = "${classroomId}" && active = true`, sort: "displayName",
      }),
      pb.collection("award_presets").getFullList<AwardPreset>({
        filter: `classroom = "${classroomId}"`, sort: "sortOrder",
      }),
      fetchBalances(classroomId),
    ]);
    return { classroom, presets, students: students.map((student) => ({
      id: student.id, displayName: student.displayName, balance: balances.balances[student.id] ?? 0,
    })) };
  }, [teacher?.id, classroomId]);

  if (!teacher) return null;
  if (error) return <p className="panel p-8">{error}</p>;
  if (!data) return <p className="panel p-8">Loading your class...</p>;
  const { classroom, students, presets } = data;

  return <div className="grid gap-6">
    <div className="flex flex-wrap items-end justify-between gap-4"><div><p className="font-bold uppercase tracking-[.18em] text-[#e85d43]">{classroom.name}</p><h1 className="text-4xl md:text-6xl">Award {classroom.currencyName}</h1></div>{!classroom.archived && <a className="btn" href={`/app/class/${classroomId}/checkout`}>Open checkout</a>}</div>
    {classroom.archived
      ? <div className="panel p-8"><h2 className="text-2xl">This classroom is archived</h2><p className="mt-2">Its history remains available, but rewards and purchases are read-only.</p></div>
      : <OptimisticAward classroomId={classroomId} symbol={classroom.currencySymbol} presets={presets} students={students} />}
  </div>;
}
