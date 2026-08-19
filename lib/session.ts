"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { currentTeacher, pb, readableError, type Teacher } from "@/lib/pocketbase";

// The app is drawn in the browser, so pages check who is signed in on load and
// send anyone else to the login screen rather than gating on the server.
export function useTeacher() {
  const router = useRouter();
  const [teacher, setTeacher] = useState<Teacher | null>(null);

  useEffect(() => {
    const signedIn = currentTeacher();
    if (!signedIn) {
      router.replace("/login");
      return;
    }
    setTeacher(signedIn);
    // Confirm the saved token is still accepted before trusting the screen.
    pb.collection("teachers").authRefresh().catch(() => {
      pb.authStore.clear();
      router.replace("/login");
    });
  }, [router]);

  return teacher;
}

type Loaded<T> = { data: T | null; error: string; loading: boolean; reload: () => void };

// Loads data for a screen and gives it a way to pull fresh figures after a write.
export function useLoader<T>(load: () => Promise<T>, keys: unknown[]): Loaded<T> {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [attempt, setAttempt] = useState(0);
  const reload = useCallback(() => setAttempt((count) => count + 1), []);

  useEffect(() => {
    let current = true;
    setLoading(true);
    load()
      .then((result) => {
        if (!current) return;
        setData(result);
        setError("");
      })
      .catch((problem) => current && setError(readableError(problem)))
      .finally(() => current && setLoading(false));
    return () => {
      current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...keys, attempt]);

  return { data, error, loading, reload };
}
