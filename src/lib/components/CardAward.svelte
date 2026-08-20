<script lang="ts">
  import { postEntry } from "$lib/api";
  import { readableError } from "$lib/pocketbase";

  let {
    studentId,
    presets,
    currencyName,
    onPosted,
  }: {
    studentId: string;
    presets: { id: string; label: string; amount: number }[];
    currencyName: string;
    onPosted: () => void;
  } = $props();

  let amount = $state<number | null>(null);
  let reason = $state("");
  let status = $state("");
  let saving = $state(false);

  async function send(awardAmount: number, awardReason: string) {
    if (
      !Number.isInteger(awardAmount) ||
      awardAmount < 1 ||
      awardAmount > 100000
    ) {
      status = "Enter a positive whole-number amount.";
      return;
    }
    if (saving) return;
    saving = true;
    status = "Saving...";
    try {
      await postEntry({
        studentId,
        amount: awardAmount,
        reason: awardReason || "Classroom award",
        kind: "AWARD",
        idempotencyKey: crypto.randomUUID(),
      });
      status = `Synced +${awardAmount} ${currencyName}`;
      amount = null;
      reason = "";
      onPosted();
    } catch (error) {
      status = readableError(error, "Could not save.");
    } finally {
      saving = false;
    }
  }

  function sendCustom() {
    void send(Number(amount), reason.trim() || "Custom award");
  }
</script>

<section class="panel p-5">
  <h2 class="text-xl">Quick award</h2>
  <label class="label mt-3">
    Note (optional)<input
      class="field"
      bind:value={reason}
      placeholder="Add a note if needed"
    />
  </label>
  <div class="mt-3 grid gap-2 sm:grid-cols-2">
    {#each presets as preset (preset.id)}
      <button
        class="btn btn-accent min-h-16 text-left"
        onclick={() => send(preset.amount, reason.trim() || preset.label)}
        disabled={saving}
      >
        <strong class="block text-lg">+{preset.amount}</strong>
        <span class="text-sm">{preset.label}</span>
      </button>
    {/each}
  </div>
  <div class="mt-5 border-t border-black/10 pt-5">
    <label class="label">
      Custom amount
      <input
        class="field text-lg"
        type="number"
        inputmode="numeric"
        min="1"
        max="100000"
        step="1"
        bind:value={amount}
        onkeydown={(event) => event.key === "Enter" && sendCustom()}
        placeholder="Enter amount"
      />
    </label>
    <button
      class="btn btn-accent mt-3 w-full text-lg"
      onclick={sendCustom}
      disabled={saving}
    >
      Add {amount && amount > 0 ? `+${amount}` : "custom amount"}
    </button>
  </div>
  <p class="mt-3 min-h-5 text-sm" aria-live="polite">{status}</p>
</section>
