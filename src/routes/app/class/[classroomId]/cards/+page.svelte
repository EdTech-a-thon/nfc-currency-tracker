<script lang="ts">
  import { page } from "$app/state";
  import BulkCardManager from "$lib/components/BulkCardManager.svelte";
  import StudentCardAssignments from "$lib/components/StudentCardAssignments.svelte";
  import {
    autoAssignCards,
    cardUrl,
    generateCards,
    resetAssignments,
  } from "$lib/api";
  import {
    pb,
    readableError,
    type Card,
    type CardAssignment,
    type Classroom,
    type Student,
  } from "$lib/pocketbase";
  import { createLoader, requireTeacher } from "$lib/session.svelte";

  const byLabel = (first: Card, second: Card) =>
    Number(first.label) - Number(second.label) ||
    first.label.localeCompare(second.label, undefined, { numeric: true });

  const session = requireTeacher();
  const classroomId = $derived(page.params.classroomId ?? "");
  let message = $state("");

  const screen = createLoader(async () => {
    const id = classroomId;
    const [classroom, students, cards, openAssignments] = await Promise.all([
      pb.collection("classrooms").getOne<Classroom>(id),
      pb.collection("students").getFullList<Student>({
        filter: `classroom = "${id}" && active = true`,
        sort: "displayName",
      }),
      pb.collection("cards").getFullList<Card>(),
      pb
        .collection("card_assignments")
        .getFullList<CardAssignment & { expand?: { student?: Student } }>({
          filter: "endedAt = null",
          expand: "student",
        }),
    ]);
    const classrooms = await pb
      .collection("classrooms")
      .getFullList<Classroom>();
    const classroomNames = new Map(
      classrooms.map((room) => [room.id, room.name]),
    );
    const holderByCard = new Map(
      openAssignments.map((row) => [row.card, row.expand?.student ?? null]),
    );
    const cardByStudent = new Map(
      openAssignments.map((row) => [row.student, row.card]),
    );
    return {
      classroom,
      students,
      cards: [...cards].sort(byLabel),
      holderByCard,
      cardByStudent,
      classroomNames,
    };
  });

  $effect(() => {
    if (session.teacher && classroomId) void screen.reload();
  });

  async function guard(work: () => Promise<void>, done: string) {
    try {
      await work();
      message = done;
      void screen.reload();
    } catch (problem) {
      message = readableError(problem);
    }
  }

  function generate(event: SubmitEvent) {
    event.preventDefault();
    const count = Number(
      new FormData(event.currentTarget as HTMLFormElement).get("count"),
    );
    void guard(
      () => generateCards(count).then(() => undefined),
      `Created ${count} card${count === 1 ? "" : "s"}.`,
    );
  }
</script>

{#if session.teacher}
  {#if screen.state.error}
    <p class="panel p-8">{screen.state.error}</p>
  {:else if !screen.state.data}
    <p class="panel p-8">Loading your cards...</p>
  {:else}
    {@const {
      classroom,
      students,
      cards,
      holderByCard,
      cardByStudent,
      classroomNames,
    } = screen.state.data}
    {@const cardById = new Map(cards.map((card) => [card.id, card]))}
    {@const available = cards.filter((card) => card.status === "AVAILABLE")}
    <div class="grid gap-6">
      <div>
        <p class="font-bold text-[#e85d43]">Reusable card set</p>
        <h1 class="text-4xl">Cards for {classroom.name}</h1>
        <p class="mt-2 max-w-3xl text-slate-600">
          A permanent URL belongs to each numbered card, not to a student. Write
          Card #1’s URL to physical Card #1 once. When you assign Card #1 below,
          that same URL immediately opens the assigned student. Reassigning it
          later requires no NFC rewrite.
        </p>
      </div>

      {#if message}
        <p
          class="rounded-xl bg-[#cde7d8] p-4 font-bold text-green-900"
          role="status"
        >
          {message}
        </p>
      {/if}

      <div class="panel grid gap-3 p-5 md:grid-cols-2">
        <a
          class="rounded-xl bg-[#fff0e8] p-4"
          href="/app/class/{classroomId}/cards/encoding"
        >
          <strong class="block text-lg">1. Write NFC cards</strong>
          <span class="text-sm"
            >Copy each URL into NFC Tools and write the matching physical card.</span
          >
        </a>
        <div class="rounded-xl bg-[#cde7d8] p-4">
          <strong class="block text-lg">2. Assign students</strong>
          <span class="text-sm"
            >Choose the numbered card beside each student below.</span
          >
        </div>
      </div>

      <section class="grid grid-cols-2 gap-3 md:grid-cols-4">
        {#each [["Available", available.length], ["Assigned", cards.filter((card) => card.status === "ASSIGNED").length], ["Lost", cards.filter((card) => card.status === "LOST").length], ["Retired", cards.filter((card) => card.status === "RETIRED").length]] as [name, count] (name)}
          <div class="panel p-4">
            <p class="text-sm text-slate-500">{name}</p>
            <p class="display text-3xl">{count}</p>
          </div>
        {/each}
      </section>

      {#if !classroom.archived}
        <form
          onsubmit={generate}
          class="panel flex flex-wrap items-end gap-3 p-5"
        >
          <label class="label">
            New cards<input
              class="field max-w-32"
              type="number"
              name="count"
              min="1"
              max="200"
              value="30"
              required
            />
          </label>
          <button class="btn btn-accent">Generate card set</button>
          <span class="text-sm text-slate-600">
            Permanent tokens and labels continue from the highest existing
            number.
          </span>
        </form>
      {/if}

      <StudentCardAssignments
        students={students.map((student) => {
          const card = cardById.get(cardByStudent.get(student.id) ?? "");
          return {
            id: student.id,
            displayName: student.displayName,
            card: card
              ? {
                  id: card.id,
                  label: card.label,
                  shortCode: card.shortCode,
                  url: cardUrl(card.token),
                }
              : null,
          };
        })}
        availableCards={available.map((card) => ({
          id: card.id,
          label: card.label,
          shortCode: card.shortCode,
        }))}
        onChanged={() => void screen.reload()}
      />

      {#if !classroom.archived}
        <div class="flex flex-wrap gap-3">
          <button
            class="btn btn-accent"
            onclick={() =>
              guard(
                () => autoAssignCards(classroomId).then(() => undefined),
                "Cards assigned in order.",
              )}
          >
            Sequential auto-assign
          </button>
          <button
            class="btn bg-red-700"
            onclick={() =>
              guard(
                () => resetAssignments(classroomId).then(() => undefined),
                "All assignments in this class ended.",
              )}
          >
            End all assignments in this class
          </button>
        </div>
      {/if}

      <BulkCardManager
        cards={cards.map((card) => {
          const holder = holderByCard.get(card.id) ?? null;
          return {
            id: card.id,
            label: card.label,
            shortCode: card.shortCode,
            status: card.status,
            studentName: holder?.displayName ?? null,
            studentClassroom: holder?.classroom
              ? (classroomNames.get(holder.classroom) ?? null)
              : null,
          };
        })}
        onChanged={() => void screen.reload()}
      />
    </div>
  {/if}
{/if}
