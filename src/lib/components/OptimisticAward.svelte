<script lang="ts">
  import { awardMany, undoEntry } from "$lib/api";
  import { readableError } from "$lib/pocketbase";

  type Student = { id: string; displayName: string; balance: number };
  type Preset = { id: string; label: string; amount: number };
  type Pending = {
    key: string;
    studentIds: string[];
    amount: number;
    reason: string;
    status: "syncing" | "failed";
  };
  type LastAward = Pending & { count: number; transactionIds: string[] };

  const CACHE = "nfc-roster-cache";
  const QUEUE = "nfc-award-queue";
  const VIEW = "nfc-student-view";

  let {
    classroomId,
    students: initial,
    presets,
    symbol,
  }: {
    classroomId: string;
    students: Student[];
    presets: Preset[];
    symbol: string;
  } = $props();

  let students = $state<Student[]>([]);
  let selected = $state<string[]>([]);
  let pending = $state<Pending[]>([]);
  let slowSyncKeys = $state<string[]>([]);
  let reason = $state("");
  let message = $state("");
  let lastAward = $state<LastAward | null>(null);
  let customAmount = $state<number | null>(null);
  let view = $state<"cards" | "list">("cards");
  let awardTimer: number | undefined;
  const syncTimers = new Map<string, number>();

  const unsynced = $derived(
    pending.filter(
      (item) => item.status === "failed" || slowSyncKeys.includes(item.key),
    ),
  );

  $effect(() => {
    const cached = localStorage.getItem(`${CACHE}-${classroomId}`);
    if (cached) students = JSON.parse(cached);
    students = initial;
    localStorage.setItem(`${CACHE}-${classroomId}`, JSON.stringify(initial));
    const queued = JSON.parse(localStorage.getItem(QUEUE) ?? "[]") as Pending[];
    pending = queued.filter((item) => item.status === "failed");
    view = localStorage.getItem(VIEW) === "list" ? "list" : "cards";
  });

  $effect(() => {
    const markOnline = () =>
      (message = "Connection restored. Tap Retry all to sync waiting awards.");
    window.addEventListener("online", markOnline);
    return () => window.removeEventListener("online", markOnline);
  });

  function readQueue() {
    return JSON.parse(localStorage.getItem(QUEUE) ?? "[]") as Pending[];
  }

  async function send(item: Pending) {
    window.clearTimeout(syncTimers.get(item.key));
    syncTimers.set(
      item.key,
      window.setTimeout(() => {
        if (!slowSyncKeys.includes(item.key))
          slowSyncKeys = [...slowSyncKeys, item.key];
      }, 4000),
    );
    pending = [
      ...pending.filter((row) => row.key !== item.key),
      { ...item, status: "syncing" },
    ];
    try {
      const result = await awardMany({
        studentIds: item.studentIds,
        amount: item.amount,
        reason: item.reason,
        idempotencyKey: item.key,
      });
      window.clearTimeout(syncTimers.get(item.key));
      syncTimers.delete(item.key);
      pending = pending.filter((row) => row.key !== item.key);
      slowSyncKeys = slowSyncKeys.filter((key) => key !== item.key);
      localStorage.setItem(
        QUEUE,
        JSON.stringify(readQueue().filter((row) => row.key !== item.key)),
      );
      if (lastAward?.key === item.key)
        lastAward = { ...lastAward, transactionIds: result.transactionIds };
      message = `Saved for ${item.studentIds.length} student${item.studentIds.length === 1 ? "" : "s"}.`;
    } catch (error) {
      window.clearTimeout(syncTimers.get(item.key));
      syncTimers.delete(item.key);
      const failed = { ...item, status: "failed" as const };
      pending = [...pending.filter((row) => row.key !== item.key), failed];
      localStorage.setItem(
        QUEUE,
        JSON.stringify([
          ...readQueue().filter((row) => row.key !== item.key),
          failed,
        ]),
      );
      message = readableError(error, "Award waiting to retry.");
    }
  }

  async function undoLastAward() {
    if (!lastAward?.transactionIds.length) return;
    const award = lastAward;
    window.clearTimeout(awardTimer);
    lastAward = null;
    students = students.map((student) =>
      award.studentIds.includes(student.id)
        ? { ...student, balance: student.balance - award.amount }
        : student,
    );
    try {
      for (const transactionId of award.transactionIds)
        await undoEntry(transactionId);
      message = "Award removed.";
    } catch (error) {
      students = students.map((student) =>
        award.studentIds.includes(student.id)
          ? { ...student, balance: student.balance + award.amount }
          : student,
      );
      message = readableError(error, "Could not undo the award.");
    }
  }

  function award(awardAmount: number, presetLabel = "") {
    if (!selected.length) {
      message = "Choose at least one student first.";
      return;
    }
    const count = selected.length;
    const item: Pending = {
      key: crypto.randomUUID(),
      studentIds: selected,
      amount: awardAmount,
      reason: reason.trim() || presetLabel,
      status: "syncing",
    };
    students = students.map((student) =>
      selected.includes(student.id)
        ? { ...student, balance: student.balance + awardAmount }
        : student,
    );
    lastAward = { ...item, count, transactionIds: [] };
    window.clearTimeout(awardTimer);
    awardTimer = window.setTimeout(() => (lastAward = null), 4000);
    selected = [];
    reason = "";
    message = `Added +${awardAmount} to ${count} student${count === 1 ? "" : "s"}.`;
    void send(item);
  }

  function awardCustom() {
    const amount = Number(customAmount);
    if (!Number.isInteger(amount) || amount < 1 || amount > 100000) {
      message = "Enter a whole-number award amount.";
      return;
    }
    award(amount);
    customAmount = null;
  }

  function changeView(nextView: "cards" | "list") {
    view = nextView;
    localStorage.setItem(VIEW, nextView);
  }

  function toggleStudent(studentId: string) {
    selected = selected.includes(studentId)
      ? selected.filter((id) => id !== studentId)
      : [...selected, studentId];
  }
</script>

<div class="grid gap-5">
  {#if unsynced.length}
    <div
      class="sticky top-24 z-20 flex items-center justify-between rounded-xl bg-amber-200 p-3 font-bold"
    >
      <span
        >{unsynced.length} action{unsynced.length === 1 ? "" : "s"} not synced</span
      >
      <button
        class="btn"
        onclick={() => pending.forEach((item) => void send(item))}
        >Retry all</button
      >
    </div>
  {/if}

  {#if lastAward}
    <div
      class="sticky top-24 z-20 flex items-center justify-between gap-3 rounded-2xl bg-green-700 p-4 text-white shadow-lg"
      role="status"
      aria-live="assertive"
    >
      <div>
        <strong class="block text-2xl">Money added</strong>
        <span class="text-lg">
          +{symbol}{lastAward.amount} for {lastAward.count} student{lastAward.count ===
          1
            ? ""
            : "s"}
        </span>
      </div>
      <button
        class="btn btn-soft"
        onclick={undoLastAward}
        disabled={!lastAward.transactionIds.length}>Undo</button
      >
    </div>
  {/if}

  <div
    class="panel grid gap-3 p-4 md:sticky md:top-20 md:z-10 md:grid-cols-[1fr_auto]"
  >
    <input class="field" bind:value={reason} placeholder="Optional note" />
    <div class="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
      {#each presets as preset (preset.id)}
        <button
          class="btn btn-accent min-h-16 text-left"
          onclick={() => award(preset.amount, preset.label)}
        >
          <strong class="block text-lg">+{preset.amount}</strong>
          <span class="text-sm">{preset.label}</span>
        </button>
      {/each}
    </div>
    <div class="grid grid-cols-[1fr_auto] gap-2">
      <input
        class="field"
        type="number"
        inputmode="numeric"
        min="1"
        step="1"
        max="100000"
        bind:value={customAmount}
        onkeydown={(event) => event.key === "Enter" && awardCustom()}
        placeholder="Custom amount"
        aria-label="Custom award amount"
      />
      <button class="btn" onclick={awardCustom}>Award custom</button>
    </div>
    <div
      class="grid grid-cols-2 gap-2 md:flex md:justify-end"
      aria-label="Student view"
    >
      <button
        class="btn {view === 'cards' ? 'btn-accent' : 'btn-soft'}"
        aria-pressed={view === "cards"}
        onclick={() => changeView("cards")}
      >
        Cards
      </button>
      <button
        class="btn {view === 'list' ? 'btn-accent' : 'btn-soft'}"
        aria-pressed={view === "list"}
        onclick={() => changeView("list")}
      >
        List
      </button>
    </div>
    <p class="text-sm text-slate-600 md:col-span-2">
      {selected.length} selected · {message ||
        "Choose students, then tap an award."}
    </p>
  </div>

  {#if view === "cards"}
    <div
      class="grid grid-cols-1 gap-3 min-[390px]:grid-cols-2 sm:grid-cols-3 lg:grid-cols-4"
    >
      {#each students as student (student.id)}
        <div
          class="panel relative p-4 transition {selected.includes(student.id)
            ? 'border-[#e85d43] bg-[#fff0e8] ring-4 ring-[#e85d43]'
            : ''}"
        >
          {#if selected.includes(student.id)}
            <span
              class="absolute right-3 top-3 rounded-full bg-[#e85d43] px-2 py-1 text-xs font-bold text-white"
              >Selected</span
            >
          {/if}
          <button
            aria-pressed={selected.includes(student.id)}
            onclick={() => toggleStudent(student.id)}
            class="min-h-20 w-full text-left"
          >
            <span class="block font-bold">{student.displayName}</span>
            <span class="display mt-4 block text-3xl"
              >{symbol}{student.balance}</span
            >
          </button>
          <a
            href="/app/student/{student.id}"
            class="mt-2 inline-block text-xs underline">Details</a
          >
        </div>
      {/each}
    </div>
  {:else}
    <div class="panel overflow-hidden">
      {#each students as student (student.id)}
        <div
          class="grid grid-cols-[1fr_auto] items-center gap-3 border-b border-black/10 p-3 last:border-0 sm:grid-cols-[1fr_auto_auto] {selected.includes(
            student.id,
          )
            ? 'bg-[#fff0e8]'
            : ''}"
        >
          <button
            aria-pressed={selected.includes(student.id)}
            onclick={() => toggleStudent(student.id)}
            class="min-h-12 text-left font-bold"
          >
            <span
              class="mr-3 inline-block h-6 w-6 rounded-md border align-middle {selected.includes(
                student.id,
              )
                ? 'border-[#e85d43] bg-[#e85d43]'
                : 'border-black/30'}"
            ></span>
            {student.displayName}
          </button>
          <span class="display text-2xl">{symbol}{student.balance}</span>
          <a
            href="/app/student/{student.id}"
            class="btn btn-soft col-span-2 sm:col-span-1">Details</a
          >
        </div>
      {/each}
    </div>
  {/if}

  {#if !students.length}
    <div class="panel p-8 text-center">
      No active students yet. Add your roster to start awarding.
    </div>
  {/if}
</div>
