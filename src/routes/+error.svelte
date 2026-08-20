<script lang="ts">
  import { page } from "$app/state";
</script>

<main class="grid min-h-screen place-items-center p-6">
  <div class="panel max-w-md p-8 text-center">
    {#if page.status === 404}
      <h1 class="text-3xl">Page not found</h1>
      <p class="my-4">The link may be old or unavailable.</p>
    {:else}
      <h1 class="text-2xl">Something went wrong</h1>
      <p class="my-4 text-slate-600">
        Your information is safe. Try this page again.
      </p>
    {/if}
    <a class="btn" href="/">Go home</a>
  </div>
</main>
