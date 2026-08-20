<script lang="ts">
  import { pb, readableError } from "$lib/pocketbase";
  import { deleteClassroom } from "$lib/api";

  let {
    classroomId,
    classroomName,
    archived,
    onDone,
  }: {
    classroomId: string;
    classroomName: string;
    archived: boolean;
    onDone: () => void;
  } = $props();

  let busy = $state(false);

  async function toggleArchived() {
    busy = true;
    try {
      await pb.collection("classrooms").update(classroomId, {
        archived: !archived,
        archivedAt: archived ? "" : new Date().toISOString(),
      });
      onDone();
    } catch (problem) {
      window.alert(readableError(problem));
    } finally {
      busy = false;
    }
  }

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
      onDone();
    } catch (problem) {
      window.alert(readableError(problem));
    } finally {
      busy = false;
    }
  }
</script>

<div class="flex flex-wrap gap-2">
  <button class="btn btn-soft" onclick={toggleArchived} disabled={busy}>
    {archived ? "Restore class" : "Archive class"}
  </button>
  <button class="btn bg-red-700" onclick={remove} disabled={busy}>Delete</button
  >
</div>
