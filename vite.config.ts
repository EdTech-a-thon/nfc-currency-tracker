import { sveltekit } from "@sveltejs/kit/vite";
import { defineConfig } from "vite";
import { fileURLToPath } from "node:url";

export default defineConfig({
  plugins: [sveltekit()],
  resolve: {
    // Keep the PocketBase browser package distinct from the local server binary.
    alias: {
      pocketbase: fileURLToPath(
        new URL("./node_modules/pocketbase/dist/pocketbase.es.mjs", import.meta.url),
      ),
    },
  },
  optimizeDeps: {
    exclude: ["pocketbase"],
  },
  server: {
    // The preview environment reaches this server under its own hostnames.
    allowedHosts: [".exe.xyz", ".edtechathon.com"],
  },
});
