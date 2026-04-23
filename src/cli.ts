import { defineCommand, runMain } from "citty";
import pc from "picocolors";
import { sync, status, init } from "./sync.js";
import { login, pushManifest, pullManifest, listProfiles, switchProfile } from "./remote.js";
import { loadManifest } from "./sync.js";
import { readFile } from "node:fs/promises";
import { kitYmlPath } from "./config.js";

const VERSION = "0.1.0";

const main = defineCommand({
  meta: {
    name: "pkit",
    version: VERSION,
    description: "Declarative package manager for Pi Coding Agent",
  },
  subCommands: {
    // ─── Core ───────────────────────────────────────────────
    init: defineCommand({
      meta: { name: "init", description: "Bootstrap kit.yml from current Pi installation" },
      async run() {
        await init();
      },
    }),

    sync: defineCommand({
      meta: { name: "sync", description: "Sync desired state (kit.yml) → real state" },
      args: {
        dry: {
          type: "boolean",
          alias: "d",
          description: "Dry run - show actions without executing",
          default: false,
        },
      },
      async run({ args }) {
        await sync(args.dry as boolean);
      },
    }),

    status: defineCommand({
      meta: { name: "status", description: "Show package status" },
      async run() {
        await status();
      },
    }),

    diff: defineCommand({
      meta: { name: "diff", description: "Show diff between kit.yml and real state (dry-run sync)" },
      async run() {
        await sync(true);
      },
    }),

    verify: defineCommand({
      meta: { name: "verify", description: "Run verify checks for all packages" },
      async run() {
        const manifest = await loadManifest();
        const { getProvider } = await import("./providers.js");
        const { inferInstallType } = await import("./manifest.js");

        console.log(pc.bold("\n  Verifying packages...\n"));

        for (const [name, pkg] of Object.entries(manifest.packages)) {
          const type = inferInstallType(pkg);
          const provider = getProvider(type);
          const ok = await provider.verify(name, pkg);
          console.log(`  ${ok ? pc.green("✅") : pc.red("❌")} ${name} (${type})`);
        }

        for (const [name, mcp] of Object.entries(manifest.mcp_servers)) {
          const provider = getProvider("mcp-server");
          const ok = await provider.verify(name, mcp);
          console.log(`  ${ok ? pc.green("✅") : pc.red("❌")} ${name} (mcp-server)`);
        }
        console.log();
      },
    }),

    upgrade: defineCommand({
      meta: { name: "upgrade", description: "Update non-pinned packages to latest" },
      async run() {
        console.log(pc.yellow("  Not yet implemented. Use 'pi update' for pi-native packages."));
      },
    }),

    prune: defineCommand({
      meta: { name: "prune", description: "Remove packages not in kit.yml" },
      async run() {
        console.log(pc.yellow("  Not yet implemented."));
      },
    }),

    // ─── Remote (gist-first) ────────────────────────────────
    login: defineCommand({
      meta: { name: "login", description: "Authenticate with GitHub or Codeberg" },
      args: {
        provider: {
          type: "string",
          alias: "p",
          description: "Remote provider (github or codeberg)",
          default: "github",
        },
      },
      async run({ args }) {
        await login(args.provider as "github" | "codeberg");
      },
    }),

    push: defineCommand({
      meta: { name: "push", description: "Upload kit.yml + lock to remote gist repo" },
      async run() {
        const content = await readFile(kitYmlPath(), "utf-8");
        await pushManifest(content);
      },
    }),

    pull: defineCommand({
      meta: { name: "pull", description: "Download kit.yml from remote gist repo" },
      async run() {
        const content = await pullManifest();
        const { writeFile } = await import("node:fs/promises");
        await writeFile(kitYmlPath(), content, "utf-8");
        console.log(pc.green("  ✅ Pulled kit.yml from remote.\n"));
      },
    }),

    profiles: defineCommand({
      meta: { name: "profiles", description: "List configured profiles" },
      async run() {
        await listProfiles();
      },
    }),

    profile: defineCommand({
      meta: { name: "profile", description: "Switch active profile" },
      args: {
        name: {
          type: "positional",
          description: "Profile name to switch to",
          required: true,
        },
      },
      async run({ args }) {
        await switchProfile(args.name as string);
      },
    }),
  },
});

runMain(main);
