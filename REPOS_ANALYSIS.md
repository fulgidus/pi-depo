# GitHub Repos Analysis Report

## Summary Table

| Repo | Type | Language | Skills | MCP Server | Package Manager |
|------|------|----------|--------|-----------|-----------------|
| cc-design | Claude Code Skill | HTML/JS/Markdown | 1 SKILL.md (root) | Yes (Playwright) | None (standalone) |
| diagram-design | Claude Code Skill | HTML/SVG/CSS/Markdown | 1 SKILL.md (nested) | No | None (standalone) |
| agentic-stack | Portable Agent Framework | Python | 5 SKILL.md files | No | None (custom harness) |
| browser-harness | Agent Browser Harness | Python | 1 SKILL.md (root) | No | Python (pyproject.toml) |

---

## 1. cc-design

**GitHub:** https://github.com/ZeroZ-lab/cc-design  
**Type:** Claude Code Skill for high-fidelity HTML design & prototyping

### Directory Structure
```
cc-design/
├── SKILL.md                    # Skill definition with MCP tools
├── README.md                   # 19.6 KB comprehensive guide
├── VERSION                     # Version file for auto-updates
├── CLAUDE.md                   # Memory/preferences
├── EXAMPLES.md                 # Usage examples (6.7 KB)
├── SKILL.md                    # 29.8 KB skill definition
├── load-manifest.json          # Bundle loading manifest (20.4 KB)
├── test-prompts.json           # Test/demo prompts (4.6 KB)
├── agents/                     # Agent configurations
├── assets/                     # Personal asset index examples
├── bin/                        # Utilities (update checker)
├── references/                 # 60+ technical references
│   ├── animation-best-practices.md
│   ├── animation-pitfalls.md
│   ├── anti-patterns/          # Color, interaction, layout, typography
│   ├── brand-emotion-theory.md
│   ├── case-studies/           # iOS, presentations, product pages
│   ├── color-theory.md
│   ├── content-guidelines.md
│   ├── critique-guide.md
│   ├── data-visualization.md
│   ├── design-checklist.md
│   ├── design-excellence.md
│   ├── design-philosophy.md
│   ├── design-principles.md
│   ├── design-styles.md        # 20 design philosophy schools
│   ├── form-design.md
│   ├── interactive-prototype.md
│   ├── layout-systems.md
│   ├── react-setup.md
│   ├── responsive-design.md
│   ├── sfx-library.md          # 37 SFX catalog
│   ├── slide-decks.md
│   ├── verification-protocol.md
│   ├── video-export.md
│   └── ... (60+ total)
├── scripts/                    # Node.js/JavaScript utilities
│   ├── generate-bundle-catalog.mjs
│   ├── lint-load-manifest.mjs
│   ├── resolve-load-bundles.mjs
│   ├── export_deck_pdf.mjs
│   ├── export_deck_pptx.mjs
│   ├── render-video.js
│   └── package.json            # Node.js project
├── templates/                  # Design templates
└── screenshots/                # Preview images
```

### README Content (Summary)
- High-fidelity HTML design skill with 5 core principles
- P0: Fact verification
- P1: Gather context first (audience, output shape, scope, constraints)
- P1.5: Visible plan before build
- P2: Anti-AI slop (no aggressive gradients, banned fonts/emojis)
- P3: Audible loading (announce every reference bundle)

Features:
- 20 design philosophy schools (Information Architects, Motion Poets, Minimalists, Experimental Vanguard, Eastern Philosophy)
- 8-layer design framework (Goal → Information → Structure → Interaction → Visual → Brand → System → Validation)
- 68+ brand design systems from getdesign.md
- 5-dimension design review scoring framework
- React + Babel inline JSX with pinned versions
- Animation stage+sprite timeline engine
- PDF (multi-file + single-file), PPTX (image + editable), video (MP4), audio (dual-track)
- Three-phase verification via Playwright MCP
- Tweaks system with localStorage persistence

### SKILL.md Location & Content
**Location:** `/SKILL.md` (29.8 KB)

**Allowed Tools (declares MCP integration):**
```yaml
allowed-tools:
  - Read
  - Write
  - Edit
  - Glob
  - Grep
  - Bash
  - AskUserQuestion
  - Skill
  - mcp__playwright__browser_navigate
  - mcp__playwright__browser_take_screenshot
  - mcp__playwright__browser_snapshot
  - mcp__playwright__browser_evaluate
  - mcp__playwright__browser_console_messages
  - mcp__playwright__browser_run_code
  - mcp__playwright__browser_tabs
  - mcp__playwright__browser_click
  - mcp__playwright__browser_type
  - mcp__playwright__browser_press_key
  - mcp__playwright__browser_wait_for
```

**Core Principles in SKILL.md:**
- P0: Fact verification (search first, never guess)
- P1: Gather context (audience, output, scope, constraints)
- P1.5: Visible plan before build
- P2: Anti-AI slop (aggressive gradients banned, emoji banned unless brand, overused fonts banned)
- P3: Audible loading (announce bundles before using)

**Skills Directory:** None (single monolithic skill)

**MCP Server Exposure:** **YES** - Exposes Playwright MCP tools via `allowed-tools` declarations. Uses Playwright for verification, screenshots, and interactive testing.

### Package Type
**None** - standalone skill distribution. References Node.js scripts but no npm package.json at root.

---

## 2. diagram-design

**GitHub:** https://github.com/cathrynlavery/diagram-design  
**Type:** Claude Code Skill for technical/product diagrams

### Directory Structure
```
diagram-design/
├── README.md                   # 12.9 KB comprehensive guide
├── skills/                     # Nested skill directory
│   └── diagram-design/
│       ├── SKILL.md            # Skill definition
│       ├── references/         # Type-specific guides
│       │   ├── onboarding.md
│       │   ├── style-guide.md
│       │   ├── primitive-annotation.md
│       │   ├── primitive-sketchy.md
│       │   ├── type-architecture.md
│       │   ├── type-er.md
│       │   ├── type-flowchart.md
│       │   ├── type-layers.md
│       │   ├── type-nested.md
│       │   ├── type-pyramid.md
│       │   ├── type-quadrant.md
│       │   ├── type-sequence.md
│       │   ├── type-state.md
│       │   ├── type-swimlane.md
│       │   ├── type-timeline.md
│       │   ├── type-tree.md
│       │   └── type-venn.md
│       └── assets/             # HTML templates
│           ├── template.html
│           ├── template-dark.html
│           └── template-full.html
├── docs/                       # Documentation
│   └── screenshots/            # Diagram examples
├── .claude-plugin/             # Claude Code plugin metadata
│   ├── marketplace.json
│   └── plugin.json
└── .codex-plugin/              # Codex plugin metadata
    └── plugin.json
```

### README Content (Summary)
- 14 diagram types for editorial diagrams matching brand
- Philosophy: "highest-quality move is usually deletion" - earn every element
- All 14 diagrams in 3 variants: minimal light, minimal dark, full-editorial
- No Figma, no generic rounded boxes
- Editorial quality diagrams that read website colors & fonts

**14 Diagram Types:**
1. Architecture - Components + connections
2. Flowchart - Decision logic
3. Sequence - Messages over time
4. State machine - States + transitions
5. ER/data model - Entities + fields
6. Timeline - Events on an axis
7. Swimlane - Cross-functional flow
8. Quadrant - Two-axis positioning
9. Nested - Hierarchy by containment
10. Tree - Parent → children
11. Layer stack - Stacked abstractions
12. Venn - Set overlap
13. Pyramid/funnel - Ranked hierarchy or drop-off
14. Consultant 2×2 - Scenario matrix with named cells

### SKILL.md Location & Content
**Location:** `skills/diagram-design/SKILL.md`

**Metadata:**
```yaml
name: diagram-design
description: Create technical and product diagrams
license: MIT
metadata:
  version: "1.0"
```

**Philosophy (from SKILL.md):**
- Confident restraint - earn every element
- One color accent, two families, small spacing vocabulary
- Every node represents distinct idea
- Every connection carries information
- Coral (accent) reserved for 1-2 focal nodes
- Target density: 4/10 (complete but not dense)
- Above 9 nodes, probably two diagrams

**First-time Setup:**
- Style guide gate - asks user to customize colors & fonts before first diagram
- Onboarding options: (a) auto-extract from website, (b) manual token entry, (c) use defaults
- Once customized (accent != #b5523a), skip gate on subsequent runs

**Skills Directory:** `skills/diagram-design/` with nested structure (for plugin compatibility)

**MCP Server Exposure:** **NO** - Pure HTML/SVG/CSS generation, no runtime MCP tools

### Package Type
**None** - Pure skill, installable as plugin or symlink. Plugin manifests in `.claude-plugin/` and `.codex-plugin/`

---

## 3. agentic-stack

**GitHub:** https://github.com/codejunkie99/agentic-stack  
**Type:** Portable agent memory & skills framework (.agent/ folder)

### Directory Structure
```
agentic-stack/
├── .agent/                     # Core portable memory + skills + protocols
│   ├── AGENTS.md               # Framework rules & guidelines
│   ├── harness/                # Python hook infrastructure
│   │   ├── conductor.py
│   │   ├── context_budget.py
│   │   ├── hooks/
│   │   │   ├── claude_code_post_tool.py
│   │   │   ├── pi_post_tool.py
│   │   │   ├── on_failure.py
│   │   │   ├── pre_tool_call.py
│   │   │   ├── post_execution.py
│   │   │   ├── _episodic_io.py
│   │   │   └── _provenance.py
│   │   ├── llm.py
│   │   ├── salience.py
│   │   └── text.py
│   ├── memory/                 # Multi-layer memory system
│   │   ├── personal/
│   │   │   └── PREFERENCES.md  # User preferences (first file read)
│   │   ├── semantic/           # Long-term knowledge
│   │   │   ├── DECISIONS.md
│   │   │   ├── DOMAIN_KNOWLEDGE.md
│   │   │   └── LESSONS.md
│   │   ├── working/
│   │   │   └── WORKSPACE.md    # Session workspace
│   │   ├── candidates/         # Graduation pipeline
│   │   │   └── graduated/
│   │   ├── auto_dream.py
│   │   ├── cluster.py
│   │   ├── decay.py
│   │   ├── memory_search.py
│   │   ├── validate.py
│   │   ├── promote.py
│   │   ├── review_state.py
│   │   ├── archive.py
│   │   └── render_lessons.py
│   ├── protocols/              # Protocol definitions
│   │   ├── delegation.md
│   │   ├── permissions.md
│   │   ├── hook_patterns.json
│   │   └── tool_schemas/
│   │       ├── api.schema.json
│   │       ├── github.schema.json
│   │       └── shell.schema.json
│   ├── skills/                 # 5 custom skills
│   │   ├── _index.md
│   │   ├── skillforge/         # Skill creation skill
│   │   │   └── SKILL.md
│   │   ├── memory-manager/
│   │   │   └── SKILL.md
│   │   ├── git-proxy/
│   │   │   ├── SKILL.md
│   │   │   └── KNOWLEDGE.md
│   │   ├── deploy-checklist/
│   │   │   └── SKILL.md
│   │   └── debug-investigator/
│   │       └── SKILL.md
│   └── tools/                  # Custom Python tool runners
│       ├── budget_tracker.py
│       ├── graduate.py
│       ├── learn.py
│       ├── list_candidates.py
│       ├── memory_reflect.py
│       ├── recall.py
│       ├── reject.py
│       ├── reopen.py
│       ├── show.py
│       └── skill_loader.py
├── README.md                   # 11.7 KB setup guide
├── CHANGELOG.md
├── requirements.txt            # anthropic>=0.34.0, openai>=1.40.0
├── adapters/                   # 12 agent harness adapters
│   ├── claude-code/
│   ├── cursor/
│   ├── windsurf/
│   ├── opencode/
│   ├── openclaw/
│   ├── hermes/
│   ├── pi/
│   ├── codex/
│   ├── standalone-python/
│   └── ... (more)
├── docs/                       # Documentation
├── examples/                   # Example projects
├── Formula                     # Homebrew formula
├── install.sh                  # macOS/Linux installer
├── install.ps1                 # Windows PowerShell installer
├── onboard.py                  # Onboarding wizard (main)
├── onboard_features.py         # Feature toggles UI
├── onboard_render.py           # Rendering engine
├── onboard_ui.py               # UI components
├── onboard_widgets.py          # Widget toolkit
├── onboard_write.py            # File I/O
├── test_claude_code_hook.py    # Test hook integration
└── verify_codex_fixes.py        # Verification script
```

### README Content (Summary)
- Portable `.agent/` folder (memory + skills + protocols) that plugs into multiple harnesses
- Works with: Claude Code, Cursor, Windsurf, OpenCode, OpenClaw, Hermes, Pi Coding Agent, Codex, DIY Python
- Keeps knowledge when switching tools
- One-command install via Homebrew or native installer
- Auto-run onboarding wizard populates `PREFERENCES.md`

**6 Preference Questions:**
1. What should I call you?
2. Primary language(s)?
3. Explanation style?
4. Test strategy?
5. Commit message style?
6. Code review depth?

**Optional Features:**
- FTS memory search [BETA]

**Core Architecture:**
- Harness layer: hooks for Claude Code, Pi, Codex post-tool execution
- Memory layer: personal (PREFERENCES), semantic (DECISIONS, LESSONS, DOMAIN_KNOWLEDGE), working (WORKSPACE), candidates
- Protocols: delegation, permissions, tool schemas
- Skills: skillforge, memory-manager, git-proxy, deploy-checklist, debug-investigator
- Adapters: 12 different agent harness integrations

### SKILL.md Files (5 total)

**1. skillforge/SKILL.md** - The skill that creates skills
- Triggers: "create skill", "new skill", "build skill", "new capability"
- Tools: bash, memory_reflect, git
- Checks for duplicates, creates new skill with self-rewrite hook
- Target: keep skills under 100 lines each

**2. memory-manager/SKILL.md** - Memory lifecycle management
- Manages candidates, promotions, archival
- Implements decay and validation

**3. git-proxy/SKILL.md** - Git workflow assistance
- Includes KNOWLEDGE.md with git patterns

**4. deploy-checklist/SKILL.md** - Pre-deployment verification
- Verification patterns and checklists

**5. debug-investigator/SKILL.md** - Debugging assistant
- Error analysis and troubleshooting

**Skills Directory:** `.agent/skills/` with 5 nested SKILL.md files

**MCP Server Exposure:** **NO** - Pure Python harness, no MCP server declarations

### Package Type
**Python** - `requirements.txt` with `anthropic>=0.34.0` and `openai>=1.40.0`. Installable via Homebrew or native installers.

---

## 4. browser-harness

**GitHub:** https://github.com/browser-use/browser-harness  
**Type:** Agent browser harness via Chrome DevTools Protocol (CDP)

### Directory Structure
```
browser-harness/
├── SKILL.md                    # 12.3 KB skill definition
├── README.md                   # 3.6 KB quick start
├── pyproject.toml              # Python package definition
├── install.md                  # First-time setup guide
├── run.py                      # ~36 lines - runs plain Python with helpers
├── helpers.py                  # ~195 lines - helper functions
├── daemon.py                   # ~120 lines - CDP websocket bridge
├── admin.py                    # ~240 lines - browser bootstrap & admin
├── .env.example
├── docs/                       # Documentation
│   └── setup-remote-debugging.png
├── interaction-skills/         # 17 markdown guides for interaction patterns
│   ├── connection.md           # Startup sequence, tab visibility
│   ├── tabs.md                 # Tab management
│   ├── downloads.md            # File downloads
│   ├── uploads.md              # File uploads
│   ├── dialogs.md              # Browser dialogs
│   ├── dropdowns.md            # Dropdown interactions
│   ├── drag-and-drop.md        # DnD patterns
│   ├── scrolling.md            # Scroll behavior
│   ├── screenshots.md          # Capture techniques
│   ├── print-as-pdf.md         # PDF generation
│   ├── viewport.md             # Viewport control
│   ├── iframes.md              # iframe handling
│   ├── cross-origin-iframes.md # CORS iframes
│   ├── shadow-dom.md           # Shadow DOM access
│   ├── cookies.md              # Cookie management
│   ├── profile-sync.md         # Profile persistence
│   └── network-requests.md     # Network monitoring
└── domain-skills/              # 70 domain-specific task guides
    ├── amazon/
    ├── arxiv/
    ├── booking-com/
    ├── github/
    ├── linkedin/
    ├── ... (68 more domains)
    └── (Complete list: amazon, archive-org, arxiv, arxiv-bulk, atlas, booking-com, 
         capterra, centilebrain, coingecko, coinmarketcap, coursera, craigslist, 
         crossref, dev-to, duckduckgo, ebay, etsy, eventbrite, facebook, framer, 
         fred, g2, genius, github, glassdoor, goodreads, gutenberg, hackernews, 
         howlongtobeat, itch-io, indeed, intercom, isbndb, jira, jobvite, kaggle, 
         kayak, kohls, lastfm, letterboxd, lexi-cloud, linkedin, mailchimp, 
         mastermind, meetup, medium, metacritic, naver-papago, notion, npm, 
         numbeo, opensea, pagerduty, patreon, payoneer, pdfdrive, perplexity, 
         producthunt, radiooooo, reddit, rightmove, rotten-tomatoes, rumble, 
         search-gov, shadertoy, shein, shopify, slack, soundcloud, spotify, 
         stackblitz, steam, stripe-dashboard, stripe-docs, synonym-finder, 
         taiko, tedx, theposterdb, thesaurus-com, threadless, tiktok, tmdb, 
         toggl, tsc, udemy, unsplash, vimeo, vitest, waifu2x, wattpad, wayfair, 
         weather-gov, wikipedia, wow, youtube)
```

### README Content (Summary)
- Simplest, thinnest, self-healing browser harness for LLM
- Agent writes what's missing mid-task
- No framework, no recipes, no rails - one websocket to Chrome
- ~592 lines of Python total
- Setup flow with Remote Debugging Protocol checkbox activation
- Free remote browsers via cloud.browser-use.com (3 concurrent free, no card required)

**Self-maintenance commands:**
- `browser-harness --doctor` - diagnose install, daemon, browser
- `browser-harness --setup` - re-run interactive browser-attach
- `browser-harness --update -y` - update without prompting

**Key Architecture:**
- `run.py` (~36 lines) - invokes helpers
- `helpers.py` (~195 lines) - starting tool calls (agent edits these)
- `admin.py` (~240 lines) - browser bootstrap
- `daemon.py` (~120 lines) - CDP websocket bridge
- Domain skills auto-generated by agent, not hand-authored

### SKILL.md Location & Content
**Location:** `/SKILL.md` (12.3 KB)

**Key Points:**
- Describes how to invoke via `browser-harness <<'PY'...'PY'` heredoc
- `run.py` auto-starts daemon via `ensure_daemon()`
- Manual tool invocation never needed
- First navigation is `new_tab(url)`, not `goto(url)` (preserves user's active tab)
- Helpers are pre-imported and discoverable via code reading
- Agent edits `helpers.py` to add missing functions mid-task

**Remote Browsers:**
```python
start_remote_daemon("work")  # Clean browser, no profile
start_remote_daemon("work", profileName="my-work")  # Reuse cloud profile
start_remote_daemon("work", proxyCountryCode="de")  # DE proxy
```

**Interaction Skills:** 17 markdown guides covering connection, tabs, downloads, uploads, dialogs, dropdowns, drag-and-drop, scrolling, screenshots, print-as-PDF, viewport, iframes, shadow-dom, cookies, profile-sync, network requests

**Domain Skills:** 70+ domain-specific skill files (auto-generated by agent during task execution)

**MCP Server Exposure:** **NO** - Uses direct Chrome DevTools Protocol via websocket, not MCP

### Package Type
**Python 3.11+** - Published on PyPI as `browser-harness`

```toml
[build-system]
requires = ["setuptools>=69"]

[project]
name = "browser-harness"
version = "0.1.0"
requires-python = ">=3.11"
dependencies = [
    "cdp-use==1.4.5",
    "fetch-use==0.4.0",
    "websockets==16.0",
]

[project.scripts]
browser-harness = "run:main"
```

---

## Comparative Summary

### Skills Organization

| Repo | Skills Location | Count | Nesting |
|------|-----------------|-------|---------|
| cc-design | Root SKILL.md | 1 | Flat |
| diagram-design | `skills/diagram-design/SKILL.md` | 1 | Nested (plugin-compatible) |
| agentic-stack | `.agent/skills/*/SKILL.md` | 5 | Nested (skillforge, memory-manager, git-proxy, deploy-checklist, debug-investigator) |
| browser-harness | Root SKILL.md | 1 (main) + 17 (interaction) + 70 (domain) | Modular with nested guides |

### MCP Server Integration

| Repo | MCP Exposed | Pattern | Details |
|------|------------|---------|---------|
| cc-design | **YES** | `allowed-tools` declaration | Playwright MCP (browser_navigate, screenshot, evaluate, click, type, etc.) |
| diagram-design | **NO** | Pure HTML/SVG | Static code generation |
| agentic-stack | **NO** | Python hooks | Framework for other harnesses, not itself an MCP server |
| browser-harness | **NO** | Direct CDP | Uses Chrome DevTools Protocol directly via websockets |

### Package Distribution

| Repo | Type | Distribution | Entry Point |
|------|------|------------|-------------|
| cc-design | Skill | Git clone to `~/.claude/skills/` | Manual or plugin marketplace |
| diagram-design | Skill | Git clone + symlink or plugin | `.claude/skills/diagram-design` or plugin |
| agentic-stack | Framework | Homebrew (macOS/Linux) + native installer | `agentic-stack` command + adapters |
| browser-harness | Tool | PyPI via setuptools | `browser-harness` command (entry script) |

### Use Cases

| Repo | Primary Use | Secondary Use | Architecture |
|------|------------|--------------|--------------|
| cc-design | Visual design prototyping | HTML animation + audio design | Monolithic skill with 60+ reference bundles |
| diagram-design | Technical diagram creation | Brand-aware editorial graphics | Single skill with 14 diagram types |
| agentic-stack | Portable AI agent memory | Multi-harness capability sharing | Framework with hooks for Claude Code, Pi, Cursor, etc. |
| browser-harness | Browser automation for agents | Web scraping, testing, RPA | Minimal harness + self-healing helper expansion |

---

## Key Findings

### 1. **Skills as Primary Distribution**
All four repos share a common pattern: **SKILL.md defines agent behavior**.
- cc-design & browser-harness: Single root SKILL.md
- diagram-design: Nested `skills/diagram-design/SKILL.md` (plugin-compatible structure)
- agentic-stack: Distributed `.agent/skills/*/SKILL.md` (5 focused skills)

### 2. **MCP Server Usage**
Only **cc-design** explicitly declares MCP tools:
- Uses Playwright MCP for browser verification, screenshots, evaluation
- Declares via `allowed-tools:` YAML block in SKILL.md
- Other three repos do **NOT** expose MCP servers

### 3. **Design Philosophy Consistency**
Both design skills (cc-design, diagram-design) share principles:
- Anti-slop / quality gates
- User preference capture (PREFERENCES.md for agentic-stack, style-guide onboarding for diagram-design)
- Progressive disclosure (cc-design loads bundles on-demand, diagram-design has first-run gate)

### 4. **Agent Learning Patterns**
- browser-harness: Agent writes missing helpers mid-task (self-healing)
- agentic-stack: Skills can trigger self-rewrite hooks (skillforge pattern)
- cc-design: Bundles load in response to design task triggers
- diagram-design: Style guide auto-customizes from website

### 5. **Directory Conventions**
- `.agent/` → agentic-stack portable framework
- `skills/` → nested skill directory (diagram-design, agentic-stack)
- `domain-skills/` → browser-harness task-specific guides (70+ sites)
- `interaction-skills/` → browser-harness interaction patterns (17 guides)
- `references/` → cc-design (60+ design references) & diagram-design (14 type guides)

### 6. **Python vs No-Code Spectrum**
- **Pure skills:** cc-design, diagram-design (HTML/Markdown, no runtime)
- **Python frameworks:** agentic-stack (hooks + memory), browser-harness (CDP daemon)
- **Hybrid:** cc-design uses Node.js scripts for export (pdf, pptx, video)

---

## Installation Patterns

| Repo | Install Method | Command | Result |
|------|----------------|---------|--------|
| cc-design | Git clone | `git clone ... ~/.claude/skills/cc-design` | Symlink to `~/.claude/skills/` |
| diagram-design | Git clone + symlink OR plugin | `ln -s ... ~/.claude/skills/diagram-design` | Plugin or local skill |
| agentic-stack | Homebrew OR installer | `brew install agentic-stack` OR `./install.sh` | Creates `.agent/` in project + adapters |
| browser-harness | PyPI | `pip install browser-harness` OR local | `browser-harness` command on PATH |

---

## Verification Checklist for Similar Projects

When analyzing future repos, check for:

- [ ] **SKILL.md presence** - Is there a skill definition file?
- [ ] **Directory layout** - Does it follow `skills/`, `.agent/`, `domain-skills/` patterns?
- [ ] **MCP declaration** - Check `allowed-tools:` in SKILL.md or `mcp.json` files
- [ ] **Package files** - `package.json`, `pyproject.toml`, `Cargo.toml`, etc.
- [ ] **Reference materials** - `references/`, `docs/`, `examples/` directories
- [ ] **Self-healing capability** - Does the agent modify its own code?
- [ ] **Multi-harness support** - `adapters/`, `*-plugin/` directories
- [ ] **Memory layers** - `memory/`, `.claude/`, episodic/semantic storage
- [ ] **Distribution model** - Skill, plugin, PyPI, Homebrew, GitHub clone
- [ ] **Quality gates** - Onboarding flows, style guides, anti-slop rules

