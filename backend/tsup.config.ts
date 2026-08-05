import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["cjs"],
  target: "node22",
  platform: "node",
  outDir: "dist",
  bundle: true,
  splitting: false,
  shims: true,
  noExternal: [/^(?!better-sqlite3).*$/],
  external: ["better-sqlite3"],
  clean: true,
});