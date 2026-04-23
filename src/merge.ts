import { readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import deepmerge from "deepmerge";
import { piSettingsPath, piMcpPath } from "./config.js";

// ─── Deep merge JSON files ──────────────────────────────────────
// Merges a JSON patch into an existing JSON file, preserving
// keys that aren't in the patch. Idempotent.

export async function mergeIntoJsonFile(
  filePath: string,
  patch: Record<string, unknown>
): Promise<void> {
  let existing: Record<string, unknown> = {};

  if (existsSync(filePath)) {
    const content = await readFile(filePath, "utf-8");
    try {
      existing = JSON.parse(content);
    } catch {
      existing = {};
    }
  }

  const merged = deepmerge(existing, patch, {
    arrayMerge: (_target, source) => source, // arrays: replace, don't concat
  });

  await writeFile(filePath, JSON.stringify(merged, null, 2) + "\n", "utf-8");
}

// ─── Remove keys from JSON file ─────────────────────────────────
// Removes specific keys (by dot-path) from a JSON file.
// e.g. removePathsFromJson(path, ["mcpServers.context-mode"])

export function getByPath(obj: unknown, path: string): unknown {
  const keys = path.split(".");
  let current = obj;
  for (const key of keys) {
    if (current && typeof current === "object" && key in current) {
      current = (current as Record<string, unknown>)[key];
    } else {
      return undefined;
    }
  }
  return current;
}

export async function removeKeysFromJson(
  filePath: string,
  dotPaths: string[]
): Promise<void> {
  if (!existsSync(filePath)) return;

  const content = await readFile(filePath, "utf-8");
  let data: Record<string, unknown>;
  try {
    data = JSON.parse(content);
  } catch {
    return;
  }

  for (const dotPath of dotPaths) {
    const keys = dotPath.split(".");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let current: any = data;
    for (let i = 0; i < keys.length - 1; i++) {
      if (current && typeof current === "object" && keys[i]! in current) {
        current = current[keys[i]!];
      } else {
        current = null;
        break;
      }
    }
    if (current && typeof current === "object") {
      const lastKey = keys[keys.length - 1]!;
      if (lastKey in current) {
        delete current[lastKey];
      }
    }
  }

  await writeFile(filePath, JSON.stringify(data, null, 2) + "\n", "utf-8");
}
