<script lang="ts">
  import type { Snippet } from "svelte";

  let {
    open = $bindable(false),
    title,
    children,
  }: { open?: boolean; title: string; children: Snippet } = $props();

  let dialog = $state<HTMLDialogElement>();

  $effect(() => {
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  });
</script>

<dialog
  bind:this={dialog}
  class="modal panel w-[min(46rem,92vw)] p-0"
  onclose={() => (open = false)}
>
  <div
    class="sticky top-0 flex items-center justify-between gap-3 border-b border-black/10 bg-[#fffdf7] px-5 py-4"
  >
    <h2 class="text-2xl">{title}</h2>
    <button class="btn btn-soft px-3" onclick={() => (open = false)}
      >Close</button
    >
  </div>
  <div class="p-5">
    {@render children()}
  </div>
</dialog>

<style>
  .modal {
    max-height: 88vh;
    overflow: auto;
  }
  .modal::backdrop {
    background: #23312cb0;
  }
</style>
