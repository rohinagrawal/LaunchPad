# LaunchPad

A job search command center that runs on your own computer: a tracker for roles, people, companies and interviews, plus the documents and Claude skills that keep it filled. You find roles, find people who can refer you, ask them, apply, and follow every application to an offer in one place.

- **Yours.** The app is plain Python and HTML with nothing to install. Your data is two JSON files in this repository.
- **Works without AI.** The tracker is a complete app by itself. The skills add searching, outreach drafts, form filling and interview prep when you open the folder in Claude Code.
- **Nothing is sent for you without your yes.**

## Quick start

```bash
uv run tracker.py
```

No [uv](https://docs.astral.sh/uv/)? This does the same:

```bash
python3 "LaunchPad App/server.py"
```

Open http://localhost:8787. Then open this folder in Claude Code and say **"set up LaunchPad"** to build your job thesis, master resume and answer bank.

To look around with fake data first:

```bash
uv run Demo/demo_people.py --port 8799
```

## Guides

| Guide | Read it to |
|---|---|
| [Docs/Setup.md](Docs/Setup.md) | Go from nothing to a working setup, step by step, including a new computer and common problems |
| [Docs/Automation.md](Docs/Automation.md) | Have the search, people research and drafts run every day |
| [Docs/Hosting.md](Docs/Hosting.md) | Put the tracker online behind a password, for your phone |
| `START-HERE.md` | Follow the day-to-day loop. Setup writes this file for you |
| [LaunchPad App/README.md](LaunchPad%20App/README.md) | Learn the screens, storage modes and server endpoints |
| [.agents/README.md](.agents/README.md) | See how the skills and rules for AI agents are organised |

## What you can ask Claude

The skills live in `.agents/skills/`, so a fresh clone has them.

| Say | Skill | What it does |
|---|---|---|
| "set up LaunchPad" | `setup-launchpad` | Builds your thesis, master resume and answer bank, and offers the daily routine and hosting. Never overwrites what is there |
| "run preflight" | `preflight` | Checks data, settings, documents and the browser before a run, and stops with the reason if something is broken |
| "run a job scrub", "search LinkedIn for jobs" | `job-scrub`, `linkedin-job-search` | Finds roles, scores them with a six-part fit breakdown, adds them to Screening |
| "find people at <company>", "send outreach" | `people-finder`, `referral-outreach` | Finds likely referrers, drafts asks (LinkedIn or email), sends what you approved |
| "generate my application docs" | `generate-docs` | Writes a tailored resume and cover letter for To Apply roles |
| "apply to <company>" | `apply-to-job` | Fills the application form from your answer bank and stops for your review before submitting |
| "prep me for <company>" | `interview-prep` | Researches the company and round, and builds stories from your real experience |
| "check for job replies" | `reply-monitor` | Reads your inbox for replies and advances the cards |
| "clean up my tailored docs" | `docs-cleanup` | Archives documents of finished applications |

## What is in the folder

| Path | What it is |
|---|---|
| `LaunchPad App/` | The tracker, code only. `tracker.py` at the root runs it |
| `Data/` | Everything the tracker stores: `data.json` (jobs), `contacts.json` (people), `autopilot.json`, and local `backups/`. See [Data/README.md](Data/README.md) |
| `Demo/` | A throwaway tracker with fake data |
| `Docs/` | The guides above |
| `Site/` | The landing page, published to GitHub Pages from the public repository |
| `.agents/` | The skills, rules and guide for AI agents. `AGENTS.md` at the root points to it |
| `Job-Thesis.md` | What counts as a fit: role tiers, companies, constraints, pay floor. Every search reads it |
| `Target-Companies.md` | Optional research behind your company list; your reference only |
| `Resume/` | `Master-Resume.md` (the source every document is drawn from), `Answer-Bank.md` (answers forms always ask for), and your resume files |
| `Referral/` | `Referral-Playbook.md` (your outreach rules), `Referral-Note.md` (what a referrer can forward), `Templates/` (your message templates) |
| `Cover Letters/`, `Company Research/` | Your templates |
| `Job Listings/` | Saved postings and each run's review file |
| `Applications/` | Per-company documents, created as you apply |
| `Interview Prep/` | One prep document per interview |
| `Archive/` | Closed and stale items, moved here by the cleanup. Nothing is deleted |

The documents and data are personal, and they are created for you by setup. Everything else is the same for every user.

## Rules worth knowing

- `Data/data.json` and `Data/contacts.json` are the single source of truth. Change them through the tracker, not by hand.
- If you host a copy, it commits every save to `main`. Run `git pull --rebase --autostash` before working locally, and never force-push.
- Passwords and tokens belong in the host's settings only, never in the repository.
- Keep your own copy of this repository private: your job search data is committed to it.

## Licence

MIT. See [LICENSE](LICENSE).
