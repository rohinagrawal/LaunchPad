---
description: Repository layout, data handling and safety conventions for LaunchPad
alwaysApply: true
---

# LaunchPad Conventions

LaunchPad is a working job hunt and a product other job seekers should be able to use. Read [README.md](../../README.md) before restructuring anything.

## Where Things Go

```text
LaunchPad App/     app code only (Python stdlib, plain HTML/JS/CSS, no build step)
Data/                everything the tracker stores
Demo/                self-contained demo with demo data
Docs/                guides for people: setup, hosting, automation
Site/                the public landing page; build.py adds a live demo of the tracker for GitHub Pages
Job Listings/        saved postings and each run's New-Openings-YYYY-MM-DD.md review file
Applications/        per-company documents
Interview Prep/      one prep document per interview
Archive/             archived jobs, people and documents
Resume/ Referral/ Cover Letters/ Company Research/   the user's own documents and templates
```

- Never create generated or data files at the repo root. Every run output goes inside a folder. Only reference docs (`Job-Thesis.md`, `Target-Companies.md`, `START-HERE.md`, `README.md`, `AGENTS.md`) and project files (`pyproject.toml`, `uv.lock`, `tracker.py`) live at the root.
- Keep code and data apart. Nothing under `LaunchPad App/` stores user data; `storage.py` decides where the data folder is.
- Do not add tests to the repo. Test in a scratch folder outside it. The demo is the only runnable example, and everything it needs stays inside `Demo/`.

## Usable By Anyone

- Do not hard-code one person's details (name, employers, college, city, seniority, resume file name) in app code, the demo, or skill text. Read them from `Resume/Master-Resume.md`, `Job-Thesis.md`, `Referral/` and `Data/outreach-config.json`.
- Treat a personal preference as a setting with a default, not as a limit for every user.

## Product And Personal Files

LaunchPad is published as a public repository that holds only the product. A person's own copy is private and adds their files on top.

- Product, the same for every user: `LaunchPad App/`, `.agents/`, `.claude/`, `.github/`, `Demo/`, `Docs/`, `Site/`, `README.md`, `AGENTS.md`, `LICENSE`, `tracker.py`, `pyproject.toml`, `uv.lock`, `Data/README.md`, `Archive/README.md`.
- Personal, never in the public repository: `Data/*.json`, `Resume/`, `Referral/`, `Applications/`, `Job Listings/`, `Interview Prep/`, `Cover Letters/`, `Company Research/`, `Archive/` contents, `Job-Thesis.md`, `Target-Companies.md`, `START-HERE.md`.
- Nothing personal goes in a product path. Personal settings live in `Data/outreach-config.json`; `LaunchPad App/outreach-config.json` holds the defaults.
- In a private copy that has the public repository as its `upstream` remote, make product changes in a clone of the public repository and bring them in with `git pull --no-rebase upstream main`. Never push from the private copy to `upstream`. In that copy `gh` must target the private repository (`gh repo set-default`), and every `gh` command in an automated run names it with `--repo`.
- `python3 .agents/scripts/check-public-tree.py` fails when a personal path is present; the public repository runs it on every pull request.

## Changing Data

- `Data/data.json` and `Data/contacts.json` are the single source of truth. Change them through the tracker or its tools, not by hand.
- Agents and scripts change them with the two tools below, never by hand and never by posting to `/save` themselves. The tools handle the server-or-file choice and the revision check.
- Use `LaunchPad App/jobs_store.py` for jobs (`list`, `find`, `add`, `update`, `move`, `note`) and `LaunchPad App/contacts_store.py` for people (`list`, `add`, `update`, `quota`). Both check what is written, write through the server when it is up, and refuse to overwrite a save made meanwhile. Skills name these tools; they never describe a manual read-edit-save.
- A rule about a job's data (statuses, ids, date stamps) lives in `jobs_store.py` and, because the tracker also runs with no server, in the page (`index.html`). Change both together.
- New fields on a job or a person must be optional. Cards and people without them have to keep working, and an edit in the tracker must not strip them.
- The hosted copy commits each save to `main` as `tracker: save Data/...`. Run `git pull --rebase --autostash` before editing data and never force-push.
- Archive, never delete: closed and stale items move to `Archive/` (see `LaunchPad App/cleanup.py`).
- Never create `.bak` files. Backups are the server's job (`Data/backups/`, local only).

## Skills

- The job-search skills live in `.agents/skills/` and are the source of truth. Edit them here.
- Rules with no page access go in their own file (`people-core.js`, `your-move.js`, `insights.js`, `companies.js`, `interviews.js`); pages only render (`index.html`, `people.js`, `screens.js`). All styles live in `app.css`, with colours as tokens that have a light and a dark value.

## Code

- Python standard library only; no third-party dependencies. uv pins the interpreter (3.12), but keep the app runnable on the macOS system Python 3.9 (`python3 server.py`).
- `tracker.py` runs `server.py` through `runpy`, which is why `server.py` adds its own folder to `sys.path`. Keep that when adding modules.
- The server never serves `.py` files, and `/open`, `/reveal` and `/claude` answer only local clients. Keep both guards when adding routes.
- Match the surrounding code's style and comment density. Avoid formatting churn in files you are not changing.

## Secrets And The Hosted Copy

- Never commit, print or ask for `TRACKER_PASSWORD`, `TRACKER_GITHUB_TOKEN` or any other credential. The user sets them in the host's environment settings.
- Never sign in to the hosted tracker. Test sign-in and sync only against a local server with throwaway values.
- Pushes to `main` redeploy the hosted copy, except for paths the build filter ignores (`Data/**`, `Resume/Uploads/**`).

## What Needs The User's Yes

- Sending anything on the user's behalf (connection requests, messages, emails, applications). The tracker's approval tick on a person or job counts as the yes for exactly that item.
- Pushing, opening or merging a pull request, unless a scheduled task was set up to do so.
- Stopping a process you did not start. The user's tracker usually runs on port 8787; leave it alone and use another port.
