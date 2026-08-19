"use client";

import { pb, type Classroom } from "@/lib/pocketbase";
import { useLoader, useTeacher } from "@/lib/session";
import { AppNav } from "@/components/AppNav";

export default function TeacherLayout({ children }: { children: React.ReactNode }) {
  const teacher = useTeacher();
  const { data: classrooms } = useLoader(
    async () => teacher
      ? pb.collection("classrooms").getFullList<Classroom>({ filter: "archived = false", sort: "name" })
      : [],
    [teacher?.id]
  );

  if (!teacher) return null;
  return <>
    <AppNav teacherName={teacher.displayName} classrooms={(classrooms ?? []).map((room) => ({ id: room.id, name: room.name }))} />
    <main className="mx-auto max-w-7xl px-3 py-4 sm:px-5 md:p-7">{children}</main>
  </>;
}
