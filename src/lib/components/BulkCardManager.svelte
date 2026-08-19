<script lang="ts">
  import { setCardStatus } from "$lib/api";
  import { readableError } from "$lib/pocketbase";

  type CardRow = {
    id: string;
    label: string;
    shortCode: string;
    status: "AVAILABLE" | "ASSIGNED" | "LOST" | "RETIRED";
    studentName: string | null;
    studentClassroom: string | null;
  };

  const statusNames = {
    AVAILABLE: "Available",
    ASSIGNED: "Assigned",
    LOST: "Lost",
    RETIRED: "Retired",
  };

  let { cards, onChanged }: { cards: CardRow[]; onChanged: () => void } =
    $props();

  let selected = $state<string[]>([]);
  let filter = $state<"ALL" | CardRow["status"]>("ALL");
  let busy = $state(false);

  const visible = $derived(
    cards.filter((card) => filter === "ALL" || card.status === filter),
  );
  const allVisibleSelected = $derived(
    visible.length > 0 && visible.every((card) => selected.includes(card.id)),
  );

  function toggleVisible() {
    selected = allVisibleSelected
      ? selected.filter((id) => !visible.some((card) => card.id === id))
      : [...new Set([...selected, ...visible.map((card) => card.id)])];
  }

  function toggleCard(cardId: string) {
    selected = selected.includes(cardId)
      ? selected.filter((id) => id !== cardId)
      : [...selected, cardId];
  }

  async function applyStatus(event: SubmitEvent) {
    event.preventDefault();
    const status = String(
      new FormData(event.currentTarget as HTMLFormElement).get("status") ?? "",
    ) as CardRow["status"];
    if (!status) return;
    if (
      !window.confirm(
        `Change ${selected.length} selected card${selected.length === 1 ? "" : "s"} to ${status.toLowerCase()}? Any current student assignments will end.`,
      )
    )
      return;
    busy = true;
    try {
      await setCardStatus(selected, status);
      selected = [];
      onChanged();
    } catch (problem) {
      window.alert(readableError(problem));
    } finally {
      busy = false;
    }
  }
</script>

<form onsubmit={applyStatus} class="panel overflow-hidden">
  <div
    class="grid gap-4 border-b border-black/10 p-5 lg:grid-cols-[1fr_auto_auto] lg:items-end"
  >
    <div>
      <h2 class="text-2xl">Manage the full card set</h2>
      <p class="mt-1 text-sm text-slate-600">
        Cards are always shown in physical number order. Lost and retired cards
        cannot be assigned.
      </p>
    </div>
    <label class="label">
      Show
      <select class="field w-full sm:min-w-40" bind:value={filter}>
        <option value="ALL">All cards ({cards.length})</option>
        {#each Object.entries(statusNames) as [status, label] (status)}
          <option value={status}
            >{label} ({cards.filter((card) => card.status === status)
              .length})</option
          >
        {/each}
      </select>
    </label>
    <button
      class="btn btn-soft w-full sm:w-auto"
      type="button"
      onclick={toggleVisible}
    >
      {allVisibleSelected ? "Clear visible" : "Select visible"}
    </button>
  </div>

  {#if selected.length > 0}
    <div
      class="sticky top-28 z-10 grid grid-cols-2 items-center gap-2 border-b-4 border-[#e85d43] bg-[#f9bd72] p-3 shadow-lg sm:top-20 sm:flex sm:flex-wrap"
    >
      <strong class="col-span-2 mr-auto text-lg sm:col-span-1">
        {selected.length} card{selected.length === 1 ? "" : "s"} selected
      </strong>
      <select
        class="field col-span-2 w-full sm:max-w-48"
        name="status"
        required
      >
        <option value="" disabled selected>Bulk action...</option>
        <option value="AVAILABLE">Make available</option>
        <option value="LOST">Mark lost</option>
        <option value="RETIRED">Retire cards</option>
      </select>
      <button class="btn w-full sm:w-auto" disabled={busy}>Apply</button>
      <button
        class="btn btn-soft w-full sm:w-auto"
        type="button"
        onclick={() => (selected = [])}>Cancel</button
      >
    </div>
  {/if}

  <div
    class="hidden grid-cols-[48px_90px_110px_130px_1fr] gap-3 border-b border-black/10 bg-black/5 px-4 py-2 text-xs font-bold uppercase tracking-wider md:grid"
  >
    <span></span><span>Card</span><span>Code</span><span>Status</span><span
      >Assigned to</span
    >
  </div>

  {#each visible as card (card.id)}
    <label
      class="grid min-h-20 cursor-pointer grid-cols-[36px_minmax(0,1fr)] items-center gap-x-3 gap-y-2 border-b border-black/10 px-4 py-3 last:border-0 md:min-h-16 md:grid-cols-[48px_90px_110px_130px_minmax(0,1fr)] md:gap-3 {selected.includes(
        card.id,
      )
        ? 'border-l-4 border-l-[#e85d43] bg-[#fff0e8] pl-3 font-bold ring-2 ring-inset ring-[#e85d43]'
        : ''}"
    >
      <input
        class="h-5 w-5 accent-[#e85d43]"
        type="checkbox"
        checked={selected.includes(card.id)}
        onchange={() => toggleCard(card.id)}
      />
      <strong class="display min-w-0 text-xl md:col-auto">#{card.label}</strong>
      <span
        class="col-start-2 min-w-0 break-all font-bold tracking-widest md:col-auto md:break-normal"
      >
        {card.shortCode}
      </span>
      <span
        class="col-start-2 w-fit rounded-full px-3 py-1 text-xs font-bold md:col-auto {card.status ===
        'ASSIGNED'
          ? 'bg-[#cde7d8]'
          : card.status === 'AVAILABLE'
            ? 'bg-black/10'
            : card.status === 'LOST'
              ? 'bg-amber-200'
              : 'bg-slate-700 text-white'}"
      >
        {statusNames[card.status]}
      </span>
      <span class="col-start-2 min-w-0 break-words text-sm md:col-auto">
        {#if card.studentName}
          <strong>{card.studentName}</strong>
          {#if card.studentClassroom}<span class="text-slate-500">
              · {card.studentClassroom}</span
            >{/if}
        {:else}
          <span class="text-slate-500">No student</span>
        {/if}
      </span>
    </label>
  {/each}
  {#if !visible.length}
    <p class="p-8 text-center">No cards match this filter.</p>
  {/if}
</form>
