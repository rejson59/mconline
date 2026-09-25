import path from "path";
import { fileURLToPath } from "url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { viteSingleFile } from "vite-plugin-singlefile";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// https://vite.dev/config/
export default defineConfig({
  // Relative base ("") keeps every emitted asset URL relative to index.html.
  // That is what makes the same build work on GitHub Pages project sites
  // (https://user.github.io/<repo>/), on a custom domain and even from file://
  base: "./",
  server: {
    host: "0.0.0.0",
    allowedHosts: true,
  },
  plugins: [react(), tailwindcss(), viteSingleFile()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  build: {
    target: "es2020",
    // The single-file plugin inlines JS + CSS into index.html, so the game is
    // one self-contained HTML file plus the optional menu background image.
    assetsInlineLimit: 100_000_000,
    chunkSizeWarningLimit: 4096,
    reportCompressedSize: false,
    sourcemap: false,
  },
});
