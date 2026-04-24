# pi-depo (`pd`)

Declarative package manager for [Pi Coding Agent](https://github.com/badlogic/pi-mono).  
Manage skills, extensions, and MCP servers from a single `kit.yml`, synced across machines via GitHub Gist.

## Install

```bash
bun i -g pi-depo
```

## Bootstrap flows

### New machine - your own config

```bash
pd login      # Authenticate with GitHub (uses gh CLI) - auto-syncs after login
```

That's it. `pd login` finds your existing gist, pulls `kit.yml`, and installs everything.

### New machine - borrow someone's public config

```bash
pd login
pd init
# → "Bootstrap from someone's public gist?" → y
# → "GitHub username or username/profile:" → fulgidus
# → imports their kit.yml, offers to sync immediately
```

### First time ever

```bash
pd login      # authenticate
pd init       # scan current pi installation → generate kit.yml
              # OR import from a friend's public gist
pd push       # save to your GitHub Gist (asks public/private once)
```

## Daily usage

```bash
pd                    # sync everything (default command)
pd sync               # same

pd a npm:some-package          # install + add to kit.yml + push gist
pd a git:github.com/user/repo  # git package (asks: pi-native or skill?)
pd a git:github.com/user/repo -s skills/my-skill  # skill with subpath, no prompt
pd rm some-package             # uninstall + remove from kit.yml + push gist

pd toggle             # interactive TUI to enable/disable packages
pd disable foo        # disable a package (keeps it in kit.yml as disabled)
pd enable foo         # re-enable a disabled package
```

## What `pd sync` does (in order)

1. **Self-update** - checks npm for a newer `pi-depo`, installs and restarts if found
2. **Update pi** - checks npm for a newer `@mariozechner/pi-coding-agent`, installs if found
3. **Pull gist** - always pulls `kit.yml` from your gist (gist = source of truth)
4. **Sync packages** - installs missing, upgrades outdated, removes disabled
5. **Reconcile orphans** - detects packages installed via `pi` but not in `kit.yml`, asks: add or remove
6. **Push gist** - if anything changed, saves `kit.yml` and pushes

## Gist

- Gist files: `pi-depo.yml` + `pi-depo.lock.json`
- Gist description: `pi-depo-<profile>` (e.g. `pi-depo-default`)
- Public gists can be shared: `pd init` → enter `username` or `username/profile`
- Public/private is asked once on first `pd push`, stored in `~/.pkit/config.yml`

## kit.yml example

```yaml
meta:
  pi_version: "0.70.0"

packages:
  pi-guardrails:
    source: "npm:@aliou/pi-guardrails"
    rating: core

  caveman:
    source: "git:git@github.com:JuliusBrussee/caveman.git"
    rating: useful

  diagram-design:
    source: "git:github.com/cathrynlavery/diagram-design"
    type: skill
    skill_subpath: "skills/diagram-design"
    rating: debatable

  some-old-package:
    source: "npm:some-old-package"
    rating: disabled
    reason: "Replaced by better-package"
```

## Ratings

| Rating | Meaning |
|--------|---------|
| `core` | Essential - always installed |
| `useful` | Nice to have |
| `debatable` | Optional, experimental |
| `disabled` | Kept for reference, not installed |

## Commands

```
pd / pd sync          Sync everything (self-update + pi update + install + reconcile)
pd init               Bootstrap kit.yml from pi list, or import from a public gist
pd add / pd a         Install a package, add to kit.yml, push gist
pd remove / pd rm     Uninstall, remove from kit.yml, push gist
pd toggle             Interactive TUI to enable/disable packages
pd disable <name>     Disable a package
pd enable <name>      Enable a disabled package
pd push               Push kit.yml to gist
pd pull               Pull kit.yml from gist
pd login              Authenticate with GitHub (auto-syncs after)
pd status             Show package status
pd diff               Dry-run sync (show what would change)
pd verify             Run verify checks for all packages
pd profiles           List configured profiles
pd profile <name>     Switch active profile
```

## Config location

- Config: `~/.pkit/config.yml`
- Local kit: `./kit.yml` (in current directory)
