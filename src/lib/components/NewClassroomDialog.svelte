<script lang="ts">
  import Modal from "$lib/components/Modal.svelte";
  import RosterInput from "$lib/components/RosterInput.svelte";
  import { shortenRoster, splitNames } from "$lib/names";
  import { pb, readableError, type Classroom } from "$lib/pocketbase";

  let {
    open = $bindable(false),
    teacherId,
    onCreated,
  }: {
    open?: boolean;
    teacherId: string;
    onCreated: (classroomId: string) => void;
  } = $props();

  const startingPresets = [
    { label: "Great choice", amount: 1, sortOrder: 0 },
    { label: "Helping out", amount: 2, sortOrder: 1 },
    { label: "Above & beyond", amount: 5, sortOrder: 2 },
  ];

  let name = $state("");
  let schoolYear = $state("");
  let currencyName = $state("Class Bucks");
  let currencySymbol = $state("$");
  let roster = $state("");
  let busy = $state(false);
  let problem = $state("");

  const names = $derived(shortenRoster(splitNames(roster)));

  async function create(event: SubmitEvent) {
    event.preventDefault();
    busy = true;
    problem = "";
    try {
      const classroom = await pb.collection("classrooms").create<Classroom>({
        teacher: teacherId,
        name: name.trim(),
        schoolYear: schoolYear.trim(),
        currencyName: currencyName.trim() || "Class Bucks",
        currencySymbol: currencySymbol.trim().slice(0, 4) || "$",
        archived: false,
      });
      for (const preset of startingPresets)
        await pb
          .collection("award_presets")
          .create({ classroom: classroom.id, ...preset });
      for (const displayName of names.slice(0, 200))
        await pb.collection("students").create({
          teacher: teacherId,
          classroom: classroom.id,
          displayName,
          active: true,
        });
      open = false;
      name = "";
      schoolYear = "";
      currencyName = "Class Bucks";
      currencySymbol = "$";
      roster = "";
      onCreated(classroom.id);
    } catch (failure) {
      problem = readableError(failure, "That classroom could not be created.");
    } finally {
      busy = false;
    }
  }
</script>

<Modal bind:open title="Create a classroom">
  <form onsubmit={create} class="grid gap-5">
    <div class="grid gap-4 md:grid-cols-2">
      <label class="label">
        Class name
        <input class="field" bind:value={name} placeholder="Room 12" required />
        <span class="font-normal text-slate-600"
          >What you call this group of students.</span
        >
      </label>
      <label class="label">
        School year
        <input
          class="field"
          bind:value={schoolYear}
          placeholder="2026-2027"
          required
        />
        <span class="font-normal text-slate-600"
          >Used to tidy up classes at the end of the year.</span
        >
      </label>
      <label class="label">
        Name of your class currency
        <input class="field" bind:value={currencyName} required />
        <span class="font-normal text-slate-600"
          >What students earn, such as Class Bucks or Dojo Points.</span
        >
      </label>
      <label class="label">
        Currency symbol
        <input
          class="field"
          bind:value={currencySymbol}
          maxlength="4"
          required
        />
        <span class="font-normal text-slate-600"
          >Shown next to every balance, such as $ or ★. Up to four characters.</span
        >
      </label>
    </div>

    <div class="border-t border-black/10 pt-5">
      <h3 class="text-lg">Add your students (optional)</h3>
      <p class="mb-3 mt-1 text-sm text-slate-600">
        You can skip this and add students later from the roster page.
      </p>
      <RosterInput bind:value={roster} {names} />
    </div>

    {#if problem}
      <p class="rounded-xl bg-red-100 p-4 font-bold text-red-800" role="alert">
        {problem}
      </p>
    {/if}

    <div class="flex flex-wrap gap-2">
      <button class="btn btn-accent" disabled={busy}>
        {busy ? "Creating..." : "Create classroom"}
      </button>
      <button
        type="button"
        class="btn btn-soft"
        onclick={() => (open = false)}
        disabled={busy}>Cancel</button
      >
    </div>
  </form>
</Modal>
