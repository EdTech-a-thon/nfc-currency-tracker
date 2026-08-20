<script lang="ts">
  import { page } from "$app/state";
  import StoreItems from "$lib/components/StoreItems.svelte";
  import { fetchBalances } from "$lib/api";
  import {
    pb,
    type Classroom,
    type StoreItem,
    type Student,
  } from "$lib/pocketbase";
  import { createLoader, requireTeacher } from "$lib/session.svelte";

  const session = requireTeacher();
  const classroomId = $derived(page.params.classroomId ?? "");
  const selectedId = $derived(
    page.url.searchParams.get("student") ?? undefined,
  );

  const screen = createLoader(async () => {
    const id = classroomId;
    const [classroom, students, items, balances] = await Promise.all([
      pb.collection("classrooms").getOne<Classroom>(id),
      pb.collection("students").getFullList<Student>({
        filter: `classroom = "${id}" && active = true`,
        sort: "displayName",
      }),
      pb.collection("store_items").getFullList<StoreItem>({
        filter: "active = true",
        sort: "sortOrder,name",
      }),
      fetchBalances(id),
    ]);
    return {
      classroom,
      items,
      students: students.map((student) => ({
        id: student.id,
        name: student.displayName,
        balance: balances.balances[student.id] ?? 0,
      })),
    };
  });

  $effect(() => {
    if (session.teacher && classroomId) void screen.reload();
  });
</script>

{#if session.teacher}
  {#if screen.state.error}
    <p class="panel p-8">{screen.state.error}</p>
  {:else if !screen.state.data}
    <p class="panel p-8">Loading checkout...</p>
  {:else}
    {@const data = screen.state.data}
    <div class="grid gap-6">
      <div>
        <p class="font-bold text-[#e85d43]">{data.classroom.name}</p>
        <h1 class="text-4xl">Checkout</h1>
        <p class="mt-1 text-slate-600">
          Items come from your shared account store.
        </p>
      </div>
      {#if data.items.length}
        <StoreItems
          items={data.items}
          students={data.students}
          initialStudentId={selectedId}
          symbol={data.classroom.currencySymbol}
          {classroomId}
        />
      {:else}
        <p class="panel p-8">No store items are available.</p>
      {/if}
    </div>
  {/if}
{/if}
