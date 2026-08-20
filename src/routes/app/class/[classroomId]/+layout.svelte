<script lang="ts">
  import { page } from "$app/state";
  import ClassroomTabs from "$lib/components/ClassroomTabs.svelte";

  let { children } = $props();

  const classroomId = $derived(page.params.classroomId ?? "");
</script>

<div class="grid gap-5">
  <ClassroomTabs {classroomId} />
  {@render children()}
</div>
