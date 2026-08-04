import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// `base: './'` makes every asset path relative so the build works from
// any URL — GitHub Pages project sites (username.github.io/repo/),
// itch.io HTML embeds, or a plain file:// double-click of index.html.
export default defineConfig({
  base: "./",
  plugins: [react()],
  server: {
    host: true,
  },
});
