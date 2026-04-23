import { VERSION } from "./version.js";
import { readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import pc from "picocolors";
import type { KitManifest, PackageManifest, McpServerManifest, SyncAction, InstallType, KitLock, LockEntry } from "./types.js";
import { parseManifest, validateManifest, inferInstallType } from "./manifest.js";
import { loadLock, saveLock, kitYmlPath, loadConfig } from "./config.js";
import { getProvider } from "./providers.js";
import { pullManifest } from "./remote.js";

// ─── Self-update check ─────────────────────────────────────────
async function checkSelfUpdate(currentVersion: string): Promise<void> {
  try {
    const res = await fetch("https://registry.npmjs.org/pi-depo/latest", {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) return;
    const data = (await res.json()) as { version: string };
    const latest = data.version;
    if (latest && latest !== currentVersion) {
      console.log(pc.yellow(`  ⬆  pkit ${currentVersion} → ${latest} available: bun i -g pi-depo@${latest}\n`));
    }
  } catch {
    // network unavailable or timeout - silently skip
  }
}

// ─── Load manifest (gist-first) ─────────────────────────────────
export async function loadManifest(cwd?: string): Promise<KitManifest> {
  const localPath = kitYmlPath(cwd);

  // 1. Try local kit.yml first
  if (existsSync(localPath)) {
    const content = await readFile(localPath, "utf-8");
    return parseManifest(content);
  }

  // 2. No local file → try pulling from remote
  console.log(pc.yellow("  No kit.yml found locally."));

  const config = await loadConfig();
  if (config.auth?.github_token || config.auth?.codeberg_token) {
    console.log(pc.dim("  Pulling from remote..."));
    try {
      const remoteContent = await pullManifest();
      // Save locally
      await writeFile(localPath, remoteContent, "utf-8");
      console.log(pc.green("  ✅ Pulled kit.yml from remote and saved locally."));
      return parseManifest(remoteContent);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.log(pc.red(`  Failed to pull: ${msg}`));
    }
  }

  // 3. No local, no remote → guide the user
  throw new Error(
    "No kit.yml found. Options:\n" +
    "  1. Run 'pkit login' then 'pkit sync' to pull from your gist repo\n" +
    "  2. Run 'pkit init' to bootstrap from your current Pi installation\n" +
    "  3. Create kit.yml manually (see docs)"
  );
}

// ─── Sync command ───────────────────────────────────────────────
export async function sync(dryRun = false): Promise<SyncAction[]> {
  await checkSelfUpdate(VERSION);
  const manifest = await loadManifest();
  const errors = validateManifest(manifest);

  if (errors.length > 0) {
    console.log(pc.red("\n  ⚠ Manifest validation issues:"));
    for (const err of errors) {
      console.log(pc.red(`    ${err.path}: ${err.message}`));
    }
    console.log();
  }

  const actions = await computeActions(manifest);

  if (dryRun) {
    printActions(actions);
    return actions;
  }

  // Execute actions
  for (const action of actions) {
    switch (action.action) {
      case "install": {
        const provider = getProvider(action.type);
        console.log(pc.cyan(`  Installing ${action.name} (${action.type})...`));
        try {
          const pkg = manifest.packages[action.name] ?? manifest.mcp_servers[action.name];
          if (pkg) {
            await provider.install(action.name, pkg);
            console.log(pc.green(`  ✅ ${action.name}`));
          }
        } catch (e) {
          console.log(pc.red(`  ❌ ${action.name}: ${e instanceof Error ? e.message : e}`));
          action.status = "error";
          action.detail = e instanceof Error ? e.message : String(e);
        }
        break;
      }
      case "remove": {
        const provider = getProvider(action.type);
        console.log(pc.yellow(`  Removing ${action.name} (disabled)...`));
        try {
          const pkg = manifest.packages[action.name] ?? manifest.mcp_servers[action.name];
          if (pkg) {
            await provider.remove(action.name, pkg);
            console.log(pc.green(`  🗑 ${action.name} removed`));
          }
        } catch (e) {
          console.log(pc.red(`  ❌ Failed to remove ${action.name}: ${e}`));
        }
        break;
      }
      case "skip": {
        console.log(pc.dim(`  ✓ ${action.name} (synced)`));
        break;
      }
      case "verify": {
        const provider = getProvider(action.type);
        const pkg = manifest.packages[action.name] ?? manifest.mcp_servers[action.name];
        if (pkg) {
          const ok = await provider.verify(action.name, pkg);
          if (ok) {
            console.log(pc.green(`  ✓ ${action.name} (verified)`));
          } else {
            console.log(pc.yellow(`  ⚠ ${action.name} (verify failed - needs reinstall)`));
          }
        }
        break;
      }
    }
  }

  // Update lock file
  await updateLock(manifest, actions);

  console.log(pc.green("\n  Sync complete.\n"));
  return actions;
}

// ─── Status command ─────────────────────────────────────────────
export async function status(): Promise<void> {
  const manifest = await loadManifest();
  const actions = await computeActions(manifest);
  printActions(actions);
}

// ─── Get installed pi-native packages (single pi list call) ─────
async function getInstalledPiPackages(): Promise<Set<string>> {
  try {
    const result = await Bun.$`pi list`.quiet().nothrow();
    if (result.exitCode !== 0) return new Set();

    const installed = new Set<string>();
    for (const line of result.stdout.toString().split("\n")) {
      const trimmed = line.trim();
      // Path lines: /home/.../.../node_modules/@scope/pkg-name  or  /home/.../pkg-name
      // Take the last path component as the canonical short name
      if (trimmed.startsWith("/")) {
        const parts = trimmed.split("/");
        const basename = parts[parts.length - 1];
        if (basename) installed.add(basename);
      }
    }
    return installed;
  } catch {
    return new Set();
  }
}

// ─── Compute actions (async - checks real state) ─────────────────
async function computeActions(manifest: KitManifest): Promise<SyncAction[]> {
  // Run pi list once + all custom/skill/mcp verify checks in parallel
  const piInstalled = await getInstalledPiPackages();

  // Collect all non-pi-native entries that need a verify check
  type PendingEntry =
    | { kind: "pkg"; name: string; pkg: PackageManifest; type: InstallType }
    | { kind: "mcp"; name: string; mcp: McpServerManifest };

  const pending: PendingEntry[] = [];

  for (const [name, pkg] of Object.entries(manifest.packages)) {
    const type = inferInstallType(pkg);
    if (type !== "pi-native") pending.push({ kind: "pkg", name, pkg, type });
  }
  for (const [name, mcp] of Object.entries(manifest.mcp_servers)) {
    pending.push({ kind: "mcp", name, mcp });
  }

  // Parallel verify for non-pi-native
  const verifyResults = await Promise.all(
    pending.map(async entry => {
      if (entry.kind === "pkg") {
        if (entry.pkg.rating === "disabled") return false;
        const provider = getProvider(entry.type);
        return provider.verify(entry.name, entry.pkg);
      } else {
        if (entry.mcp.rating === "disabled") return false;
        const provider = getProvider("mcp-server");
        return provider.verify(entry.name, entry.mcp);
      }
    })
  );

  const verifyMap = new Map<string, boolean>();
  pending.forEach((entry, i) => verifyMap.set(entry.name, verifyResults[i]!));

  const actions: SyncAction[] = [];

  // Pi-native packages - decided from piInstalled set, no extra I/O
  for (const [name, pkg] of Object.entries(manifest.packages)) {
    const type = inferInstallType(pkg);
    if (type !== "pi-native") continue;

    if (pkg.rating === "disabled") {
      // Only bother removing if actually installed
      if (piInstalled.has(name)) {
        actions.push({ name, type, action: "remove", status: "disabled" });
      } else {
        actions.push({ name, type, action: "skip", status: "disabled" });
      }
    } else if (piInstalled.has(name)) {
      actions.push({ name, type, action: "skip", status: "synced" });
    } else {
      actions.push({ name, type, action: "install", status: "missing" });
    }
  }

  // Non-pi-native packages - decided from parallel verify results
  for (const [name, pkg] of Object.entries(manifest.packages)) {
    const type = inferInstallType(pkg);
    if (type === "pi-native") continue;

    if (pkg.rating === "disabled") {
      actions.push({ name, type, action: "remove", status: "disabled" });
    } else if (verifyMap.get(name)) {
      actions.push({ name, type, action: "skip", status: "synced" });
    } else {
      actions.push({ name, type, action: "install", status: "missing" });
    }
  }

  // MCP servers
  for (const [name, mcp] of Object.entries(manifest.mcp_servers)) {
    if (mcp.rating === "disabled") {
      actions.push({ name, type: "mcp-server", action: "remove", status: "disabled" });
    } else if (verifyMap.get(name)) {
      actions.push({ name, type: "mcp-server", action: "skip", status: "synced" });
    } else {
      actions.push({ name, type: "mcp-server", action: "install", status: "missing" });
    }
  }

  return actions;
}

// ─── Print actions ──────────────────────────────────────────────
const STATUS_ICONS: Record<string, string> = {
  synced: "✅",
  missing: "❌",
  outdated: "⬆️",
  disabled: "🚫",
  orphan: "⚠️",
  drift: "🔧",
  verify_fail: "❓",
  error: "💀",
};

function printActions(actions: SyncAction[]): void {
  console.log(pc.bold("\n  Package Status:\n"));

  // Group by type
  const grouped = new Map<InstallType, SyncAction[]>();
  for (const action of actions) {
    const list = grouped.get(action.type) ?? [];
    list.push(action);
    grouped.set(action.type, list);
  }

  for (const [type, items] of grouped) {
    console.log(pc.dim(`  [${type}]`));
    for (const item of items) {
      const icon = STATUS_ICONS[item.status] ?? "?";
      const rating = item.status === "disabled" ? pc.dim(item.status) : "";
      const detail = item.detail ? pc.dim(` (${item.detail})`) : "";
      console.log(`  ${icon} ${item.name} ${rating}${detail}`);
    }
    console.log();
  }
}

// ─── Update lock ────────────────────────────────────────────────
async function updateLock(manifest: KitManifest, actions: SyncAction[]): Promise<void> {
  const lock: KitLock = {
    version: 1,
    synced_at: new Date().toISOString(),
    packages: {},
    mcp_servers: {},
  };

  for (const action of actions) {
    if (action.status === "error") continue;
    const entry: LockEntry = {
      type: action.type,
      installed: action.status === "synced" || action.action === "install",
      verified: action.status === "synced",
      installed_at: new Date().toISOString(),
    };

    if (action.type === "mcp-server") {
      lock.mcp_servers[action.name] = entry;
    } else {
      lock.packages[action.name] = entry;
    }
  }

  await saveLock(lock);
}

// ─── Init command ───────────────────────────────────────────────
export async function init(): Promise<void> {
  console.log(pc.bold("\n  Bootstrapping kit.yml from current Pi installation...\n"));

  // Read pi list output
  let piListOutput = "";
  try {
    const result = await Bun.$`pi list`.quiet();
    piListOutput = result.text();
  } catch {
    console.log(pc.yellow("  ⚠ Pi not found or not installed. Creating empty kit.yml."));
  }

  // Parse installed packages
  const installedPackages = piListOutput
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const manifest: KitManifest = {
    meta: {
      pi_version: "0.69.0",
      home: "~",
    },
    packages: {},
    mcp_servers: {},
  };

  // Add installed packages
  for (const pkg of installedPackages) {
    // Try to detect source type from the line
    if (pkg.startsWith("npm:")) {
      manifest.packages[pkg.replace("npm:", "").split("@")[0]!] = {
        source: pkg,
        rating: "useful",
      };
    } else if (pkg.startsWith("git:")) {
      const name = pkg.split("/").pop()?.split("@")[0] ?? pkg;
      manifest.packages[name] = {
        source: pkg,
        rating: "useful",
      };
    }
  }

  // Write kit.yml
  const { serializeManifest } = await import("./manifest.js");
  const content = serializeManifest(manifest);
  await writeFile(kitYmlPath(), content, "utf-8");

  console.log(pc.green(`  ✅ Created kit.yml with ${Object.keys(manifest.packages).length} packages.`));
  console.log(pc.dim("  Review and adjust ratings, then run 'pkit push' to save to your gist.\n"));
}
