"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { logout } from "@/app/actions";

export function AppNav({ teacherName, classrooms }: { teacherName: string; classrooms: { id: string; name: string }[] }) {
  const pathname = usePathname();
  const navigation = useRouter();
  const currentId = pathname.match(/^\/app\/class\/([^/]+)/)?.[1];
  return <header className="no-print sticky top-0 z-30 border-b border-black/10 bg-[#fbf6e9]/95 backdrop-blur">
    <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-2 px-3 py-2 sm:gap-3 sm:px-5 sm:py-3">
      <Link href="/app" className="display whitespace-nowrap text-base sm:text-lg">NFC <span className="text-[#e85d43]">Currency</span></Link>
      <Link href="/app" className="btn btn-soft mr-auto px-3" aria-label="View all classes">Home</Link>
      <nav className="order-3 grid w-full grid-cols-4 gap-1 md:order-none md:flex md:w-auto">
        {currentId && <><Link className="btn btn-soft px-2" href={`/app/class/${currentId}`}>Award</Link><Link className="btn btn-soft px-2" href={`/app/class/${currentId}/roster`}>Roster</Link><Link className="btn btn-soft px-2" href={`/app/class/${currentId}/store`}>Store</Link><Link className="btn btn-soft px-2" href={`/app/class/${currentId}/cards`}>Cards</Link></>}
      </nav>
      <select className="field max-w-40 sm:max-w-52" aria-label="Switch active classroom" value={currentId ?? "all"} onChange={(event) => navigation.push(event.target.value === "all" ? "/app" : `/app/class/${event.target.value}`)}>
        <option value="all">All classes</option>{classrooms.map((room) => <option key={room.id} value={room.id}>{room.name}</option>)}
      </select>
      <span className="hidden text-sm md:inline">{teacherName}</span>
      <form action={logout}><button className="btn btn-soft px-3">Log out</button></form>
    </div>
  </header>;
}
