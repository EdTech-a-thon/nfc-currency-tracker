<script lang="ts">
  import { goto } from "$app/navigation";
  import { page } from "$app/state";
  import { pb } from "$lib/pocketbase";

  let {
    teacherName,
    classrooms,
  }: { teacherName: string; classrooms: { id: string; name: string }[] } =
    $props();

  const currentId = $derived(
    page.url.pathname.match(/^\/app\/class\/([^/]+)/)?.[1],
  );

  function logOut() {
    pb.authStore.clear();
    void goto("/login", { replaceState: true });
  }
</script>

<header
  class="no-print sticky top-0 z-30 border-b border-black/10 bg-[#fbf6e9]/95 backdrop-blur"
>
  <div
    class="mx-auto flex max-w-7xl flex-wrap items-center gap-2 px-3 py-2 sm:gap-3 sm:px-5 sm:py-3"
  >
    <a href="/app" class="display whitespace-nowrap text-base sm:text-lg">
      NFC <span class="text-[#e85d43]">Currency</span>
    </a>
    <a
      href="/app"
      class="btn btn-soft mr-auto px-3"
      aria-label="View all classes">Home</a
    >
    <select
      class="field max-w-40 sm:max-w-52"
      aria-label="Switch active classroom"
      value={currentId ?? ""}
      onchange={(event) =>
        event.currentTarget.value &&
        goto(`/app/class/${event.currentTarget.value}`)}
    >
      {#if !currentId}<option value="" disabled>Select a class</option>{/if}
      {#each classrooms as room (room.id)}<option value={room.id}
          >{room.name}</option
        >{/each}
    </select>
    <span class="hidden text-sm md:inline">{teacherName}</span>
    <button class="btn btn-soft px-3" onclick={logOut}>Log out</button>
  </div>
</header>
