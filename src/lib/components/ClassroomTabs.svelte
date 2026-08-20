<script lang="ts">
  import { page } from "$app/state";

  let { classroomId }: { classroomId: string } = $props();

  const tabs = $derived([
    { label: "Award", href: `/app/class/${classroomId}`, section: "" },
    {
      label: "Roster",
      href: `/app/class/${classroomId}/roster`,
      section: "roster",
    },
    {
      label: "Store",
      href: `/app/class/${classroomId}/store`,
      section: "store",
    },
    {
      label: "Cards",
      href: `/app/class/${classroomId}/cards`,
      section: "cards",
    },
  ]);

  const currentSection = $derived(
    page.url.pathname.match(/^\/app\/class\/[^/]+\/?([^/]*)/)?.[1] ?? "",
  );
</script>

<nav
  class="no-print grid grid-cols-4 gap-1 sm:gap-2"
  aria-label="Classroom sections"
>
  {#each tabs as tab (tab.href)}
    {@const active = currentSection === tab.section}
    <a
      class="btn px-2 {active ? '' : 'btn-soft'}"
      href={tab.href}
      aria-current={active ? "page" : undefined}>{tab.label}</a
    >
  {/each}
</nav>
