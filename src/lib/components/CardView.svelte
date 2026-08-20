<script lang="ts">
  import CardAward from "$lib/components/CardAward.svelte";
  import { tapCard, undoEntry, type TapView } from "$lib/api";
  import { readableError } from "$lib/pocketbase";
  import { createLoader } from "$lib/session.svelte";

  // A tapped card. Anyone holding the card sees the balance; only the teacher
  // who owns it gets the controls, and PocketBase decides which of those applies.
  let { token }: { token: string } = $props();

  let message = $state("");
  const screen = createLoader<TapView>(() => tapCard(token));

  $effect(() => {
    if (token) void screen.reload();
  });

  async function undo(transactionId: string) {
    try {
      await undoEntry(transactionId);
      void screen.reload();
    } catch (problem) {
      message = readableError(problem);
    }
  }
</script>

{#if screen.state.loading}
  <main class="grid min-h-screen place-items-center p-5">
    <p>Loading this card...</p>
  </main>
{:else if screen.state.error || !screen.state.data}
  <main class="grid min-h-screen place-items-center p-5">
    <div class="panel max-w-md p-8 text-center">
      <p class="font-bold text-[#e85d43]">NFC Currency Tracker</p>
      <h1 class="mt-3 text-3xl">This card isn’t assigned yet</h1>
      <p class="mt-3 text-slate-600">
        Ask your teacher to assign or replace this card.
      </p>
    </div>
  </main>
{:else}
  {@const {
    student,
    classroom,
    balance,
    transactions,
    store,
    canManage,
    presets,
  } = screen.state.data}
  <main class="mx-auto grid min-h-screen max-w-xl gap-5 p-4 py-8">
    <section class="overflow-hidden rounded-[2rem] bg-[#23312c] p-7 text-white">
      <p class="font-bold text-[#f9bd72]">{classroom.name}</p>
      <h1 class="mt-2 text-3xl">{student.displayName}</h1>
      <p class="display mt-8 text-7xl text-[#f9bd72]">
        {classroom.currencySymbol}{balance}
      </p>
      <p>{classroom.currencyName}</p>
    </section>

    {#if message}
      <p class="rounded-xl bg-red-100 p-4 font-bold text-red-800" role="alert">
        {message}
      </p>
    {/if}

    {#if canManage}
      <CardAward
        studentId={student.id}
        {presets}
        currencyName={classroom.currencyName}
        onPosted={() => void screen.reload()}
      />
      <a class="btn" href="/app/student/{student.id}"
        >Open full teacher controls</a
      >
    {/if}

    <section class="panel overflow-hidden">
      <h2 class="p-5 text-xl">Recent activity</h2>
      {#each transactions as entry (entry.id)}
        <div class="flex justify-between border-t border-black/10 p-4">
          <div>
            {#if entry.reason}<strong>{entry.reason}</strong>{/if}
            <p class="text-sm text-slate-500">
              {new Date(entry.created).toLocaleDateString()}
            </p>
          </div>
          <div class="text-right">
            <span class={entry.amount > 0 ? "text-green-700" : "text-red-700"}>
              {entry.amount > 0 ? "+" : ""}{entry.amount}
            </span>
            {#if canManage}
              <button
                class="mt-1 block text-xs underline"
                onclick={() => undo(entry.id)}>Undo</button
              >
            {/if}
          </div>
        </div>
      {/each}
      {#if !transactions.length}
        <p class="p-5 text-slate-600">No activity yet.</p>
      {/if}
    </section>

    <section class="panel p-5">
      <h2 class="text-xl">Account store</h2>
      {#if store.length}
        <div class="mt-3 grid gap-2">
          {#each store as item (item.id)}
            <div class="flex justify-between">
              <span>{item.name}</span>
              <strong>{classroom.currencySymbol}{item.price}</strong>
            </div>
          {/each}
        </div>
      {:else}
        <p class="mt-2 text-slate-600">No store items are available.</p>
      {/if}
    </section>
  </main>
{/if}
