# AGENTS.md

Rules for AI agents contributing to this project.

## Formatting Rules

- **Standard dash only**: Never use em-dash (`—`), en-dash (`–`), or any Unicode dash variant. Always use the ASCII hyphen-minus (`-`) character. This applies to code, comments, documentation, commit messages, and prose.

## Project Overview

pi-depo is a declarative package manager for Pi Coding Agent. It manages skills, extensions, hooks, and MCP servers through a single `kit.yml` manifest, with cloud sync via GitHub/Codeberg gist repos.

## Architecture

- **Runtime**: Bun
- **Language**: TypeScript (strict)
- **Config format**: YAML (`kit.yml`)
- **CLI framework**: Citty
- **Distribution**: npm (via GitHub Actions on tag push)

### Provider System

Four install providers, each with `install`, `remove`, `verify`, `status`:

| Provider | Type | Mechanism |
|----------|------|-----------|
| `pi-native` | pi-native | Delegates to `pi install` / `pi remove` |
| `custom` | custom | Sequential shell steps + JSON config merge |
| `skill` | skill | Clone repo, copy subpath to `~/.pi/agent/skills/` |
| `mcp-server` | mcp-server | Install binary + deep merge into `mcp.json` |

### Key Files

- `src/types.ts` - All type definitions
- `src/manifest.ts` - YAML parsing, validation, template expansion
- `src/providers.ts` - Install/remove/verify logic per provider
- `src/remote.ts` - GitHub/Codeberg gist sync, OAuth device flow
- `src/sync.ts` - Core sync engine, status computation, init command
- `src/merge.ts` - Deep merge JSON files (settings.json, mcp.json)
- `src/config.ts` - Path resolution, config I/O
- `src/cli.ts` - CLI command definitions

### Design Principles

1. **Declarative over imperative**: kit.yml is the source of truth. Code reconciles state.
2. **Idempotent**: Running `pkit sync` multiple times must produce the same result.
3. **Gist-first**: A new machine should bootstrap with `bun i -g pi-depo` -> `pkit login` -> `pkit sync` only.
4. **Pi delegates, we orchestrate**: Never reimplement what `pi install` already does. Wrap it.
5. **Resilient to upstream changes**: If Pi evolves (new dirs, new install methods), only the provider layer needs updating.

## Development

```sh
bun install
bun run dev -- --help     # Run locally with watch
bun run build             # Build for production
bun test                  # Run tests
```

## Commit Conventions

Use conventional commits: `feat:`, `fix:`, `chore:`, `docs:`, `refactor:`.

## Release

1. Update version in `package.json` and `src/cli.ts`
2. Commit with message `chore: bump to x.y.z`
3. Tag: `git tag vx.y.z`
4. Push: `git push && git push --tags`
5. GitHub Actions builds, creates release, and publishes to npm automatically

## Known Issues

- TypeScript strict mode has import compatibility warnings with CJS deps (js-yaml, deepmerge, picocolors). These don't affect Bun runtime but `tsc --noEmit` will report errors. Acceptable for now.
- Codeberg OAuth device flow is not yet implemented - only GitHub works for `pkit login`.
