import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/cli.ts"],
  format: ["esm"],
  target: "node20",
  outDir: "dist",
  splitting: false,
  sourcemap: true,
  external: ["bun"],
  banner: {
    js: "#!/usr/bin/env bun",
  },
});
