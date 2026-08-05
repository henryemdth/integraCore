import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  target: "node18",
  outDir: "dist-bundle",
  bundle: true,
  splitting: false,
  shims: true,
  external: ["better-sqlite3"],
  clean: true,
});