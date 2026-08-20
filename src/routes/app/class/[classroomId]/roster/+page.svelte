<script lang="ts">
  import { page } from "$app/state";
  import RosterInput from "$lib/components/RosterInput.svelte";
  import DeleteClassroomButton from "$lib/components/DeleteClassroomButton.svelte";
  import { MAX_LAST_LETTERS, shortenRoster, splitNames } from "$lib/names";
  import { fetchBalances, removeStudents, resetAssignments } from "$lib/api";
  import {
    pb,
    readableError,
    type AwardPreset,
    type Card,
    type CardAssignment,
    type Classroom,
    type Student,
    type Transaction,
  } from "$lib/pocketbase";
  import { createLoader, requireTeacher } from "$lib/session.svelte";

  type Row = Student & { balance: number; cardLabel: string | null };

  const session = requireTeacher();
  const classroomId = $derived(page.params.classroomId ?? "");
  let sort = $state<"name" | "balance">("name");
  let selected = $state<string[]>([]);
  let destinationId = $state("");
  let message = $state("");
  let roster = $state("");

  const screen = createLoader(async () => {
    const id = classroomId;
    const classroom = await pb.collection("classrooms").getOne<Classroom>(id);
    const [students, destinations, presets, balances, assignments] =
      await Promise.all([
        pb
          .collection("students")
          .getFullList<Student>({ filter: `classroom = "${id}"` }),
        pb.collection("classrooms").getFullList<Classroom>({
          filter: `archived = false && id != "${id}"`,
          sort: "name",
        }),
        pb.collection("award_presets").getFullList<AwardPreset>({
          filter: `classroom = "${id}"`,
          sort: "sortOrder",
        }),
        fetchBalances(id),
        pb
          .collection("card_assignments")
          .getFullList<CardAssignment & { expand?: { card?: Card } }>({
            filter: `student.classroom = "${id}" && endedAt = null`,
            expand: "card",
          }),
      ]);
    const cardByStudent = new Map(
      assignments.map((row) => [row.student, row.expand?.card?.label ?? null]),
    );
    const rows: Row[] = students.map((student) => ({
      ...student,
      balance: balances.balances[student.id] ?? 0,
      cardLabel: cardByStudent.get(student.id) ?? null,
    }));
    return { classroom, destinations, presets, rows };
  });

  $effect(() => {
    if (session.teacher && classroomId) void screen.reload();
  });

  const rows = $derived(
    [...(screen.state.data?.rows ?? [])].sort(
      sort === "balance"
        ? (first, second) => second.balance - first.balance
        : (first, second) =>
            first.displayName.localeCompare(second.displayName),
    ),
  );

  async function guard(work: () => Promise<void>, done: string) {
    try {
      await work();
      message = done;
      selected = [];
      void screen.reload();
    } catch (problem) {
      message = readableError(problem);
    }
  }

  // Names already in the class, so a new student never lands on a name that is
  // impossible to tell apart from someone else's.
  const takenNames = $derived(
    (screen.state.data?.rows ?? []).map((student) => student.displayName),
  );
  const rosterNames = $derived(shortenRoster(splitNames(roster), takenNames));

  async function saveStudents(names: string[]) {
    await guard(
      async () => {
        for (const displayName of names.slice(0, 200))
          await pb.collection("students").create({
            teacher: session.teacher!.id,
            classroom: classroomId,
            displayName,
            active: true,
          });
      },
      `Added ${names.length} student${names.length === 1 ? "" : "s"}.`,
    );
  }

  async function addStudents(event: SubmitEvent) {
    event.preventDefault();
    if (!rosterNames.length) {
      message = "Add at least one name.";
      return;
    }
    await saveStudents(rosterNames);
    roster = "";
  }

  async function addOneStudent(event: SubmitEvent) {
    event.preventDefault();
    const form = event.currentTarget as HTMLFormElement;
    const values = new FormData(form);
    const first = String(values.get("firstName")).trim();
    const last = String(values.get("lastLetters"))
      .trim()
      .slice(0, MAX_LAST_LETTERS);
    if (!first) {
      message = "Enter a first name.";
      return;
    }
    await saveStudents([last ? `${first} ${last}` : first]);
    form.reset();
  }

  async function moveSelected() {
    if (!destinationId) {
      message = "Choose a destination class.";
      return;
    }
    if (!selected.length) {
      message = "Select at least one student.";
      return;
    }
    const moving = selected;
    await guard(async () => {
      for (const studentId of moving)
        await pb
          .collection("students")
          .update(studentId, { classroom: destinationId });
    }, "Students moved.");
  }

  async function removeSelected() {
    if (!selected.length) {
      message = "Select at least one student.";
      return;
    }
    await guard(
      () => removeStudents(classroomId, selected).then(() => undefined),
      "Students removed from this class.",
    );
  }

  async function saveClassroom(event: SubmitEvent) {
    event.preventDefault();
    const form = new FormData(event.currentTarget as HTMLFormElement);
    await guard(async () => {
      await pb.collection("classrooms").update(classroomId, {
        name: String(form.get("name")).trim(),
        schoolYear: String(form.get("schoolYear")).trim(),
        currencyName: String(form.get("currencyName")).trim(),
        currencySymbol:
          String(form.get("currencySymbol")).trim().slice(0, 4) || "$",
      });
    }, "Classroom settings saved.");
  }

  async function savePreset(event: SubmitEvent, presetId?: string) {
    event.preventDefault();
    const form = event.currentTarget as HTMLFormElement;
    const values = new FormData(form);
    const payload = {
      label: String(values.get("label")).trim(),
      amount: Number(values.get("amount")),
    };
    await guard(async () => {
      if (presetId)
        await pb.collection("award_presets").update(presetId, payload);
      else
        await pb.collection("award_presets").create({
          classroom: classroomId,
          ...payload,
          sortOrder: screen.state.data?.presets.length ?? 0,
        });
      form.reset();
    }, "Award preset saved.");
  }

  async function exportTransactions() {
    const entries = await pb
      .collection("transactions")
      .getFullList<Transaction & { expand?: { student?: Student } }>({
        filter: `classroom = "${classroomId}"`,
        sort: "-created",
        expand: "student",
      });
    const cell = (value: string | number) =>
      `"${String(value).replace(/"/g, '""')}"`;
    const csv = [
      ["Date", "Student", "Amount", "Kind", "Reason"].map(cell).join(","),
      ...entries.map((entry) =>
        [
          new Date(entry.created).toLocaleString(),
          entry.expand?.student?.displayName ?? "",
          entry.amount,
          entry.kind,
          entry.reason,
        ]
          .map(cell)
          .join(","),
      ),
    ].join("\n");
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    link.download = `transactions-${screen.state.data?.classroom.name ?? "class"}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  }

  function toggleStudent(studentId: string, checked: boolean) {
    selected = checked
      ? [...selected, studentId]
      : selected.filter((id) => id !== studentId);
  }
</script>

{#if session.teacher}
  {#if screen.state.error}
    <p class="panel p-8">{screen.state.error}</p>
  {:else if !screen.state.data}
    <p class="panel p-8">Loading your roster...</p>
  {:else}
    {@const { classroom, destinations, presets } = screen.state.data}
    <div class="grid gap-6">
      <div>
        <p class="font-bold text-[#e85d43]">{classroom.name}</p>
        <h1 class="text-4xl">Roster</h1>
      </div>

      {#if message}
        <p
          class="rounded-xl bg-[#cde7d8] p-4 font-bold text-green-900"
          role="status"
        >
          {message}
        </p>
      {/if}

      <div class="grid grid-cols-2 gap-2 sm:flex">
        <button class="btn btn-soft" onclick={() => (sort = "name")}
          >Sort A-Z</button
        >
        <button class="btn btn-soft" onclick={() => (sort = "balance")}
          >Sort by balance</button
        >
        <button class="btn col-span-2" onclick={exportTransactions}
          >Export transactions</button
        >
        <DeleteClassroomButton {classroomId} classroomName={classroom.name} />
      </div>

      {#if !classroom.archived}
        <section class="panel p-5">
          <h2 class="text-lg font-bold">Add a student</h2>
          <form
            onsubmit={addOneStudent}
            class="mt-4 grid gap-3 md:grid-cols-[1fr_160px_auto]"
          >
            <label class="label">
              First name
              <input
                class="field"
                name="firstName"
                placeholder="Maya"
                required
              />
            </label>
            <label class="label">
              Last name letters
              <input
                class="field"
                name="lastLetters"
                placeholder="Ch"
                maxlength={MAX_LAST_LETTERS}
              />
            </label>
            <button class="btn btn-accent md:self-end">Add student</button>
          </form>
          <p class="mt-2 text-sm text-slate-600">
            Use one letter unless you need two or three to tell students apart,
            such as Maya Ch and Maya Ce.
          </p>
        </section>

        <details class="panel p-5">
          <summary class="font-bold">Add several students at once</summary>
          <form onsubmit={addStudents} class="mt-4 grid gap-3">
            <RosterInput bind:value={roster} names={rosterNames} />
            <button class="btn btn-accent">Add students</button>
          </form>
        </details>
      {/if}

      <section class="panel overflow-hidden">
        <div
          class="grid gap-3 border-b border-black/10 p-4 md:grid-cols-[1fr_240px_auto_auto]"
        >
          <strong>{selected.length} selected</strong>
          <select
            class="field"
            bind:value={destinationId}
            aria-label="Destination class"
          >
            <option value="">Destination class</option>
            {#each destinations as room (room.id)}<option value={room.id}
                >{room.name}</option
              >{/each}
          </select>
          <button class="btn" onclick={moveSelected}>Move selected</button>
          <button class="btn btn-soft text-red-700" onclick={removeSelected}
            >Remove selected</button
          >
        </div>
        {#each rows as student (student.id)}
          <div
            class="grid min-h-20 grid-cols-[28px_1fr_auto] items-center gap-3 border-b border-black/5 px-4 py-3 sm:grid-cols-[28px_1fr_auto_auto]"
          >
            <input
              class="h-5 w-5"
              aria-label="Select {student.displayName}"
              type="checkbox"
              checked={selected.includes(student.id)}
              onchange={(event) =>
                toggleStudent(student.id, event.currentTarget.checked)}
            />
            <span>
              <a class="font-bold underline" href="/app/student/{student.id}"
                >{student.displayName}</a
              >
              <a class="ml-2 text-sm underline" href="/app/student/{student.id}"
                >Edit name</a
              >
              {#if !student.active}<small class="ml-2 text-red-700"
                  >Inactive</small
                >{/if}
              <small class="mt-1 block text-slate-500 sm:hidden">
                {student.cardLabel ? `Card ${student.cardLabel}` : "No card"}
              </small>
            </span>
            <span class="display text-xl"
              >{classroom.currencySymbol}{student.balance}</span
            >
            <span class="hidden text-sm sm:block"
              >{student.cardLabel
                ? `Card ${student.cardLabel}`
                : "No card"}</span
            >
          </div>
        {/each}
        {#if !rows.length}
          <p class="p-8 text-center">No students are in this classroom.</p>
        {/if}
      </section>

      <details class="panel p-5">
        <summary class="font-bold">Classroom settings</summary>
        <form onsubmit={saveClassroom} class="mt-4 grid gap-3 md:grid-cols-5">
          <input class="field" name="name" value={classroom.name} required />
          <input
            class="field"
            name="schoolYear"
            value={classroom.schoolYear}
            required
          />
          <input
            class="field"
            name="currencyName"
            value={classroom.currencyName}
            required
          />
          <input
            class="field"
            name="currencySymbol"
            value={classroom.currencySymbol}
            required
          />
          <button class="btn">Save</button>
        </form>

        <h3 class="mt-6 text-lg">Award presets</h3>
        <div class="mt-2 grid gap-2">
          <div
            class="hidden grid-cols-[1fr_100px_auto] gap-2 px-1 text-xs font-bold uppercase tracking-wide text-slate-600 md:grid"
          >
            <span>Label</span><span>Amount</span><span>Action</span>
          </div>
          {#each presets as preset (preset.id)}
            <form
              onsubmit={(event) => savePreset(event, preset.id)}
              class="grid gap-2 md:grid-cols-[1fr_100px_auto]"
            >
              <input
                class="field"
                name="label"
                value={preset.label}
                aria-label="Preset label"
              />
              <input
                class="field"
                name="amount"
                type="number"
                min="1"
                value={preset.amount}
                aria-label="Preset amount"
              />
              <button class="btn btn-soft">Save</button>
            </form>
          {/each}
          {#if !classroom.archived}
            <form
              onsubmit={(event) => savePreset(event)}
              class="grid gap-2 md:grid-cols-[1fr_100px_auto]"
            >
              <input
                class="field"
                name="label"
                placeholder="New preset"
                required
                aria-label="New preset label"
              />
              <input
                class="field"
                name="amount"
                type="number"
                min="1"
                placeholder="Amount"
                required
                aria-label="New preset amount"
              />
              <button class="btn">Add</button>
            </form>
          {/if}
        </div>

        <div class="mt-5 flex flex-wrap gap-3">
          <button
            class="btn btn-soft"
            onclick={() =>
              guard(
                async () => {
                  await pb.collection("classrooms").update(classroomId, {
                    archived: !classroom.archived,
                    archivedAt: classroom.archived
                      ? ""
                      : new Date().toISOString(),
                  });
                },
                classroom.archived
                  ? "Classroom restored."
                  : "Classroom archived.",
              )}
          >
            {classroom.archived ? "Restore classroom" : "Archive classroom"}
          </button>
          {#if !classroom.archived}
            <button
              class="btn btn-soft"
              onclick={() =>
                guard(
                  () => resetAssignments(classroomId).then(() => undefined),
                  "Card assignments removed.",
                )}
            >
              Remove all card assignments
            </button>
          {/if}
        </div>
      </details>
    </div>
  {/if}
{/if}
