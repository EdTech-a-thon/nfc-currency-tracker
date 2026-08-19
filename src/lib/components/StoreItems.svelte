<script lang="ts">
  import { checkout, fetchBalances } from "$lib/api";
  import { pb, readableError, type StoreItem } from "$lib/pocketbase";

  type Student = { id: string; name: string; balance: number };

  let {
    items: initialItems,
    students,
    initialStudentId,
    symbol,
    classroomId,
  }: {
    items: StoreItem[];
    students: Student[];
    initialStudentId?: string;
    symbol: string;
    classroomId: string;
  } = $props();

  // These start from what the screen loaded and are then owned by this
  // component, which reads fresh figures back from PocketBase after a purchase.
  // svelte-ignore state_referenced_locally
  let items = $state(initialItems);
  let selected = $state<string[]>([]);
  // svelte-ignore state_referenced_locally
  let studentId = $state(initialStudentId ?? "");
  // svelte-ignore state_referenced_locally
  let studentBalances = $state(
    new Map(students.map((student) => [student.id, student.balance])),
  );
  let message = $state("");
  let saving = $state(false);

  const total = $derived(
    items.reduce(
      (sum, item) => sum + (selected.includes(item.id) ? item.price : 0),
      0,
    ),
  );
  const balance = $derived(studentBalances.get(studentId));

  async function completePurchase() {
    if (!studentId || !selected.length || saving) return;
    saving = true;
    message = "";
    try {
      await checkout({
        studentId,
        items: selected.map((id) => ({ id, quantity: 1 })),
        idempotencyKey: crypto.randomUUID(),
      });
      // Read the figures back rather than guessing them, so stock and balance
      // match what the ledger actually recorded.
      const [fresh, balances] = await Promise.all([
        pb.collection("store_items").getFullList<StoreItem>({
          filter: "active = true",
          sort: "sortOrder,name",
        }),
        fetchBalances(classroomId),
      ]);
      items = fresh;
      studentBalances = new Map(Object.entries(balances.balances));
      selected = [];
      message = "Purchase recorded. Stock has been updated.";
    } catch (error) {
      message = readableError(error, "Checkout could not be completed.");
    } finally {
      saving = false;
    }
  }

  function toggleItem(itemId: string, checked: boolean) {
    selected = checked
      ? [...selected, itemId]
      : selected.filter((id) => id !== itemId);
  }
</script>

<div class="grid gap-5">
  {#if message}
    <div
      class="rounded-xl p-4 font-bold {message.startsWith('Purchase')
        ? 'bg-[#cde7d8] text-green-900'
        : 'bg-red-100 text-red-800'}"
      role="status"
      aria-live="assertive"
    >
      {message}
    </div>
  {/if}

  <div class="panel p-5">
    <label class="label">
      Student
      <select class="field mt-1" bind:value={studentId} required>
        <option value="">Choose a student</option>
        {#each students as student (student.id)}
          <option value={student.id}
            >{student.name} · {symbol}{studentBalances.get(student.id)}</option
          >
        {/each}
      </select>
    </label>
  </div>

  <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
    {#each items as item (item.id)}
      {@const soldOut = item.trackStock && item.stock === 0}
      <label
        class="panel flex min-h-28 items-center gap-4 p-5 {soldOut
          ? 'cursor-not-allowed border-2 border-red-700 bg-red-50 opacity-70'
          : 'cursor-pointer'}"
      >
        <input
          class="h-6 w-6"
          type="checkbox"
          checked={selected.includes(item.id)}
          disabled={soldOut || saving}
          onchange={(event) => toggleItem(item.id, event.currentTarget.checked)}
        />
        <span class="flex-1">
          <strong class="block text-lg">{item.name}</strong>
          <small class={soldOut ? "font-bold text-red-700" : ""}>
            {soldOut
              ? "SOLD OUT"
              : !item.trackStock
                ? "Unlimited"
                : `${item.stock} left`}
          </small>
        </span>
        <span class="display text-2xl">{symbol}{item.price}</span>
      </label>
    {/each}
  </div>

  <div
    class="sticky bottom-4 grid gap-2 rounded-xl bg-[#23312c] p-4 text-white md:grid-cols-[1fr_1fr_auto]"
  >
    <p class="display text-2xl">Cart: {symbol}{total}</p>
    <p
      class="display text-2xl {balance !== undefined && balance - total < 0
        ? 'text-red-300'
        : 'text-[#cde7d8]'}"
    >
      {balance === undefined
        ? "Select a student"
        : `After: ${symbol}${balance - total}`}
    </p>
    <button
      type="button"
      class="btn btn-accent"
      disabled={!studentId || !total || saving}
      onclick={completePurchase}
    >
      {saving ? "Completing..." : "Complete purchase"}
    </button>
  </div>
</div>
