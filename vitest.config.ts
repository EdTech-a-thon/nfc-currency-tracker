import { defineConfig } from "vitest/config";

// The tests talk to a running PocketBase rather than to the app, so they need
// none of the SvelteKit plugin machinery.
export default defineConfig({
  test: { fileParallelism: false, testTimeout: 30000 },
});
