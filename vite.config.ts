import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { viteSingleFile } from "vite-plugin-singlefile";

// Build targets
//   vite build                       -> dist/               private data layer (data/v32) in the working repo
//   vite build --mode single         -> dist-single/        one self-contained file (opens from disk or an email attachment)
//   vite build --mode public         -> dist-public/        public data layer (data/public), for GitHub Pages
//   vite build --mode public-single  -> dist-public-single/ public data layer, one file
// The data layer can also be forced with VITE_DATA_LAYER=public|v32. A checkout without data/v32 (the public repo) always
// uses data/public, and there `vite build` writes dist/ so the Pages workflow stays a plain build.
//
// Base path: "./" (relative) works at a custom-domain root and under https://<user>.github.io/<repo>/ alike, because the app
// is one page with no client-side routes. Set VITE_BASE (for example "/mh-cea-tool/") only if absolute URLs are ever needed.
export default defineConfig(({ mode }) => {
  const env = { ...loadEnv(mode, process.cwd(), "VITE_"), ...process.env };
  const hasPrivate = existsSync(fileURLToPath(new URL("./data/v32/meta.json", import.meta.url)));
  const layer = env.VITE_DATA_LAYER === "public" || mode.startsWith("public") || !hasPrivate ? "public" : "v32";
  const single = mode === "single" || mode === "public-single";
  const outDir = (layer === "public" && hasPrivate ? "dist-public" : "dist") + (single ? "-single" : "");
  return {
    plugins: single ? [react(), viteSingleFile({ removeViteModuleLoader: true })] : [react()],
    base: env.VITE_BASE || "./",
    resolve: { alias: { "@data": fileURLToPath(new URL(`./data/${layer}`, import.meta.url)) } },
    build: { outDir, sourcemap: !single, target: "es2020", cssCodeSplit: false, assetsInlineLimit: single ? 100_000_000 : 4096 },
    test: { globals: true, environment: "node", include: ["tests/**/*.test.ts"] },
  };
});
