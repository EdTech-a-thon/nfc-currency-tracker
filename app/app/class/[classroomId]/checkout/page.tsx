"use client";

import { use } from "react";
import { useSearchParams } from "next/navigation";
import { pb, type Classroom, type StoreItem, type Student } from "@/lib/pocketbase";
import { useLoader, useTeacher } from "@/lib/session";
import { fetchBalances } from "@/lib/api";
import { StoreItems } from "@/components/StoreItems";

export default function Checkout({ params }: { params: Promise<{ classroomId: string }> }) {
  const { classroomId } = use(params);
  const teacher = useTeacher();
  const selectedId = useSearchParams().get("student") ?? undefined;

  const { data, error } = useLoader(async () => {
    if (!teacher) return null;
    const [classroom, students, items, balances] = await Promise.all([
      pb.collection("classrooms").getOne<Classroom>(classroomId),
      pb.collection("students").getFullList<Student>({ filter: `classroom = "${classroomId}" && active = true`, sort: "displayName" }),
      pb.collection("store_items").getFullList<StoreItem>({ filter: "active = true", sort: "sortOrder,name" }),
      fetchBalances(classroomId),
    ]);
    return {
      classroom, items,
      students: students.map((student) => ({
        id: student.id, name: student.displayName, balance: balances.balances[student.id] ?? 0,
      })),
    };
  }, [teacher?.id, classroomId]);

  if (!teacher) return null;
  if (error) return <p className="panel p-8">{error}</p>;
  if (!data) return <p className="panel p-8">Loading checkout...</p>;

  return <div className="grid gap-6">
    <div><p className="font-bold text-[#e85d43]">{data.classroom.name}</p><h1 className="text-4xl">Checkout</h1><p className="mt-1 text-slate-600">Items come from your shared account store.</p></div>
    {data.items.length
      ? <StoreItems items={data.items} students={data.students} initialStudentId={selectedId} symbol={data.classroom.currencySymbol} classroomId={classroomId} />
      : <p className="panel p-8">No store items are available.</p>}
  </div>;
}
