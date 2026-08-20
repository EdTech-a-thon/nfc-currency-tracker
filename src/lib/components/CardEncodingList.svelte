<script lang="ts">
  type CardLink = {
    id: string;
    label: string;
    shortCode: string;
    url: string;
    studentName: string | null;
    status: string;
  };

  let { cards }: { cards: CardLink[] } = $props();

  let copiedId = $state<string | null>(null);

  async function copy(card: CardLink) {
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
    copiedId = card.id;
    window.setTimeout(() => {
      if (copiedId === card.id) copiedId = null;
    }, 2500);
  }
</script>

<div class="grid gap-3">
  {#each cards as card (card.id)}
    <article
      class="panel grid gap-4 p-4 sm:grid-cols-[110px_1fr] sm:items-center md:grid-cols-[110px_1fr_auto]"
    >
      <div>
        <p class="display text-3xl">Card #{card.label}</p>
        <p class="font-bold tracking-[.18em] text-[#e85d43]">
          {card.shortCode}
        </p>
      </div>
      <div class="min-w-0">
        <p class="font-bold">
          {card.studentName
            ? `Assigned to ${card.studentName}`
            : card.status === "AVAILABLE"
              ? "Available to assign"
              : card.status}
        </p>
        <p class="mt-1 truncate text-sm text-slate-500">{card.url}</p>
        <p class="mt-1 text-xs text-slate-500">
          This URL always belongs to Card #{card.label}. Reassigning the card
          changes the student it opens.
        </p>
      </div>
      <div
        class="grid grid-cols-2 gap-2 sm:col-span-2 md:col-span-1 md:grid-cols-1"
      >
        <button
          class="btn {copiedId === card.id ? 'bg-green-700' : 'btn-accent'}"
          onclick={() => copy(card)}
        >
          {copiedId === card.id ? "Copied!" : "Copy URL"}
        </button>
        <a class="btn btn-soft" href={card.url} target="_blank" rel="noreferrer"
          >Test link</a
        >
      </div>
    </article>
  {/each}
  {#if !cards.length}
    <div class="panel p-8 text-center">
      No cards exist yet. Generate a card set first.
    </div>
  {/if}
</div>
