import { requireTeacher } from "@/lib/auth";
import { db } from "@/lib/db";
import { AppNav } from "@/components/AppNav";

export default async function TeacherLayout({ children }: { children: React.ReactNode }) {
  const teacher = await requireTeacher();
  const classrooms = await db.classroom.findMany({ where: { teacherId: teacher.id, archived: false }, orderBy: { name: "asc" }, select: { id: true, name: true } });
  return <><AppNav teacherName={teacher.displayName} classrooms={classrooms} /><main className="mx-auto max-w-7xl p-4 md:p-7">{children}</main></>;
}
