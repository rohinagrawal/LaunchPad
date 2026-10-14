# LaunchPad Agent Guide

This repository keeps shared agent assets under `.agents/`.

The repo root `AGENTS.md` stays a thin compatibility file that points at this guide so tools that look for `AGENTS.md` get the same source of truth. It holds no rules of its own, only the pointer and `@` imports.

## Project Context

LaunchPad is a job-search command center: a stdlib-only Python tracker app, its data, and the documents and Claude automations that feed it. It is one person's working job hunt today, and it must stay usable by any job seeker, so personal choices live in documents and config, not in code.

| Area | Path | Typical contents |
| --- | --- | --- |
| Tracker app (code only) | `LaunchPad App/` | `server.py`, `storage.py`, `jobs_store.py`, `contacts_store.py`, `preflight.py`, `cleanup.py`, `index.html`, `app.css`, `screens.js`, `people*.js`, `your-move.js`, `insights.js`, `companies.js`, `interviews.js`, `outreach-config.json` |
| Tracker data | `Data/` | `data.json` (jobs), `contacts.json` (people), `autopilot.json`, `backups/` (local only) |
| Root launcher | `tracker.py` | Thin pointer so `uv run tracker.py` works from the repo root |
| Demo | `Demo/` | `demo_people.py`, a self-contained tracker with demo data |
| Guides for people | `Docs/` | `Setup.md` (from nothing to running), `Hosting.md`, `Automation.md` |
| Landing page | `Site/` | `index.html`, `site.css`, `site.js`, `demo-shim.js`, `build.py` (adds a live copy of the tracker with the demo data); `.github/workflows/pages.yml` builds and publishes it to GitHub Pages |
| The user's reference docs | repo root | `Job-Thesis.md`, `Target-Companies.md`, `START-HERE.md`, `README.md` |
| The user's documents | `Resume/`, `Referral/`, `Cover Letters/`, `Company Research/` | Master resume, referral note and playbook, message templates |
| Run output | `Job Listings/`, `Applications/`, `Interview Prep/`, `Archive/` | Saved postings and review files, per-company documents, interview prep documents, archived items |

See [README.md](../README.md) for the full structure, [Docs/](../Docs/) for setup, hosting and the scheduled routine, and [LaunchPad App/README.md](../LaunchPad%20App/README.md) for the app's views, storage modes and server endpoints.

## Directory Layout

```
.agents/
├── README.md              # Shared agent guide
├── manifest.json          # Shared asset registry
├── rules/                 # Repo-wide agent rules
├── skills/                # Task playbooks and setup helpers
├── mcp/                   # Shared MCP source and docs, if used
├── scripts/               # Validation and maintenance tooling
└── workspace/             # Ephemeral session scratch (gitignored)
    └── README.md          # Workspace conventions (tracked)
```

Keep durable assets in the tracked directories above. Put temporary payloads, draft prompts, and other throwaway artifacts under `.agents/workspace/` instead of the `.agents/` root.

Add `.agents/mcp/` only when this repo needs a shared MCP server or local tool surface.

## Shared Assets

- Shared rules: `.agents/rules/`
- Shared skills: `.agents/skills/`
- Shared MCP source: `.agents/mcp/` when this repo needs an agent-facing service
- Shared asset manifest: `.agents/manifest.json`
- Shared validation command: `python3 .agents/scripts/validate-agent-assets.py`
- Ephemeral session scratch: `.agents/workspace/` (see `.agents/workspace/README.md`)

Tool-specific folders such as `.codex/` and `.cursor/` should be thin adapters or symlinks to `.agents/` wherever possible. Avoid duplicating rule, skill, or MCP content in multiple tool folders.

Adapters wired up for this repo:

- **Codex** reads the root `AGENTS.md` natively, which is a short pointer file to this guide. No separate `.codex/` folder is needed.
- **Claude Code** also reads the root `AGENTS.md` natively (v2.1.277 or later) when the repo has no `CLAUDE.md`. It does not read `.agents/` by itself, so `AGENTS.md` ends with `@` imports of this guide and the always-apply rules. Do not add a `CLAUDE.md` or `CLAUDE.local.md`: either one stops Claude from reading `AGENTS.md`. Claude discovers skills only under `.claude/skills`, which is a symlink to `.agents/skills`, so there is one copy. Otherwise `.claude/` holds only Claude-specific settings (`launch.json`, local permissions).
- **Cursor** is not wired up. To add it, symlink `.cursor/rules` to `../.agents/rules` and add `cursor` to the hosts in the manifest.

When adding support for another agent surface, prefer the same pattern:

1. Keep shared instructions, skills, rules, tools, and MCP code under `.agents/`.
2. Expose the shared asset through that tool's native entrypoint or config.
3. Use a symlink or the smallest possible wrapper when the tool cannot read `.agents/` directly.
4. Keep tool-specific behavior in the adapter only when the tool genuinely needs it.
5. Update every applicable adapter for the asset in the same change.
6. Update `.agents/manifest.json` with the source path, docs, adapter coverage, and any exposed tool names.

If a subtree needs different instructions, add the closest scoped `AGENTS.md` for that subtree and keep it limited to the local override. The nearest `AGENTS.md` should be treated as the more specific instruction source for files under that subtree.

## Rules

Before working in this repo, read every rule file under `.agents/rules/*`.

Treat rules with `alwaysApply: true` as baseline instructions for every task. Use rules with `alwaysApply: false` when their title, description, or content matches the task.

| Rule | Applies | Covers |
| --- | --- | --- |
| `launchpad-conventions.md` | always | Where things go, how data is changed, what never gets committed, what needs the user's yes |
| `run-and-verify.md` | always | Running the tracker and the demo, and checking a change without touching real data |
| `agent-asset-maintenance.md` | when changing `.agents/` | How to improve and validate shared agent assets |

## Manifest and Validation

`.agents/manifest.json` lists each shared guide, rule, skill, MCP server, config adapter, and the hosts that consume it. Keep this manifest current whenever adding, moving, or exposing an agent asset.

When changing a shared asset, update every applicable host adapter in the same change. `adapter_hosts` records which hosts need direct adapter coverage; omit a host only when it consumes the asset indirectly or the asset is genuinely not applicable to that host.

Run validation before reporting shared agent asset work complete:

```bash
python3 .agents/scripts/validate-agent-assets.py --mode adapters
```

For a full validation pass that also checks Python compile, run:

```bash
python3 .agents/scripts/validate-agent-assets.py
```

If you only need to inspect MCP startup behavior after adding a server, use:

```bash
python3 .agents/scripts/validate-agent-assets.py --mode mcp
```

## Skills

The job-search skills live in this repo, so a fresh clone has them. Each is a folder under `.agents/skills/` with a `SKILL.md`.

| Skill | Use it to |
| --- | --- |
| `setup-launchpad` | Take a person from a fresh clone to a working setup: thesis, master resume, answer bank, and optionally the playbook, the daily routine and hosting. Never overwrites existing documents |
| `preflight` | Check data, settings, documents and the browser before a run; stop early with the reason |
| `job-scrub` | Search public job boards against the thesis and add matches to Screening |
| `linkedin-job-search` | Search LinkedIn Jobs and add matches to Screening |
| `people-finder` | Find likely referrers, check accepted requests, send connection requests |
| `referral-outreach` | Draft and send referral asks and follow-ups (LinkedIn or email); owns `Outreach-Rules.md` |
| `reply-monitor` | Read the inbox for application and referral replies and update the tracker |
| `generate-docs` | Write a tailored resume and cover letter for To Apply cards |
| `apply-to-job` | Fill an application form from the answer bank and stop for review before submitting |
| `interview-prep` | Build a prep document for one interview and link it on the card |
| `docs-cleanup` | Run the cleanup: archive documents of finished applications, close stale cards, archive closed cards and people. Never deletes |
| `agents-bootstrap` | Set up or refresh this `.agents/` layout in a repository |

`referral-outreach/Outreach-Rules.md` is shared by the three LinkedIn skills: read it before doing anything on LinkedIn or by email.

The source of truth for skills is `.agents/skills/`. If a tool needs a separate install location or symlink, keep that as a thin adapter only.

## Self-Improvement Boundary

Do not make every application-code change trigger agent asset changes. Instead, when a shared asset is used and the workflow reveals friction, improve the closest shared asset that owns that behavior. Examples of real friction include slow or noisy output, fragile request construction, missing guards, unclear docs, stale templates, incorrect metadata, or repeated manual steps.
