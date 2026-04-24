import { $ } from "bun";
import { join } from "node:path";
import { homedir } from "node:os";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import type { RemoteProvider, PkitConfig } from "./types.js";
import { loadConfig, saveConfig, remoteRawUrl, remoteApiUrl, PKIT_DIR } from "./config.js";

// ─── GitHub CLI token extraction ────────────────────────────────
// Delegates auth entirely to the `gh` CLI - no OAuth App or PAT needed

async function githubTokenFromCLI(): Promise<string> {
  // Check gh is installed
  const whichResult = await $`which gh`.quiet().nothrow();
  if (whichResult.exitCode !== 0) {
    throw new Error(
      "GitHub CLI (gh) is not installed.\n" +
      "  Install it from https://cli.github.com/ then run: gh auth login"
    );
  }

  // Check gh is authenticated
  const statusResult = await $`gh auth status`.quiet().nothrow();
  if (statusResult.exitCode !== 0) {
    throw new Error(
      "GitHub CLI is not authenticated.\n" +
      "  Run: gh auth login"
    );
  }

  // Extract token
  const tokenResult = await $`gh auth token`.quiet().nothrow();
  if (tokenResult.exitCode !== 0 || !tokenResult.stdout.toString().trim()) {
    throw new Error(
      "Could not retrieve token from GitHub CLI.\n" +
      "  Try: gh auth login --scopes gist"
    );
  }

  return tokenResult.stdout.toString().trim();
}

// ─── Login command ──────────────────────────────────────────────
export async function login(provider: RemoteProvider = "github"): Promise<void> {
  console.log(`Logging in to ${provider}...`);

  let token: string;
  switch (provider) {
    case "github":
      token = await githubTokenFromCLI();
      break;
    case "codeberg":
      // TODO: implement Codeberg device flow
      throw new Error("Codeberg login not yet implemented. Use GitHub for now.");
    default:
      throw new Error(`Unknown provider: ${provider}`);
  }

  const config = await loadConfig();
  if (!config.auth) config.auth = {};
  config.auth[`${provider}_token`] = token;

  // Auto-detect user profile
  const user = await fetchUser(provider, token);
  console.log(`  Authenticated as: ${user}`);

  // Auto-setup profile with user's gists repo
  if (!config.profiles) config.profiles = {};
  if (!config.profiles.default) {
    config.profiles.default = {
      provider,
      user,
      repo: "gists",
      path: "pi/kit.yml",
    };
    config.active_profile = "default";
    console.log(`  Auto-configured profile 'default' → ${provider}:${user}/gists`);
  }

  await saveConfig(config);
  console.log("  ✅ Login saved.\n");
}

async function fetchUser(provider: RemoteProvider, token: string): Promise<string> {
  const apiUrl = remoteApiUrl(provider);
  const res = await fetch(`${apiUrl}/user`, {
    headers: {
      Authorization: `token ${token}`,
      Accept: "application/json",
    },
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch ${provider} user: ${res.status}`);
  }

  const data = (await res.json()) as { login: string };
  return data.login;
}

// ─── Push to remote ─────────────────────────────────────────────
export async function pushManifest(kitYmlContent: string): Promise<void> {
  const config = await loadConfig();
  const profile = getActiveProfile(config);

  if (!config.auth?.[`${profile.provider}_token`]) {
    throw new Error(`Not logged in to ${profile.provider}. Run 'pd login' first.`);
  }

  const token = config.auth[`${profile.provider}_token`]!;
  const lockContent = await readLocalLock();
  const kitPath = profile.path ?? "pi/kit.yml";

  if (profile.provider === "github" && profile.repo === "gists") {
    const gistId = await pushToGithubGist(token, kitPath, kitYmlContent, lockContent, profile.gist_id);
    if (gistId && gistId !== profile.gist_id) {
      profile.gist_id = gistId;
      await saveConfig(config);
    }
  } else {
    switch (profile.provider) {
      case "github":
        await pushToGithub(token, profile.user, profile.repo, kitPath, profile.branch ?? "main", kitYmlContent, lockContent);
        break;
      case "codeberg":
        await pushToCodeberg(token, profile.user, profile.repo, kitPath, profile.branch ?? "main", kitYmlContent, lockContent);
        break;
    }
  }

  console.log("  ✅ Pushed to remote.\n");
}

// ─── Pull from remote ───────────────────────────────────────────
export async function pullManifest(): Promise<string> {
  const config = await loadConfig();
  const profile = getActiveProfile(config);
  const token = config.auth?.[`${profile.provider}_token`];
  const kitPath = profile.path ?? "pi/kit.yml";

  if (profile.provider === "github" && profile.repo === "gists") {
    if (!token) throw new Error("Not logged in to github. Run 'pd login' first.");
    return await pullFromGithubGist(token, kitPath, profile.gist_id);
  }

  const headers: Record<string, string> = { Accept: "application/json" };
  if (token) headers.Authorization = `token ${token}`;

  const url = remoteRawUrl(profile.provider, profile.user, profile.repo, kitPath, profile.branch ?? "main");
  const res = await fetch(url, { headers });
  if (!res.ok) {
    if (res.status === 404) throw new Error(`No kit.yml found at ${profile.provider}:${profile.user}/${profile.repo}/${kitPath}\n  Push your local manifest first: pd push`);
    throw new Error(`Failed to pull: ${res.status}`);
  }
  return await res.text();
}

// ─── Get active profile ─────────────────────────────────────────
function getActiveProfile(config: PkitConfig): NonNullable<PkitConfig["profiles"]>[string] & { provider: RemoteProvider; user: string; repo: string } {
  const name = config.active_profile ?? "default";
  const profile = config.profiles?.[name];
  if (!profile) {
    throw new Error(
      `No profile '${name}' configured.\n` +
      `  Run 'pd login' to auto-configure, or set up manually in ~/.pkit/config.yml`
    );
  }
  return profile as NonNullable<PkitConfig["profiles"]>[string] & { provider: RemoteProvider; user: string; repo: string };
}

// ─── GitHub push (via Contents API) ─────────────────────────────
async function pushToGithub(
  token: string,
  owner: string,
  repo: string,
  path: string,
  branch: string,
  content: string,
  lockContent: string | null
): Promise<void> {
  const baseUrl = `https://api.github.com/repos/${owner}/${repo}/contents`;

  // Push kit.yml
  await pushFileToGithub(token, baseUrl, path, branch, content);

  // Push kit.lock.json alongside
  if (lockContent) {
    const lockPath = path.replace(/kit\.yml$/, "kit.lock.json");
    await pushFileToGithub(token, baseUrl, lockPath, branch, lockContent);
  }
}

async function pushFileToGithub(
  token: string,
  baseUrl: string,
  path: string,
  branch: string,
  content: string
): Promise<void> {
  const encodedPath = encodeURIComponent(path);
  const url = `${baseUrl}/${encodedPath}`;

  // Check if file exists to get SHA (required for update)
  let sha: string | undefined;
  const checkRes = await fetch(url, {
    headers: { Authorization: `token ${token}`, Accept: "application/json" },
  });
  if (checkRes.ok) {
    const data = (await checkRes.json()) as { sha: string };
    sha = data.sha;
  }

  const body: Record<string, unknown> = {
    message: `pd: update ${path}`,
    content: Buffer.from(content).toString("base64"),
    branch,
  };
  if (sha) body.sha = sha;

  const res = await fetch(url, {
    method: "PUT",
    headers: {
      Authorization: `token ${token}`,
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`GitHub push failed for ${path}: ${res.status} ${err}`);
  }
}

// ─── Codeberg push (Gitea API, same as GitHub Contents) ─────────
async function pushToCodeberg(
  token: string,
  owner: string,
  repo: string,
  path: string,
  branch: string,
  content: string,
  lockContent: string | null
): Promise<void> {
  const baseUrl = `https://codeberg.org/api/v1/repos/${owner}/${repo}/contents`;

  await pushFileToCodeberg(token, baseUrl, path, branch, content);

  if (lockContent) {
    const lockPath = path.replace(/kit\.yml$/, "kit.lock.json");
    await pushFileToCodeberg(token, baseUrl, lockPath, branch, lockContent);
  }
}

async function pushFileToCodeberg(
  token: string,
  baseUrl: string,
  path: string,
  branch: string,
  content: string
): Promise<void> {
  const url = `${baseUrl}/${path}`;

  let sha: string | undefined;
  const checkRes = await fetch(url, {
    headers: { Authorization: `token ${token}` },
  });
  if (checkRes.ok) {
    const data = (await checkRes.json()) as { sha: string };
    sha = data.sha;
  }

  const body: Record<string, unknown> = {
    message: `pd: update ${path}`,
    content: Buffer.from(content).toString("base64"),
    branch,
  };
  if (sha) body.sha = sha;

  const res = await fetch(url, {
    method: "PUT",
    headers: {
      Authorization: `token ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Codeberg push failed for ${path}: ${res.status} ${err}`);
  }
}

// ─── Helpers ────────────────────────────────────────────────────
async function readLocalLock(): Promise<string | null> {
  const lockPath = join(process.cwd(), "kit.lock.json");
  if (!existsSync(lockPath)) return null;
  return await readFile(lockPath, "utf-8");
}

// ─── Profile management ─────────────────────────────────────────
export async function listProfiles(): Promise<void> {
  const config = await loadConfig();
  const profiles = config.profiles ?? {};
  const active = config.active_profile ?? "default";

  if (Object.keys(profiles).length === 0) {
    console.log("  No profiles configured. Run 'pd login' to create one.");
    return;
  }

  for (const [name, profile] of Object.entries(profiles)) {
    const marker = name === active ? "→" : " ";
    console.log(`  ${marker} ${name}: ${profile.provider}:${profile.user}/${profile.repo}/${profile.path ?? "pi/kit.yml"}`);
  }
}

export async function switchProfile(name: string): Promise<void> {
  const config = await loadConfig();
  if (!config.profiles?.[name]) {
    throw new Error(`Profile '${name}' not found. Available: ${Object.keys(config.profiles ?? {}).join(", ")}`);
  }
  config.active_profile = name;
  await saveConfig(config);
  console.log(`  Switched to profile: ${name}`);
}
