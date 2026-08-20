<script lang="ts">
  import AppNav from "$lib/components/AppNav.svelte";
  import { pb, type Classroom } from "$lib/pocketbase";
  import { createLoader, requireTeacher } from "$lib/session.svelte";

  let { children } = $props();

  const session = requireTeacher();
  const classrooms = createLoader(() =>
    pb
      .collection("classrooms")
      .getFullList<Classroom>({ filter: "archived = false", sort: "name" }),
  );

  $effect(() => {
    if (session.teacher) void classrooms.reload();
  });
</script>

{#if session.teacher}
  <AppNav
    teacherName={session.teacher.displayName}
    classrooms={(classrooms.state.data ?? []).map((room) => ({
      id: room.id,
      name: room.name,
    }))}
  />
  <main class="mx-auto max-w-7xl px-3 py-4 sm:px-5 md:p-7">
    {@render children()}
  </main>
{/if}
