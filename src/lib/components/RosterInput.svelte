<script lang="ts">
  import { csvToNames } from "$lib/names";

  let { value = $bindable(""), names }: { value?: string; names: string[] } =
    $props();

  async function readFile(event: Event & { currentTarget: HTMLInputElement }) {
    const file = event.currentTarget.files?.[0];
    if (!file) return;
    value = csvToNames(await file.text()).join("\n");
  }
</script>

<div class="grid gap-3">
  <label class="label">
    Student names
    <textarea
      class="field min-h-36"
      bind:value
      placeholder={"Avery Johnson\nMaya Chen\nMaya Cetin"}
    ></textarea>
  </label>
  <p class="text-sm text-slate-600">
    Paste one student per line, or separate a short list with commas. Type the
    full name — only the first name and enough of the last name to tell students
    apart is saved.
  </p>
  <label class="label">
    Or upload a spreadsheet file (.csv)
    <input
      class="field"
      type="file"
      accept=".csv,text/csv"
      onchange={readFile}
    />
  </label>

  {#if names.length}
    <div class="rounded-xl bg-[#e8eee9] p-4">
      <p class="text-sm font-bold">
        {names.length} student{names.length === 1 ? "" : "s"} will be saved as:
      </p>
      <p class="mt-2 text-sm">{names.join(" · ")}</p>
    </div>
  {/if}
</div>
