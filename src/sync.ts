import { VERSION } from "./version.js";
import { readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import pc from "picocolors";
import type { KitManifest, PackageManifest, McpServerManifest, SyncAction, InstallType, KitLock, LockEntry } from "./types.js";
import { parseManifest, validateManifest, inferInstallType, parseSource, expandTemplate } from "./manifest.js";
import { loadLock, saveLock, kitYmlPath, loadConfig, templateVars } from "./config.js";
import { getProvider } from "./providers.js";
import { pullManifest } from "./remote.js";

// ─── Self-update check ─────────────────────────────────────────
// ─── Self-update pkit ───────────────────────────────────────────
const MAX_UPDATE_ATTEMPTS = 3;

async function getInstalledPkitVersion(): Promise<string | null> {
  try {
    const pkgPath = join(homedir(), ".bun", "install", "global", "node_modules", "pi-depo", "package.json");
    const raw = await readFile(pkgPath, "utf-8");
    const { version } = JSON.parse(raw) as { version?: string };
    return version ?? null;
  } catch {
    return null;
  }
}

async function selfUpdate(currentVersion: string): Promise<boolean> {
  // Cap retries to prevent infinite loops (passed via env across restarts)
  const attempt = parseInt(process.env.PKIT_UPDATE_ATTEMPT ?? "0", 10);
  if (attempt >= MAX_UPDATE_ATTEMPTS) {
    console.log(pc.yellow(`  ⚠  pkit: update retry limit reached (${MAX_UPDATE_ATTEMPTS}), skipping auto-update`));
    return false;
  }

  try {
    const res = await fetch("https://registry.npmjs.org/pi-depo/latest", {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) return false;
    const data = (await res.json()) as { version: string };
    const latest = data.version;
    if (!latest || latest === currentVersion) return false;

    console.log(pc.yellow(`  ⬆  pkit ${currentVersion} → ${latest}, updating...`));
    const result = await Bun.$`bun i -g pi-depo@latest`.nothrow();
    if (result.exitCode !== 0) {
      console.log(pc.red(`  ❌ pkit update failed\n`));
      return false;
    }

    // Verify the install actually changed the version - npm registry
    // may lag behind the release tag, causing bun to install the old version
    const installedVersion = await getInstalledPkitVersion();
    if (!installedVersion || installedVersion === currentVersion) {
      console.log(pc.yellow(`  ⚠  pkit: registry shows ${latest} but installed is still ${currentVersion} - npm publish may be lagging, skipping restart`));
      return false;
    }

    console.log(pc.green(`  ✅ pkit updated to ${installedVersion}, restarting...\n`));
    const pkitBin = Bun.which("pkit");
    if (pkitBin) {
      const { spawnSync } = await import("child_process");
      spawnSync(pkitBin, process.argv.slice(2), {
        stdio: "inherit",
        env: { ...process.env, PKIT_UPDATE_ATTEMPT: String(attempt + 1) },
      });
    }
    process.exit(0);
  } catch {
    // network unavailable or timeout - skip silently
  }
  return false;
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
  await selfUpdate(VERSION);
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
        const detail = action.detail ? pc.dim(` (${action.detail})`) : "";
        console.log(pc.dim(`  ✓ ${action.name}${detail}`));
        break;
      }
      case "upgrade": {
        const provider = getProvider(action.type);
        console.log(pc.cyan(`  ⬆  ${action.name} ${action.detail ?? ""}...`));
        try {
          const pkg = manifest.packages[action.name] ?? manifest.mcp_servers[action.name];
          if (pkg) {
            await provider.install(action.name, pkg);
            console.log(pc.green(`  ✅ ${action.name} updated`));
          }
        } catch (e) {
          console.log(pc.red(`  ❌ ${action.name}: ${e instanceof Error ? e.message : e}`));
          action.status = "error";
          action.detail = e instanceof Error ? e.message : String(e);
        }
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
  return new Set((await getPiInstalledMap()).keys());
}

// Returns Map<basename, installPath>
async function getPiInstalledMap(): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  try {
    const result = await Bun.$`pi list`.quiet().nothrow();
    if (result.exitCode !== 0) return map;
    for (const line of result.stdout.toString().split("\n")) {
      const trimmed = line.trim();
      if (trimmed.startsWith("/")) {
        const parts = trimmed.split("/");
        const basename = parts[parts.length - 1];
        if (basename) map.set(basename, trimmed);
      }
    }
  } catch { /* ignore */ }
  return map;
}

// Read version from package.json at install path
async function readInstalledVersion(installPath: string): Promise<string | null> {
  try {
    const raw = await readFile(`${installPath}/package.json`, "utf-8");
    const { version } = JSON.parse(raw) as { version?: string };
    return version ?? null;
  } catch {
    return null;
  }
}

// Fetch latest version for an npm package spec from registry
async function fetchLatestNpmVersion(spec: string): Promise<string | null> {
  try {
    const res = await fetch(`https://registry.npmjs.org/${encodeURIComponent(spec)}/latest`, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { version?: string };
    return data.version ?? null;
  } catch {
    return null;
  }
}

// ─── Compute actions (async - checks real state + versions) ───────
async function computeActions(manifest: KitManifest): Promise<SyncAction[]> {
  const vars = templateVars();

  // 1. pi list once → Map<basename, installPath>
  const piInstalledMap = await getPiInstalledMap();

  // 2. For pi-native npm packages: read installed version + fetch latest in parallel
  type NpmCheck = { name: string; pkg: PackageManifest; installPath: string; npmSpec: string; pin?: string };
  const npmChecks: NpmCheck[] = [];

  for (const [name, pkg] of Object.entries(manifest.packages)) {
    const type = inferInstallType(pkg);
    if (type !== "pi-native" || pkg.rating === "disabled") continue;
    const installPath = piInstalledMap.get(name);
    if (!installPath) continue; // not installed, will be handled below
    const parsed = parseSource(expandTemplate(pkg.source, vars));
    if (parsed.type !== "npm") continue;
    npmChecks.push({ name, pkg, installPath, npmSpec: parsed.spec, pin: pkg.pin });
  }

  // Fire all version checks in parallel
  const [installedVersions, latestVersions] = await Promise.all([
    Promise.all(npmChecks.map(c => readInstalledVersion(c.installPath))),
    Promise.all(npmChecks.map(c => c.pin ? Promise.resolve(c.pin) : fetchLatestNpmVersion(c.npmSpec))),
  ]);

  // Build version state map: name → { installed, latest, outdated }
  const versionMap = new Map<string, { installed: string | null; latest: string | null; outdated: boolean }>();
  for (let i = 0; i < npmChecks.length; i++) {
    const installed = installedVersions[i] ?? null;
    const latest = latestVersions[i] ?? null;
    const outdated = !!(installed && latest && installed !== latest);
    versionMap.set(npmChecks[i]!.name, { installed, latest, outdated });
  }

  // 3. Parallel verify for non-pi-native
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

  const verifyResults = await Promise.all(
    pending.map(async entry => {
      if (entry.kind === "pkg") {
        if (entry.pkg.rating === "disabled") return false;
        return getProvider(entry.type).verify(entry.name, entry.pkg);
      } else {
        if (entry.mcp.rating === "disabled") return false;
        return getProvider("mcp-server").verify(entry.name, entry.mcp);
      }
    })
  );

  const verifyMap = new Map<string, boolean>();
  pending.forEach((entry, i) => verifyMap.set(entry.name, verifyResults[i]!));

  // 4. Build actions
  const actions: SyncAction[] = [];

  for (const [name, pkg] of Object.entries(manifest.packages)) {
    const type = inferInstallType(pkg);

    if (pkg.rating === "disabled") {
      const installed = type === "pi-native" ? piInstalledMap.has(name) : verifyMap.get(name);
      actions.push({ name, type, action: installed ? "remove" : "skip", status: "disabled" });
      continue;
    }

    if (type === "pi-native") {
      if (!piInstalledMap.has(name)) {
        actions.push({ name, type, action: "install", status: "missing" });
      } else {
        const v = versionMap.get(name);
        if (v?.outdated) {
          actions.push({ name, type, action: "upgrade", status: "outdated", detail: `${v.installed} → ${v.latest}` });
        } else {
          actions.push({ name, type, action: "skip", status: "synced", detail: v?.installed ?? undefined });
        }
      }
    } else {
      const verified = verifyMap.get(name) ?? false;
      actions.push({ name, type, action: verified ? "skip" : "install", status: verified ? "synced" : "missing" });
    }
  }

  for (const [name, mcp] of Object.entries(manifest.mcp_servers)) {
    if (mcp.rating === "disabled") {
      actions.push({ name, type: "mcp-server", action: verifyMap.get(name) ? "remove" : "skip", status: "disabled" });
    } else {
      const verified = verifyMap.get(name) ?? false;
      actions.push({ name, type: "mcp-server", action: verified ? "skip" : "install", status: verified ? "synced" : "missing" });
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
