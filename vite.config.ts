import { defineConfig } from "vite";

// Relative base ("./") so the build works under any path: a GitHub Pages project
// site (https://<user>.github.io/hwansang-web/), a custom domain, or a local
// `vite preview`. Vite rewrites every hashed asset URL relative to index.html,
// so no host-specific prefix is baked in.
export default defineConfig({
  base: "./",
  build: {
    target: "es2022",
    outDir: "dist",
    sourcemap: false,
  },
  server: {
    host: true,
    port: 5173,
  },
});
