<script lang="ts">
  import { assignCard, unassignCard } from "$lib/api";
  import { readableError } from "$lib/pocketbase";

  type AvailableCard = { id: string; label: string; shortCode: string };
  type StudentCard = {
    id: string;
    label: string;
    shortCode: string;
    url: string;
  };
  type Student = { id: string; displayName: string; card: StudentCard | null };

  let {
    students,
    availableCards,
    onChanged,
  }: {
    students: Student[];
    availableCards: AvailableCard[];
    onChanged: () => void;
  } = $props();

  // svelte-ignore state_referenced_locally
  let openStudentId = $state<string | null>(
    students.find((student) => !student.card)?.id ?? students[0]?.id ?? null,
  );
  let copiedCardId = $state<string | null>(null);
  let busy = $state(false);

  const withoutCards = $derived(
    students.filter((student) => !student.card).length,
  );

  async function run(work: () => Promise<unknown>) {
    busy = true;
    try {
      await work();
      onChanged();
    } catch (problem) {
      window.alert(readableError(problem));
    } finally {
      busy = false;
    }
  }

  async function copyUrl(card: StudentCard) {
    try {
      await navigator.clipboard.writeText(card.url);
    } catch {
      const input = document.createElement("textarea");
      input.value = card.url;
      document.body.appendChild(input);
      input.select();
      document.execCommand("copy");
      input.remove();
    }
    copiedCardId = card.id;
    window.setTimeout(() => {
      if (copiedCardId === card.id) copiedCardId = null;
    }, 2500);
  }

  function assign(event: SubmitEvent, studentId: string) {
    event.preventDefault();
    const cardId = String(
      new FormData(event.currentTarget as HTMLFormElement).get("cardId"),
    );
    if (cardId) void run(() => assignCard(studentId, cardId));
  }

  function unassign(student: Student) {
    if (
      window.confirm(
        `Remove Card #${student.card?.label} from ${student.displayName}? The card will become available.`,
      )
    )
      void run(() => unassignCard(student.id));
  }
</script>

<section class="panel overflow-hidden">
  <div class="border-b border-black/10 p-5">
    <div class="flex flex-wrap items-center justify-between gap-2">
      <h2 class="text-2xl">Assign cards to students</h2>
      <span
        class="rounded-full px-3 py-1 text-sm font-bold {withoutCards
          ? 'bg-amber-200'
          : 'bg-[#cde7d8]'}"
      >
        {withoutCards} without cards
      </span>
    </div>
    <p class="mt-1 text-sm text-slate-600">
      Tap a student to assign, copy, or remove their physical card.
    </p>
  </div>
  <div>
    {#each students as student (student.id)}
      {@const open = openStudentId === student.id}
      <article class="border-b border-black/10 last:border-0">
        <button
          type="button"
          class="grid min-h-16 w-full grid-cols-[1fr_auto] items-center gap-3 px-4 py-3 text-left {open
            ? 'bg-[#fff0e8]'
            : ''}"
          onclick={() => (openStudentId = open ? null : student.id)}
          aria-expanded={open}
        >
          <span>
            <strong class="block">{student.displayName}</strong>
            <small class={student.card ? "text-green-700" : "text-amber-700"}>
              {student.card
                ? `Card #${student.card.label} · ${student.card.shortCode}`
                : "No card assigned"}
            </small>
          </span>
          <span class="text-xl" aria-hidden="true">{open ? "−" : "+"}</span>
        </button>
        {#if open}
          <div class="grid gap-3 border-t border-black/5 bg-white/60 p-4">
            {#if student.card}
              <div class="rounded-xl bg-[#cde7d8] p-4">
                <p class="text-sm font-bold uppercase tracking-wider">
                  Assigned physical card
                </p>
                <p class="display mt-1 text-3xl">Card #{student.card.label}</p>
                <p class="font-bold tracking-[.18em]">
                  {student.card.shortCode}
                </p>
              </div>
              <p class="truncate text-xs text-slate-500">{student.card.url}</p>
              <div class="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  class="btn {copiedCardId === student.card.id
                    ? 'bg-green-700'
                    : 'btn-accent'}"
                  onclick={() => copyUrl(student.card!)}
                >
                  {copiedCardId === student.card.id
                    ? "Copied!"
                    : "Copy NFC URL"}
                </button>
                <button
                  type="button"
                  class="btn btn-soft w-full"
                  disabled={busy}
                  onclick={() => unassign(student)}
                >
                  Remove card
                </button>
              </div>
            {:else}
              <form
                onsubmit={(event) => assign(event, student.id)}
                class="grid gap-2 sm:grid-cols-[1fr_auto]"
              >
                <label class="label">
                  Available physical card
                  <select class="field" name="cardId" required>
                    <option value="">Choose a card...</option>
                    {#each availableCards as card (card.id)}
                      <option value={card.id}
                        >Card #{card.label} · {card.shortCode}</option
                      >
                    {/each}
                  </select>
                </label>
                <button
                  class="btn btn-accent self-end"
                  disabled={!availableCards.length || busy}>Assign card</button
                >
                {#if !availableCards.length}
                  <p class="text-sm text-amber-700 sm:col-span-2">
                    No cards are available. Generate more cards or remove one
                    from another student.
                  </p>
                {/if}
              </form>
            {/if}
          </div>
        {/if}
      </article>
    {/each}
  </div>
  {#if !students.length}
    <p class="p-8 text-center">
      Add students to this classroom before assigning cards.
    </p>
  {/if}
</section>
