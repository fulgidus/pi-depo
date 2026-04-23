# pi-kit

Declarative package manager for [Pi Coding Agent](https://github.com/badlogic/pi-mono). Manage skills, extensions, hooks, and MCP servers from a single `kit.yml` — synced across machines via GitHub/Codeberg.

## Install

```bash
bun i -g pi-kit
```

## Quick Start (new machine)

```bash
pkit login              # Authenticate with GitHub
pkit sync               # No kit.yml? Pulls from your gist repo + installs everything
```

## Quick Start (existing machine)

```bash
pkit init               # Bootstrap kit.yml from current `pi list`
# Review kit.yml, adjust ratings
pkit push               # Save to your gist repo for cross-machine sync
```

## Commands

### Core

| Command | Description |
|---------|-------------|
| `pkit init` | Bootstrap `kit.yml` from current Pi installation |
| `pkit sync` | Desired state → real state. Idempotent. |
| `pkit status` | Show package status (synced/missing/disabled/orphan) |
| `pkit diff` | Dry-run sync — show what would change |
| `pkit verify` | Run verify checks for all packages |
| `pkit upgrade` | Update non-pinned packages to latest |
| `pkit prune` | Remove packages not in kit.yml |

### Remote (gist-first)

| Command | Description |
|---------|-------------|
| `pkit login` | Authenticate with GitHub/Codeberg (OAuth device flow) |
| `pkit push` | Upload `kit.yml` + `kit.lock.json` to gist repo |
| `pkit pull` | Download `kit.yml` from gist repo |
| `pkit profiles` | List configured profiles (work, personal, etc.) |
| `pkit profile <name>` | Switch active profile |

## kit.yml Format

Four package types, one manifest:

```yaml
meta:
  pi_version: "0.69.0"
  home: "~"

remote:
  provider: github        # or codeberg
  user: fulgidus
  repo: gists             # your gists repo
  path: pi/kit.yml        # path within repo

packages:
  # ── pi-native: installed via `pi install` ──
  pi-guardrails:
    source: "npm:@aliou/pi-guardrails"
    rating: core           # core | useful | debatable | disabled

  tokenjuice:
    source: "npm:tokenjuice"
    rating: core
    pin: "0.3.0"          # pinned version, skipped by upgrade

  diagram-design:
    source: "git:github.com/cathrynlattery/diagram-design"
    rating: useful

  # ── custom: declarative install sequence ──
  context-mode:
    source: "git:github.com/mksglu/context-mode"
    rating: core
    type: custom
    steps:
      clone: "git clone {{source}} {{home}}/.pi/extensions/context-mode"
      build: "cd {{home}}/.pi/extensions/context-mode && npm install && npm run build"
    config_merge:
      target: "{{home}}/.pi/agent/mcp.json"
      json: |
        {
          "mcpServers": {
            "context-mode": {
              "command": "node",
              "args": ["{{home}}/.pi/extensions/context-mode/node_modules/context-mode/start.mjs"]
            }
          }
        }
    verify:
      check: "test -f {{home}}/.pi/extensions/context-mode/node_modules/context-mode/start.mjs"

  # ── skill: deploy SKILL.md to target ──
  my-custom-skill:
    source: "git:github.com/someone/skill-repo"
    rating: useful
    type: skill
    skill_subpath: "skills/my-skill"
    target: "{{home}}/.pi/agent/skills/my-skill"

  # ── disabled: with reason ──
  pi-lens:
    source: "npm:pi-lens"
    rating: disabled
    reason: "Slows startup exponentially with big codebases"

mcp_servers:
  github:
    source: "npm:@modelcontextprotocol/server-github"
    rating: core
    env:
      GITHUB_PERSONAL_ACCESS_TOKEN: "env:GITHUB_TOKEN"    # resolved from process.env

  postgres:
    source: "npm:@modelcontextprotocol/server-postgres"
    rating: useful
    args:
      - "postgresql://localhost/mydb"

  woco-stats:
    source: "local:{{home}}/bin/woco-mcp"
    rating: core
    verify:
      check: "test -x {{home}}/bin/woco-mcp"
```

## Template Variables

Available in all string fields:

| Variable | Resolves to |
|----------|-------------|
| `{{home}}` | `$HOME` |
| `{{user}}` | `$USER` |
| `{{cwd}}` | Current working directory |
| `{{source}}` | The package's source URL (after expansion) |

## Ratings

| Rating | Meaning | Sync behavior |
|--------|---------|---------------|
| `core` | Must-have | Always installed |
| `useful` | Good to have | Installed |
| `debatable` | Try it out | Installed |
| `disabled` | Removed/avoid | Removed if present, reason logged |

## Gist-First Philosophy

`pkit` is designed for **zero-friction machine bootstrap**:

1. `bun i -g pi-kit` on any machine
2. `pkit login` → GitHub/Codeberg auth
3. `pkit sync` → pulls your `kit.yml` from your gist repo, installs everything

No repo to clone, no git workflow, no branch management. Your manifest lives in a file in your `gists` repo. Push/pull is one command.

Multiple profiles? `pkit profile work` switches to your work gist.

## Architecture

```
pkit sync flow:
  1. Load kit.yml (local or pull from remote)
  2. Validate manifest
  3. For each entry → resolve provider → compute action
  4. Execute actions (install/remove/verify)
  5. Update kit.lock.json
```

**Provider system:**

| Provider | Install | Verify | Config |
|----------|---------|--------|--------|
| `pi-native` | `pi install` | `pi list` | `settings.json` |
| `custom` | Sequential steps | Shell check | Deep merge into target |
| `skill` | Clone + copy subpath | SKILL.md exists | None |
| `mcp-server` | `npm i -g` or local | Binary/config check | Deep merge into `mcp.json` |

## Development

```bash
bun install
bun run dev -- --help    # Run locally
bun run build            # Build for production
bun test                 # Run tests
```

## License

MIT
