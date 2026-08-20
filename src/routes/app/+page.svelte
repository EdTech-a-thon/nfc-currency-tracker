<script lang="ts">
  import { goto } from "$app/navigation";
  import ClassroomActions from "$lib/components/ClassroomActions.svelte";
  import NewClassroomDialog from "$lib/components/NewClassroomDialog.svelte";
  import { deleteYear } from "$lib/api";
  import {
    pb,
    readableError,
    type Classroom,
    type Transaction,
  } from "$lib/pocketbase";
  import { createLoader, requireTeacher } from "$lib/session.svelte";

  type Summary = Classroom & {
    studentCount: number;
    lastActivity: string | null;
  };

  const session = requireTeacher();
  let message = $state("");
  let creating = $state(false);

  const classes = createLoader<Summary[]>(async () => {
    const rooms = await pb
      .collection("classrooms")
      .getFullList<Classroom>({ sort: "archived,name" });
    return Promise.all(
      rooms.map(async (room) => {
        const students = await pb
          .collection("students")
          .getList(1, 1, { filter: `classroom = "${room.id}"` });
        const latest = await pb
          .collection("transactions")
          .getList<Transaction>(1, 1, {
            filter: `classroom = "${room.id}"`,
            sort: "-created",
          });
        return {
          ...room,
          studentCount: students.totalItems,
          lastActivity: latest.items[0]?.created ?? null,
        };
      }),
    );
  });

  $effect(() => {
    if (session.teacher) void classes.reload();
  });

  const rooms = $derived(classes.state.data ?? []);
  const years = $derived([...new Set(rooms.map((room) => room.schoolYear))]);

  async function removeYear(event: SubmitEvent, schoolYear: string) {
    event.preventDefault();
    const form = new FormData(event.currentTarget as HTMLFormElement);
    try {
      const result = await deleteYear(
        schoolYear,
        String(form.get("confirmation")),
      );
      message = `Removed ${result.removed} class${result.removed === 1 ? "" : "es"} from ${schoolYear}.`;
      void classes.reload();
    } catch (problem) {
      message = readableError(
        problem,
        "That school year could not be deleted.",
      );
    }
  }
</script>

{#if session.teacher}
  <div class="grid gap-8">
    <section class="flex flex-wrap items-end justify-between gap-4">
      <div>
        <p class="font-bold uppercase tracking-[.18em] text-[#e85d43]">
          Your classrooms
        </p>
        <h1 class="mt-2 text-4xl md:text-6xl">Where are we learning?</h1>
      </div>
      <button class="btn btn-accent" onclick={() => (creating = true)}>
        Create a classroom
      </button>
    </section>

    {#if message}
      <p
        class="rounded-xl bg-[#cde7d8] p-4 font-bold text-green-900"
        role="status"
      >
        {message}
      </p>
    {/if}

    <section class="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {#each rooms.filter((room) => !room.archived) as room (room.id)}
        <article class="panel p-6">
          <a
            class="group block hover:text-[#e85d43]"
            href="/app/class/{room.id}"
          >
            <p class="text-sm text-slate-500">{room.schoolYear}</p>
            <h2 class="mt-2 text-2xl">{room.name}</h2>
            <p class="mt-6">
              {room.studentCount} student{room.studentCount === 1 ? "" : "s"}
            </p>
            <p class="mt-1 text-sm text-slate-500">
              {room.lastActivity
                ? `Last activity ${new Date(room.lastActivity).toLocaleDateString()}`
                : "No activity yet"} · {room.currencyName}
            </p>
          </a>
        </article>
      {/each}
      {#if !rooms.some((room) => !room.archived)}
        <div class="panel p-6">
          No active classrooms yet. Use “Create a classroom” above.
        </div>
      {/if}
    </section>

    <details class="panel p-5">
      <summary class="cursor-pointer text-lg font-bold"
        >Archived classrooms & school years</summary
      >
      <div class="mt-5 grid gap-4">
        {#each rooms.filter((room) => room.archived) as room (room.id)}
          <article class="rounded-xl bg-black/5 p-4">
            <a
              class="font-bold hover:text-[#e85d43]"
              href="/app/class/{room.id}">{room.name} · {room.schoolYear}</a
            >
          </article>
        {/each}
      </div>
    </details>

    <details class="panel p-5">
      <summary class="cursor-pointer text-lg font-bold"
        >End-of-year tools</summary
      >
      <p class="mt-3 text-sm text-slate-600">
        Archive, restore, or permanently delete individual classes here.
        Deleting a school year permanently removes every archived class in that
        year.
      </p>
      <div class="mt-5 grid gap-4">
        <section>
          <h2 class="text-lg font-bold">Individual classes</h2>
          <div class="mt-3 grid gap-3">
            {#each rooms as room (room.id)}
              <div
                class="grid gap-3 rounded-xl border border-black/10 p-4 md:grid-cols-[1fr_auto]"
              >
                <div>
                  <strong>{room.name}</strong>
                  <p class="mt-1 text-sm text-slate-600">
                    {room.schoolYear} · {room.archived ? "Archived" : "Active"}
                  </p>
                </div>
                <ClassroomActions
                  classroomId={room.id}
                  classroomName={room.name}
                  archived={room.archived}
                  onDone={() => void classes.reload()}
                />
              </div>
            {/each}
          </div>
        </section>
        <section>
          <h2 class="text-lg font-bold">School years</h2>
          <div class="mt-3 grid gap-4">
            {#each years as year (year)}
              <div
                class="grid gap-3 rounded-xl border border-black/10 p-4 md:grid-cols-[1fr_auto]"
              >
                <strong>{year}</strong>
                <form
                  onsubmit={(event) => removeYear(event, year)}
                  class="grid gap-2 sm:grid-cols-[1fr_auto]"
                >
                  <input
                    class="field"
                    name="confirmation"
                    placeholder="DELETE {year}"
                    required
                  />
                  <button class="btn bg-red-700">Delete all classes</button>
                </form>
              </div>
            {/each}
          </div>
        </section>
      </div>
    </details>
  </div>

  <NewClassroomDialog
    bind:open={creating}
    teacherId={session.teacher.id}
    onCreated={(classroomId) => goto(`/app/class/${classroomId}`)}
  />
{/if}
