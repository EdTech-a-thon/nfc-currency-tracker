<script lang="ts">
  // Fills the names box from a spreadsheet export, taking the first column and
  // skipping an obvious header row.
  async function readFile(event: Event & { currentTarget: HTMLInputElement }) {
    const file = event.currentTarget.files?.[0];
    const textarea = event.currentTarget.form?.elements.namedItem(
      "names",
    ) as HTMLTextAreaElement | null;
    if (!file || !textarea) return;
    const lines = (await file.text()).split(/\r?\n/).filter(Boolean);
    const first = lines[0]?.toLowerCase();
    textarea.value = (
      first === "name" || first === "displayname" ? lines.slice(1) : lines
    )
      .map((line) => line.split(",")[0].replace(/^"|"$/g, ""))
      .join("\n");
  }
</script>

<label class="label">
  Or choose a CSV file
  <input class="field" type="file" accept=".csv,text/csv" onchange={readFile} />
</label>
