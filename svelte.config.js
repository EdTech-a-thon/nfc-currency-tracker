import adapter from "@sveltejs/adapter-node";
import { vitePreprocess } from "@sveltejs/vite-plugin-svelte";

/** @type {import('@sveltejs/kit').Config} */
export default {
  preprocess: vitePreprocess(),
  kit: {
    // A plain Node server, so the container runs `node build/index.js`.
    adapter: adapter(),
    alias: { "@": "src" },
  },
};
