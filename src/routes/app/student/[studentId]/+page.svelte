<script lang="ts">
  import { page } from "$app/state";
  import { postEntry, undoEntry } from "$lib/api";
  import { MAX_LAST_LETTERS } from "$lib/names";
  import {
    pb,
    readableError,
    type Card,
    type CardAssignment,
    type Classroom,
    type Student,
    type Transaction,
  } from "$lib/pocketbase";
  import { createLoader, requireTeacher } from "$lib/session.svelte";

  const session = requireTeacher();
  const studentId = $derived(page.params.studentId ?? "");
  let message = $state("");

  const screen = createLoader(async () => {
    const id = studentId;
    const student = await pb.collection("students").getOne<Student>(id);
    const [classroom, transactions, assignments] = await Promise.all([
      student.classroom
        ? pb.collection("classrooms").getOne<Classroom>(student.classroom)
        : Promise.resolve(null),
      pb.collection("transactions").getFullList<Transaction>({
        filter: `student = "${id}"`,
        sort: "-created",
      }),
      pb
        .collection("card_assignments")
        .getFullList<CardAssignment & { expand?: { card?: Card } }>({
          filter: `student = "${id}" && endedAt = null`,
          expand: "card",
        }),
    ]);
    return {
      student,
      classroom,
      transactions,
      card: assignments[0]?.expand?.card ?? null,
    };
  });

  $effect(() => {
    if (session.teacher && studentId) void screen.reload();
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

  async function adjust(event: SubmitEvent) {
    event.preventDefault();
    const form = event.currentTarget as HTMLFormElement;
    const values = new FormData(form);
    const size = Number(values.get("amount"));
    const amount = String(values.get("direction")) === "remove" ? -size : size;
    await guard(async () => {
      await postEntry({
        studentId,
        amount,
        reason: String(values.get("reason")).trim(),
        kind: "ADJUSTMENT",
        idempotencyKey: crypto.randomUUID(),
      });
      form.reset();
    }, "Adjustment posted.");
  }

  function saveName(event: SubmitEvent) {
    event.preventDefault();
    const values = new FormData(event.currentTarget as HTMLFormElement);
    const first = String(values.get("firstName")).trim();
    const last = String(values.get("lastLetters"))
      .trim()
      .slice(0, MAX_LAST_LETTERS);
    if (!first) {
      message = "Enter a first name.";
      return;
    }
    void guard(
      () =>
        pb
          .collection("students")
          .update(studentId, { displayName: last ? `${first} ${last}` : first })
          .then(() => undefined),
      "Name saved.",
    );
  }

  // Stored names are already "first name plus a few last letters", so the last
  // space is the split point.
  function splitStored(displayName: string) {
    const gap = displayName.lastIndexOf(" ");
    return gap === -1
      ? { first: displayName, last: "" }
      : {
          first: displayName.slice(0, gap),
          last: displayName.slice(gap + 1),
        };
  }
</script>

{#if session.teacher}
  {#if screen.state.error}
    <p class="panel p-8">{screen.state.error}</p>
  {:else if !screen.state.data}
    <p class="panel p-8">Loading student...</p>
  {:else}
    {@const { student, classroom, transactions, card } = screen.state.data}
    {@const total = transactions.reduce((sum, entry) => sum + entry.amount, 0)}
    {@const stored = splitStored(student.displayName)}
    <div class="grid gap-6">
      {#if message}
        <p
          class="rounded-xl bg-[#cde7d8] p-4 font-bold text-green-900"
          role="status"
        >
          {message}
        </p>
      {/if}

      <section class="panel overflow-hidden">
        <div class="bg-[#23312c] p-7 text-white">
          <p>{classroom?.name ?? "Unassigned"}</p>
          <h1 class="mt-2 text-4xl">{student.displayName}</h1>
          <p class="display mt-5 text-6xl text-[#f9bd72]">
            {classroom?.currencySymbol}{total}
          </p>
        </div>
        <div class="grid gap-4 p-5 md:grid-cols-2">
          <p>
            Assigned card: <strong
              >{card ? `#${card.label} · ${card.shortCode}` : "None"}</strong
            >
          </p>
          <form
            onsubmit={saveName}
            class="grid gap-2 sm:grid-cols-[1fr_88px_auto]"
          >
            <input
              class="field"
              name="firstName"
              value={stored.first}
              aria-label="First name"
              placeholder="First name"
              required
            />
            <input
              class="field"
              name="lastLetters"
              value={stored.last}
              aria-label="Last name letters"
              placeholder="Ch"
              maxlength={MAX_LAST_LETTERS}
            />
            <button class="btn btn-soft">Save name</button>
          </form>
          <button
            class="btn btn-soft"
            onclick={() =>
              guard(
                () =>
                  pb
                    .collection("students")
                    .update(studentId, { active: !student.active })
                    .then(() => undefined),
                student.active
                  ? "Student deactivated."
                  : "Student reactivated.",
              )}
          >
            {student.active ? "Deactivate student" : "Reactivate student"}
          </button>
        </div>
      </section>

      {#if student.active && classroom && !classroom.archived}
        <form
          onsubmit={adjust}
          class="panel grid gap-3 p-5 md:grid-cols-[140px_140px_1fr_auto]"
        >
          <select class="field" name="direction">
            <option value="add">Add</option>
            <option value="remove">Remove</option>
          </select>
          <input
            class="field"
            type="number"
            min="1"
            step="1"
            name="amount"
            placeholder="Amount"
            required
          />
          <input
            class="field"
            name="reason"
            placeholder="Required reason"
            required
          />
          <button class="btn btn-accent">Post adjustment</button>
        </form>
      {/if}

      <section class="panel overflow-hidden">
        <h2 class="p-5 text-2xl">Transaction history</h2>
        {#each transactions as entry (entry.id)}
          <div
            class="grid grid-cols-[1fr_auto] gap-3 border-t border-black/10 p-4"
          >
            <div>
              {#if entry.reason}<strong>{entry.reason}</strong>{/if}
              <p class="text-sm text-slate-500">
                {entry.kind} · {new Date(entry.created).toLocaleString()}
              </p>
            </div>
            <div class="text-right">
              <span
                class="display text-xl {entry.amount > 0
                  ? 'text-green-700'
                  : 'text-red-700'}"
              >
                {entry.amount > 0 ? "+" : ""}{entry.amount}
              </span>
              {#if !classroom?.archived && entry.kind !== "CORRECTION"}
                <button
                  class="mt-1 block text-xs underline"
                  onclick={() =>
                    guard(
                      () => undoEntry(entry.id).then(() => undefined),
                      "Entry removed.",
                    )}
                >
                  Undo
                </button>
              {/if}
            </div>
          </div>
        {/each}
        {#if !transactions.length}
          <p class="p-8 text-center">No transactions yet.</p>
        {/if}
      </section>
    </div>
  {/if}
{/if}
