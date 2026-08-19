<script lang="ts">
  import { page } from "$app/state";
  import CardEncodingList from "$lib/components/CardEncodingList.svelte";
  import { cardUrl } from "$lib/api";
  import {
    pb,
    type Card,
    type CardAssignment,
    type Classroom,
    type Student,
  } from "$lib/pocketbase";
  import { createLoader, requireTeacher } from "$lib/session.svelte";

  const session = requireTeacher();
  const classroomId = $derived(page.params.classroomId ?? "");

  const screen = createLoader(async () => {
    const id = classroomId;
    const [classroom, cards, assignments] = await Promise.all([
      pb.collection("classrooms").getOne<Classroom>(id),
      pb.collection("cards").getFullList<Card>(),
      pb
        .collection("card_assignments")
        .getFullList<CardAssignment & { expand?: { student?: Student } }>({
          filter: "endedAt = null",
          expand: "student",
        }),
    ]);
    const holderByCard = new Map(
      assignments.map((row) => [row.card, row.expand?.student ?? null]),
    );
    // This class first, then spare cards, then everything else — in card order.
    const rank = (card: Card) => {
      const holder = holderByCard.get(card.id);
      if (holder?.classroom === id) return 0;
      return card.status === "AVAILABLE" ? 1 : 2;
    };
    const ordered = [...cards].sort(
      (first, second) =>
        rank(first) - rank(second) ||
        Number(first.label) - Number(second.label) ||
        first.label.localeCompare(second.label, undefined, { numeric: true }),
    );
    return { classroom, cards: ordered, holderByCard };
  });

  $effect(() => {
    if (session.teacher && classroomId) void screen.reload();
  });

  async function downloadCsv() {
    const cards = await pb
      .collection("cards")
      .getFullList<Card>({ sort: "label" });
    const cell = (value: string) => `"${value.replace(/"/g, '""')}"`;
    const csv = [
      ["Card", "Code", "Status", "URL"].map(cell).join(","),
      ...cards.map((card) =>
        [card.label, card.shortCode, card.status, cardUrl(card.token)]
          .map(cell)
          .join(","),
      ),
    ].join("\n");
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    link.download = "cards.csv";
    link.click();
    URL.revokeObjectURL(link.href);
  }
</script>

{#if session.teacher}
  {#if screen.state.error}
    <p class="panel p-8">{screen.state.error}</p>
  {:else if !screen.state.data}
    <p class="panel p-8">Loading your cards...</p>
  {:else}
    {@const data = screen.state.data}
    <div class="grid gap-5">
      <div>
        <p class="font-bold text-[#e85d43]">{data.classroom.name}</p>
        <h1 class="text-4xl">Write your NFC cards</h1>
        <p class="mt-2 max-w-3xl">
          On your iPhone, tap <strong>Copy URL</strong>, switch to NFC Tools,
          create a URL record, paste, and write it to the matching numbered
          card. Each physical card is written only once.
        </p>
      </div>

      <ol class="panel grid gap-3 p-5 md:grid-cols-3">
        <li>
          <strong>1. Match the number</strong><br />
          <span class="text-sm text-slate-600"
            >Pick the physical card matching the label shown here.</span
          >
        </li>
        <li>
          <strong>2. Copy and write</strong><br />
          <span class="text-sm text-slate-600"
            >Copy its URL and paste it into NFC Tools.</span
          >
        </li>
        <li>
          <strong>3. Test, then assign</strong><br />
          <span class="text-sm text-slate-600"
            >Test the link before locking the tag, then assign that card to a
            student.</span
          >
        </li>
      </ol>

      <div class="flex flex-wrap gap-2">
        <a class="btn" href="/app/class/{classroomId}/cards">Assign cards</a>
        <button class="btn btn-soft" onclick={downloadCsv}
          >Download all as CSV</button
        >
      </div>

      <CardEncodingList
        cards={data.cards.map((card) => ({
          id: card.id,
          label: card.label,
          shortCode: card.shortCode,
          url: cardUrl(card.token),
          studentName: data.holderByCard.get(card.id)?.displayName ?? null,
          status: card.status,
        }))}
      />
    </div>
  {/if}
{/if}
