import { onMount } from "svelte";
import { goto } from "$app/navigation";
import {
  currentTeacher,
  pb,
  readableError,
  type Teacher,
} from "$lib/pocketbase";

// The app is drawn in the browser, so pages check who is signed in on load and
// send anyone else to the login screen rather than gating on the server.
export function requireTeacher() {
  const session = $state<{ teacher: Teacher | null }>({ teacher: null });

  onMount(() => {
    const signedIn = currentTeacher();
    if (!signedIn) {
      void goto("/login", { replaceState: true });
      return;
    }
    session.teacher = signedIn;
    // Confirm the saved token is still accepted before trusting the screen.
    pb.collection("teachers")
      .authRefresh()
      .catch(() => {
        pb.authStore.clear();
        void goto("/login", { replaceState: true });
      });
  });

  return session;
}

// Loads data for a screen and gives it a way to pull fresh figures after a
// write. The screen decides when to call reload(); nothing runs on its own.
export function createLoader<T>(load: () => Promise<T>) {
  const state = $state<{ data: T | null; error: string; loading: boolean }>({
    data: null,
    error: "",
    loading: true,
  });
  // Only the newest run may write to the screen, so a slow earlier load cannot
  // overwrite fresher figures.
  let latest = 0;

  async function reload() {
    const attempt = ++latest;
    state.loading = true;
    try {
      const result = await load();
      if (attempt !== latest) return;
      state.data = result;
      state.error = "";
    } catch (problem) {
      if (attempt !== latest) return;
      state.error = readableError(problem);
    } finally {
      if (attempt === latest) state.loading = false;
    }
  }

  return { state, reload };
}
