<script lang="ts">
  import { page } from "$app/state";
  import OptimisticAward from "$lib/components/OptimisticAward.svelte";
  import { fetchBalances } from "$lib/api";
  import {
    pb,
    type AwardPreset,
    type Classroom,
    type Student,
  } from "$lib/pocketbase";
  import { createLoader, requireTeacher } from "$lib/session.svelte";

  const session = requireTeacher();
  const classroomId = $derived(page.params.classroomId ?? "");

  const screen = createLoader(async () => {
    const id = classroomId;
    const classroom = await pb.collection("classrooms").getOne<Classroom>(id);
    const [students, presets, balances] = await Promise.all([
      pb.collection("students").getFullList<Student>({
        filter: `classroom = "${id}" && active = true`,
        sort: "displayName",
      }),
      pb.collection("award_presets").getFullList<AwardPreset>({
        filter: `classroom = "${id}"`,
        sort: "sortOrder",
      }),
      fetchBalances(id),
    ]);
    return {
      classroom,
      presets,
      students: students.map((student) => ({
        id: student.id,
        displayName: student.displayName,
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
    <p class="panel p-8">Loading your class...</p>
  {:else}
    {@const { classroom, students, presets } = screen.state.data}
    <div class="grid gap-6">
      <div class="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p class="font-bold uppercase tracking-[.18em] text-[#e85d43]">
            {classroom.name}
          </p>
          <h1 class="text-4xl md:text-6xl">Award {classroom.currencyName}</h1>
        </div>
        {#if !classroom.archived}
          <a class="btn" href="/app/class/{classroomId}/checkout"
            >Open checkout</a
          >
        {/if}
      </div>
      {#if classroom.archived}
        <div class="panel p-8">
          <h2 class="text-2xl">This classroom is archived</h2>
          <p class="mt-2">
            Its history remains available, but rewards and purchases are
            read-only.
          </p>
        </div>
      {:else}
        <OptimisticAward
          {classroomId}
          symbol={classroom.currencySymbol}
          {presets}
          {students}
        />
      {/if}
    </div>
  {/if}
{/if}
