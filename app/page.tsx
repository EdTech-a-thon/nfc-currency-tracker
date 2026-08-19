"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { currentTeacher } from "@/lib/pocketbase";

export default function Home() {
  const router = useRouter();
  useEffect(() => {
    router.replace(currentTeacher() ? "/app" : "/login");
  }, [router]);
  return null;
}
