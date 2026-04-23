import { readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import pc from "picocolors";
import type { KitManifest, PackageManifest, McpServerManifest, SyncAction, InstallType, KitLock, LockEntry } from "./types.js";
import { parseManifest, validateManifest, inferInstallType } from "./manifest.js";
import { loadLock, saveLock, kitYmlPath, loadConfig } from "./config.js";
import { getProvider } from "./providers.js";
import { pullManifest } from "./remote.js";

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
  const manifest = await loadManifest();
  const errors = validateManifest(manifest);

  if (errors.length > 0) {
    console.log(pc.red("\n  ⚠ Manifest validation issues:"));
    for (const err of errors) {
      console.log(pc.red(`    ${err.path}: ${err.message}`));
    }
    console.log();
  }

  const actions = computeActions(manifest);

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
  const actions = computeActions(manifest);
  printActions(actions);
}

// ─── Compute actions ────────────────────────────────────────────
function computeActions(manifest: KitManifest): SyncAction[] {
  const actions: SyncAction[] = [];

  // Process packages
  for (const [name, pkg] of Object.entries(manifest.packages)) {
    const type = inferInstallType(pkg);
    actions.push({
      name,
      type,
      action: computeActionForPkg(name, pkg, type),
      status: computeStatusForPkg(name, pkg, type),
    });
  }

  // Process MCP servers
  for (const [name, mcp] of Object.entries(manifest.mcp_servers)) {
    actions.push({
      name,
      type: "mcp-server",
      action: computeActionForMcp(name, mcp),
      status: computeStatusForMcp(name, mcp),
    });
  }

  return actions;
}

function computeActionForPkg(name: string, pkg: PackageManifest, type: InstallType): SyncAction["action"] {
  if (pkg.rating === "disabled") return "remove";
  // For now, always attempt install if not verified
  // A more sophisticated version would check lock + verify
  return "install";
}

function computeStatusForPkg(name: string, pkg: PackageManifest, type: InstallType): SyncAction["status"] {
  if (pkg.rating === "disabled") return "disabled";
  return "missing"; // Will be refined by actual verify
}

function computeActionForMcp(name: string, mcp: McpServerManifest): SyncAction["action"] {
  if (mcp.rating === "disabled") return "remove";
  return "install";
}

function computeStatusForMcp(name: string, mcp: McpServerManifest): SyncAction["status"] {
  if (mcp.rating === "disabled") return "disabled";
  return "missing";
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
