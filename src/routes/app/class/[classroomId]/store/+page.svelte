<script lang="ts">
  import { page } from "$app/state";
  import {
    pb,
    readableError,
    type Classroom,
    type StoreItem,
  } from "$lib/pocketbase";
  import { createLoader, requireTeacher } from "$lib/session.svelte";

  const session = requireTeacher();
  const classroomId = $derived(page.params.classroomId ?? "");
  let message = $state("");

  const screen = createLoader(async () => {
    const [classroom, items] = await Promise.all([
      pb.collection("classrooms").getOne<Classroom>(classroomId),
      pb
        .collection("store_items")
        .getFullList<StoreItem>({ sort: "sortOrder,name" }),
    ]);
    return { classroom, items };
  });

  $effect(() => {
    if (session.teacher && classroomId) void screen.reload();
  });

  // Stock is left blank for an unlimited item, which PocketBase stores as a flag.
  function readItem(form: FormData) {
    const stock = String(form.get("stock")).trim();
    return {
      name: String(form.get("name")).trim(),
      price: Number(form.get("price")),
      trackStock: stock !== "",
      stock: stock === "" ? 0 : Number(stock),
      active: String(form.get("active")) !== "false",
    };
  }

  async function save(event: SubmitEvent, itemId?: string) {
    event.preventDefault();
    const form = event.currentTarget as HTMLFormElement;
    try {
      const values = readItem(new FormData(form));
      if (itemId) await pb.collection("store_items").update(itemId, values);
      else {
        await pb.collection("store_items").create({
          teacher: session.teacher!.id,
          ...values,
          sortOrder: (screen.state.data?.items.length ?? 0) + 1,
        });
        form.reset();
      }
      message = "Store item saved.";
      void screen.reload();
    } catch (problem) {
      message = readableError(problem);
    }
  }
</script>

{#if session.teacher}
  {#if screen.state.error}
    <p class="panel p-8">{screen.state.error}</p>
  {:else if !screen.state.data}
    <p class="panel p-8">Loading your store...</p>
  {:else}
    {@const { classroom, items } = screen.state.data}
    <div class="grid gap-6">
      <div class="flex flex-wrap items-end justify-between">
        <div>
          <p class="font-bold text-[#e85d43]">Shared across your classes</p>
          <h1 class="text-4xl">Account store</h1>
        </div>
        {#if !classroom.archived}
          <a class="btn btn-accent" href="/app/class/{classroomId}/checkout"
            >Start checkout for {classroom.name}</a
          >
        {/if}
      </div>

      {#if message}
        <div
          class="rounded-xl bg-[#cde7d8] p-4 font-bold text-green-900"
          role="status"
        >
          {message}
        </div>
      {/if}

      <form
        onsubmit={(event) => save(event)}
        class="panel grid gap-3 p-5 md:grid-cols-[1fr_120px_160px_auto]"
      >
        <label class="label"
          >Item name<input
            class="field"
            name="name"
            placeholder="e.g. Homework pass"
            required
          /></label
        >
        <label class="label"
          >Price<input
            class="field"
            name="price"
            type="number"
            min="1"
            placeholder="Cost"
            required
          /></label
        >
        <label class="label"
          >Stock available<input
            class="field"
            name="stock"
            type="number"
            min="1"
            placeholder="Unlimited"
          /></label
        >
        <button class="btn self-end">Add item</button>
      </form>

      <section class="grid gap-3">
        <div
          class="hidden grid-cols-[70px_minmax(0,1fr)_120px_160px_120px_auto] items-center gap-3 border-b-2 border-[#23312c] px-4 pb-2 text-xs font-bold uppercase tracking-wider text-slate-600 md:grid"
        >
          <span>Order</span><span>Item name</span><span>Price</span><span
            >Stock available</span
          >
          <span>Available to sell</span><span>Action</span>
        </div>
        {#each items as item, index (item.id)}
          <form
            onsubmit={(event) => save(event, item.id)}
            class="panel grid items-end gap-3 p-4 md:grid-cols-[70px_minmax(0,1fr)_120px_160px_120px_auto] {item.active
              ? ''
              : 'opacity-60'}"
          >
            <span
              class="display self-center text-2xl"
              aria-label="Display order {index + 1}">{index + 1}</span
            >
            <span class="label md:hidden">Item name</span>
            <input class="field" name="name" value={item.name} required />
            <span class="label md:hidden">Price</span>
            <input
              class="field"
              name="price"
              type="number"
              min="1"
              value={item.price}
              required
            />
            <span class="label md:hidden">Stock available</span>
            <input
              class="field"
              name="stock"
              type="number"
              min="1"
              value={item.trackStock ? item.stock : ""}
              placeholder="Unlimited"
            />
            <span class="label md:hidden">Available to sell</span>
            <select class="field" name="active">
              <option value="true" selected={item.active}>Available</option>
              <option value="false" selected={!item.active}>Hidden</option>
            </select>
            <button class="btn btn-soft">Save</button>
          </form>
        {/each}
        {#if !items.length}
          <p class="panel p-8 text-center">
            No store items yet. Add one above.
          </p>
        {/if}
      </section>
    </div>
  {/if}
{/if}
