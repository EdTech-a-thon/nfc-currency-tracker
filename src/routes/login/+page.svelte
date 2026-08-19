<script lang="ts">
  import { goto } from "$app/navigation";
  import { pb, readableError } from "$lib/pocketbase";

  let error = $state("");
  let busy = $state(false);

  async function signIn(event: SubmitEvent) {
    event.preventDefault();
    const form = new FormData(event.currentTarget as HTMLFormElement);
    busy = true;
    error = "";
    try {
      await pb
        .collection("teachers")
        .authWithPassword(
          String(form.get("email")).trim().toLowerCase(),
          String(form.get("password")),
        );
      await goto("/app", { replaceState: true });
    } catch {
      error = "That email or password did not match.";
    } finally {
      busy = false;
    }
  }

  async function createAccount(event: SubmitEvent) {
    event.preventDefault();
    const form = new FormData(event.currentTarget as HTMLFormElement);
    const email = String(form.get("email")).trim().toLowerCase();
    const password = String(form.get("password"));
    busy = true;
    error = "";
    try {
      await pb.collection("teachers").create({
        email,
        password,
        passwordConfirm: password,
        displayName: String(form.get("displayName")).trim(),
      });
      await pb.collection("teachers").authWithPassword(email, password);
      await goto("/app", { replaceState: true });
    } catch (problem) {
      error = readableError(problem, "That account could not be created.");
    } finally {
      busy = false;
    }
  }
</script>

<main class="min-h-screen bg-[#23312c] p-5 md:grid md:place-items-center">
  <div
    class="mx-auto grid max-w-5xl overflow-hidden rounded-[2rem] bg-[#fbf6e9] md:grid-cols-2"
  >
    <section
      class="flex min-h-72 flex-col justify-between bg-[#e85d43] p-8 text-white md:min-h-[640px] md:p-12"
    >
      <p class="font-bold uppercase tracking-[.2em]">NFC Currency Tracker</p>
      <div>
        <h1 class="text-5xl leading-[.95] md:text-7xl">Good choices add up.</h1>
        <p class="mt-5 max-w-sm text-lg text-white/85">
          Reusable cards, quick classroom rewards, and no paper money to lose.
        </p>
      </div>
      <p class="text-sm text-white/75">
        Made for busy teachers and shared classroom devices.
      </p>
    </section>
    <section class="p-7 md:p-12">
      <h2 class="text-2xl">Welcome back</h2>
      {#if error}
        <p class="my-3 rounded-lg bg-red-100 p-3 text-red-800" role="alert">
          {error}
        </p>
      {/if}
      <form onsubmit={signIn} class="mt-5 grid gap-4">
        <label class="label"
          >Email<input
            class="field"
            name="email"
            type="email"
            autocomplete="email"
            required
          /></label
        >
        <label class="label">
          Password<input
            class="field"
            name="password"
            type="password"
            autocomplete="current-password"
            required
          />
        </label>
        <button class="btn btn-accent" disabled={busy}
          >{busy ? "Please wait..." : "Log in"}</button
        >
      </form>
      <details class="mt-10 border-t border-black/10 pt-6">
        <summary class="cursor-pointer font-bold"
          >Create a teacher account</summary
        >
        <form onsubmit={createAccount} class="mt-4 grid gap-3">
          <label class="label"
            >Your name<input class="field" name="displayName" required /></label
          >
          <label class="label"
            >Email<input
              class="field"
              name="email"
              type="email"
              required
            /></label
          >
          <label class="label"
            >Password<input
              class="field"
              name="password"
              type="password"
              minlength="8"
              required
            /></label
          >
          <button class="btn" disabled={busy}>Create account</button>
        </form>
      </details>
    </section>
  </div>
</main>
