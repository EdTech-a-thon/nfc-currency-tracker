<script lang="ts">
  import { onMount } from "svelte";
  import { goto } from "$app/navigation";
  import { currentTeacher } from "$lib/pocketbase";

  onMount(() => {
    void goto(currentTeacher() ? "/app" : "/login", { replaceState: true });
  });
</script>
