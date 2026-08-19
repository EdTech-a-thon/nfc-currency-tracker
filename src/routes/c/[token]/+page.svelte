<script lang="ts">
  import { page } from "$app/state";
  import CardView from "$lib/components/CardView.svelte";
</script>

<CardView token={page.params.token ?? ""} />
