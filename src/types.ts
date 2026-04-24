// ─── Package rating ──────────────────────────────────────────────
export type Rating = "core" | "useful" | "debatable" | "disabled";

// ─── Install types ──────────────────────────────────────────────
export type InstallType = "pi-native" | "custom" | "skill" | "mcp-server";

// ─── Source types ───────────────────────────────────────────────
export interface NpmSource {
  type: "npm";
  spec: string; // e.g. "@aliou/pi-guardrails" or "@foo/bar@1.2.3"
}

export interface GitSource {
  type: "git";
  url: string; // e.g. "github.com/mksglu/context-mode"
  ref?: string; // tag, commit, branch
}

export interface LocalSource {
  type: "local";
  path: string; // e.g. "{{home}}/bin/woco-mcp"
}

export type Source = NpmSource | GitSource | LocalSource;

// ─── Custom package steps ───────────────────────────────────────
export interface CustomSteps {
  clone?: string;
  build?: string;
  postinstall?: string;
  [key: string]: string | undefined;
}

// ─── Config merge target ────────────────────────────────────────
export interface ConfigMerge {
  target: string; // e.g. "{{home}}/.pi/agent/mcp.json"
  json: string; // JSON string to deep-merge into target
}

// ─── Verify check ───────────────────────────────────────────────
export interface VerifyCheck {
  check: string; // shell command, exit 0 = pass
  description?: string;
}

// ─── Package manifest entry ─────────────────────────────────────
export interface PackageManifest {
  source: string; // raw source string, parsed at runtime
  rating: Rating;
  type?: InstallType; // defaults to "pi-native" if not specified
  pin?: string; // version pin
  reason?: string; // only for rating="disabled"

  // custom type fields
  steps?: CustomSteps;
  config_merge?: ConfigMerge;
  verify?: VerifyCheck;

  // skill type fields
  skill_subpath?: string; // subdir within repo to copy
  target?: string; // deploy destination

  // mcp-server type fields
  args?: string[];
  env?: Record<string, string>; // "env:VAR_NAME" → resolved from process.env
}

// ─── MCP server entry (top-level in kit.yml) ───────────────────
export interface McpServerManifest {
  source: string;
  rating: Rating;
  args?: string[];
  env?: Record<string, string>;
  verify?: VerifyCheck;
  pin?: string;
  reason?: string; // for disabled
}

// ─── Remote config (gist/repo) ──────────────────────────────────
export type RemoteProvider = "github" | "codeberg";

export interface RemoteConfig {
  provider: RemoteProvider;
  user: string;
  repo: string; // e.g. "gists" or "pi-depo-config"
  path?: string; // subpath within repo, e.g. "pi/kit.yml"
  branch?: string;
}

// ─── Full kit.yml manifest ──────────────────────────────────────
export interface KitManifest {
  meta: {
    pi_version?: string;
    home?: string; // default "~", overridable
  };
  remote?: RemoteConfig;
  packages: Record<string, PackageManifest>;
  mcp_servers: Record<string, McpServerManifest>;
}

// ─── Lock file entry ────────────────────────────────────────────
export interface LockEntry {
  type: InstallType;
  installed: boolean;
  version?: string;
  head?: string; // git HEAD hash for custom/git packages
  verified: boolean;
  installed_at: string; // ISO timestamp
}

// ─── Lock file ──────────────────────────────────────────────────
export interface KitLock {
  version: 1;
  synced_at: string;
  remote?: {
    provider: RemoteProvider;
    user: string;
    repo: string;
    commit: string; // the commit we last pulled from
  };
  packages: Record<string, LockEntry>;
  mcp_servers: Record<string, LockEntry>;
}

// ─── Sync result ────────────────────────────────────────────────
export type PackageStatus =
  | "synced"      // installed and matches manifest
  | "missing"     // not installed
  | "outdated"    // installed but newer version available
  | "disabled"    // rating=disabled
  | "orphan"      // installed but not in manifest
  | "drift"       // installed but state doesn't match lock
  | "verify_fail" // installed but verify check fails
  | "error";      // something went wrong

export interface SyncAction {
  name: string;
  type: InstallType;
  action: "install" | "remove" | "upgrade" | "skip" | "verify";
  status: PackageStatus;
  detail?: string;
}

// ─── Auth config (~/.pkit/config.yml) ───────────────────────────
export interface PkitConfig {
  auth?: {
    github_token?: string;
    codeberg_token?: string;
  };
  active_profile?: string;
  profiles?: Record<string, {
    provider: RemoteProvider;
    user: string;
    repo: string;
    path?: string;
    branch?: string;
    gist_id?: string;    // GitHub Gist ID, set after first push
    public?: boolean;    // Gist visibility (default: false = private)
  }>;
}
