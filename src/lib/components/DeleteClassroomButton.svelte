<script lang="ts">
  import { goto } from "$app/navigation";
  import { readableError } from "$lib/pocketbase";
  import { deleteClassroom } from "$lib/api";

  let {
    classroomId,
    classroomName,
  }: { classroomId: string; classroomName: string } = $props();

  let busy = $state(false);

  async function remove() {
    if (
      !window.confirm(
        `Delete ${classroomName}? This permanently removes its students and transaction history. Your shared account store will remain. This cannot be undone.`,
      )
    )
      return;
    busy = true;
    try {
      await deleteClassroom(classroomId);
      await goto("/app");
    } catch (problem) {
      window.alert(readableError(problem));
      busy = false;
    }
  }
</script>

<button class="btn bg-red-700" onclick={remove} disabled={busy}
  >Delete class</button
>
