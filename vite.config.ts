import { sveltekit } from "@sveltejs/kit/vite";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [sveltekit()],
  server: {
    // The preview environment reaches this server under its own hostnames.
    allowedHosts: [".exe.xyz", ".edtechathon.com"],
  },
});
