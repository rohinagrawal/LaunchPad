# LaunchPad tracker

A local-first job-application tracker. One HTML file, an optional tiny local
server, no build step, no account. Your data lives on your own computer.

## Quick start

**Simplest (browser-only):** open `index.html` in any modern browser. Edits
save to that browser's storage. Good for trying it out or GitHub Pages hosting.

**Recommended (server mode):** run `python3 server.py` (stdlib only, no
installs) and open http://localhost:8787. Now `data.json` on disk is the
single source of truth — every edit is written to it atomically, with rolling
backups (last 20 of each file kept). The rail on the left shows
`data.json · synced with the server`.

**Where the data lives:** not in this folder. `data.json`, `contacts.json`
and `backups/` live in `../Data/`, next to the app, so code and data stay
apart. `storage.py` decides the folder: `TRACKER_DATA_DIR` if set, else
`../Data` if it holds `data.json`, else this folder if it still holds `data.json`
(installs from before the Data folder keep working), else `../Data`.

From the repo root, the same server is also runnable via uv without `cd`-ing
in here: see `tracker.py` and the root `pyproject.toml` one level up.

**One step (any platform):** `python3 launch.py` (Windows: `py launch.py`)
starts the server if needed and opens the tracker in its own Chrome/Edge
app-style window, falling back to your default browser. On macOS,
`launch.sh` is a thin shim around it — wrap either in an Automator/app
bundle (macOS) or a desktop shortcut (Windows/Linux) for one-click launch.

## The app

Six screens, in the order of a search: **Today**, **Jobs**, **People**,
**Companies**, **Interviews** and **Insights**. They sit in a rail on the left,
or in a bar along the bottom on a phone. The tracker opens on Today.

- **Panels** — clicking a job or a person opens a panel on the right (full
  screen on a phone) with its details and every action: approve, drop, mark
  applied, move to another status, documents, the people at that company, the
  message drafts and approvals. **Edit** opens the form on top. Cards on the
  boards are summaries only.
- **Search everything** — Ctrl+K (⌘K on a Mac) finds any job, person or company
  and runs commands. Other keys: `/` search this screen, `n` add, `1`–`6` switch
  screen, Esc close the top layer.
- **Companies** — one row per company, the ones waiting on you first, with its
  roles, its people, how far the referral has got and the next step. A company
  opens as its own page (`#companies/<name>`). Rules in `companies.js`, no DOM.
- **Interviews** — rounds coming up, roles at an interview stage that still
  need a date, and past rounds with their outcome. Rounds are added with
  **+ Add interview** on this screen or **Add round** in the job panel; both
  open the same side form, which also edits or removes a round. They are stored on the job as an optional `interviews` list
  (`{id, date, time, round, with, notes, outcome}`); jobs without it are
  untouched. Rules in `interviews.js`, no DOM.
- **Light and dark** — follows the system; **Theme** in the rail (or under
  **More**) switches between system, light and dark for this browser.
- **More** — export, import and CSV for jobs, and the file-link buttons.
- **Board view** — drag cards between stages (Screening → To Apply → Applied →
  Phone Screen → Interviewing → Offer), or open a card and use the buttons in its panel:
  *✓ Approve → To Apply* (connects with its people automatically) / *✗ Drop* on Screening, *✓ Mark applied* on To Apply,
  *→ next stage* / *✗ Rejected* later on, plus a *Move to…* dropdown on every
  card. Moves save instantly.
- **Table view** — sortable columns, click a row to open its panel.
- **+ Add / Edit / Delete** — **+ Add job** is on Jobs and **+ Add person** on
  People (`n` or the palette adds a job from any screen); full details per application (company, role,
  status, salary, excitement, dates, contact, resume version, notes, link).
- **Search & filter** — by text or status; hide closed/won't-apply.
- **Fit breakdown** — when a search skill scored a role, the job panel
  shows why: Role, Skills, Level, Pay, Location and
  Posting, each out of 5 (`fitBreakdown` on the card). Cards without one look
  as before.
- **Interview prep** — a card with a prep document (`prepMD`, written by the
  `interview-prep` skill) shows a button to read it.
- **People by email** — a person can have an email instead of, or as well as,
  a LinkedIn profile. People reached by email start in Connected (there is no
  request to accept) and are marked ✉ by email.
- **Insights** — funnels for roles and referral outreach, what is sitting
  still, and outreach by relation, roles by tier and by source. Worked out
  from the data on the board (rules in `insights.js`, no DOM); it never
  changes anything.
- **Today** (`#move`) — the number of things that need you, then each of them,
  worked out from the data (rules in `your-move.js`, no DOM), grouped as
  Overdue, Needs you, When you have a minute, and Waiting on others. Click a line about one job or one person and its panel opens right there, so you
  stay on Today; a line about a group (follow-ups ready, Screening roles to decide)
  goes to the screen that lists them. The badge on Today counts the lines that need you. On the boards
  themselves each card carries one small chip (e.g. *Take-home due*,
  *Apply now*, *Apply directly*, *Keep or drop?*, *Approve message*, or a
  grey *Referral in progress* / *Connecting next run*), and column headers show how many need you. People aren't reviewed before connecting: approving a job (✓
  Approve → To Apply) means the next run connects with its people
  automatically. **Review all** on the "Approve outreach" and "Decide" lines
  opens one list to approve (or drop) a whole batch in one click, and the
  **Autopilot** panel under the list (saved in `Data/autopilot.json`, off by
  default) can approve jobs above a fit/tier bar and send drafted messages
  after a hold window unless you tick **Hold** on that person.
  To connect with someone before their job is approved, open them in People and click **Approve**. The tracker itself never sends anything;
  messages are approved in the person panel. When someone has answered, the panel shows **Your reply**:
  the drafted reply, which you can edit, an **Approve reply** tick, and **No reply needed** to send nothing and take it off Today.

## Storage modes (auto-detected, in priority order)

1. **Server mode** — when served by `server.py`, the app loads `data.json` on
   every open and POSTs every change back. Atomic writes, rolling backups, no
   permission prompts, works in every browser. Job links open in your system
   default browser (never inside an app-mode window).
2. **Linked file** — on static hosting (or `file://`), Chrome-family browsers
   can link a `data.json` via the File System Access API (**Open file** /
   **Save As file** buttons).
3. **Browser storage** — only when there is no server and no linked file;
   edits persist in `localStorage` (key `launchpad_v1`).

With a server, nothing of your jobs or people is read from or kept in the
browser: every screen waits for the server's jobs, people and Autopilot
settings and is drawn once from them. Only preferences stay in the browser
(theme, hidden and collapsed columns). The sign-in page clears any copy an
older version left behind.

**Always available:** **Export** (JSON snapshot), **Import** (restore/replace),
and **CSV** for spreadsheets.

## Tools for agents and scripts

Two command-line tools are the only way anything other than the tracker page
changes the data. Both check what is written, write through the server when it
is running (so an open tracker stays in step) and to the file otherwise, and
retry once, then stop, if the data changed underneath them.

| Tool | Data | Commands |
|---|---|---|
| `jobs_store.py` | `data.json` | `list`, `find` (is this posting already here?), `add`, `update`, `move` (status, with the dates stamped), `note` |
| `contacts_store.py` | `contacts.json` | `list`, `add`, `update`, `quota` |

```bash
python3 jobs_store.py list --status "To Apply" --fields company,role,fitScore
```

Run either with `--help` for its options. The rules a job follows (the status
list, id format, applied and closed dates) are in `jobs_store.py` and mirrored
in `index.html`, which needs its own copy to work with no server.

## Server endpoints (`server.py`)

| Route | What it does |
|---|---|
| `GET /` | serves the app |
| `GET /data.json` | current data, never cached; `X-Data-Revision` header for conflict checks |
| `POST /save` | validates + atomically writes `data.json`, rotates a backup; a stale `X-Base-Revision` gets a 409 (the page reloads instead of overwriting a Claude run's changes) |
| `GET /contacts.json` | referral contacts for the People screen (`[]` if none), never cached |
| `POST /save-contacts` | validates + atomically writes `contacts.json`, rotates a `contacts-*` backup |
| `POST /upload-attachment?contact=&name=` | saves an uploaded resume PDF (≤10 MB) to `Resume/Uploads/<Company>/` and returns its path |
| `GET /open?url=` | opens an http(s) link in the default browser |
| `GET /reveal?path=` | shows a tailored PDF in the file manager (Finder/Explorer select the file; Linux opens its folder) for drag-and-drop into applications |
| `GET /health` | lets the app detect server mode |

Localhost-only by default, single instance (safe to invoke repeatedly),
Python 3 stdlib. Cross-platform: macOS, Windows, and Linux. The app's own
`.py` files are never served.

## Hosting it (optional)

To run it on a host like Render, listen on all interfaces and set a password:
`HOST=0.0.0.0` (or `--host 0.0.0.0`) plus `TRACKER_PASSWORD`, which turns on a
sign-in page for everything except `/health` (a session cookie that lasts 30
days; `/logout` signs out; tools can send the password as HTTP Basic auth). The server
refuses to listen beyond localhost without a password. `PORT` is read from
the environment.

If the host's disk doesn't survive restarts, turn on GitHub sync: set
`TRACKER_GITHUB_TOKEN` (a token that can write this repo's contents) and
`TRACKER_GITHUB_REPO` (`owner/name`; optional `TRACKER_GITHUB_BRANCH`, default
`main`). The server then pulls the latest data on start-up and before
serving it, and commits every save (and uploaded PDF) to the repo. If the repo
copy changed meanwhile, the save is refused with a 409 and the page reloads;
your version is kept in `backups/`. If GitHub is unreachable, the save stays
local and is retried.

## Version history

The folder works well as a git repo — `Data/data.json` diffs make a clean
audit trail of your search. `backups/`, `server.log`, and `.DS_Store` are
gitignored.

## Automation (optional, how the original setup uses it)

Claude (Cowork) scheduled tasks keep the tracker fresh by editing
`Data/data.json` (through the server when it's running) — an open tab picks
the changes up when you switch back to it:

- **daily-job-scrub** — searches job boards for roles matching a written
  "thesis," writes a dated review file, appends new roles as `Screening`.
- **job-reply-monitor** — scans Gmail for application replies and advances
  statuses (`Phone Screen`, `Interviewing`, `Rejected`, …).
- **cleanup** — `cleanup.py` (run at the end of each evening routine; `--dry-run`
  to preview). Auto-closes stale Screening (21 days) and ghosted Applied (30
  days) cards, archives closed cards and people 30 days after closing into
  `Archive/tracker/`, moves old listings and reviews to `Archive/listings/`,
  trims `seen-postings.json` to 45 days, and archives finished
  `Applications/<Company>/` folders. Archive only, never delete. Closing a card
  in the app stamps `dateClosed`; reopening it clears that. `cleanup_applied.py`
  is kept as a wrapper for older callers.

Settings are read from `Data/outreach-config.json` when it exists, else from
the defaults in this folder's `outreach-config.json`. Applications use the base
resume set there
(`baseResumePath`) unless a card has a tailored one. A run can write a per-role
referral note (`referralMD`) for To Apply cards; `resumeLink` / `coverLink`
remain for anything added by hand.

`preflight.py` checks the folder before a run (data parses, people validate,
settings, required documents, server, git). It only reads, prints `OK` / `WARN`
/ `FAIL` lines, and exits 1 on any FAIL; `--json` gives the same report as JSON.

## Host on GitHub Pages (optional)

Put `index.html` in a repo, enable Pages. Visitors get their own private,
browser-local copy seeded with the demo rows. (Server mode doesn't apply on
Pages; the FS-API "linked file" mode does.)

## Seed data

`index.html` ships with three demo rows so first-time users see how it works.
Real data never lives in the HTML — it's in `data.json` (server mode), a
linked file, or browser storage.
