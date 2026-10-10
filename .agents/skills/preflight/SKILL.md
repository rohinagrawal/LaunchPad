---
name: preflight
description: Check that the LaunchPad folder, tracker data, settings and browser are ready before a run, and stop with a clear reason if they aren't. Use at the start of every scheduled or multi-step run (job search, people research, outreach, document generation), and when the user asks "is everything set up?", "why did the run fail?", "check my tracker", or "run preflight".
---

# Preflight

A run that starts on broken ground wastes the whole run: it searches, drafts, then fails at the last step. Check first, and stop early with the reason.

`<root>` is the LaunchPad folder (it holds `Job-Thesis.md` and `LaunchPad App/`).

## 1. Run the script

```
python3 "<root>/LaunchPad App/preflight.py"
```

It only reads; it changes nothing. It prints one line per check (`OK`, `WARN` or `FAIL`) and exits 1 if anything failed. Add `--json` for a machine-readable report.

| Check | FAIL when | WARN when |
|---|---|---|
| Data folder | `data.json` is missing or not valid tracker data | Two cards share an id |
| People | `contacts.json` doesn't pass the tracker's own validation | A person points at a card that no longer exists; an approved ask has no resume file |
| Autopilot | `autopilot.json` is not valid | — |
| Settings | `outreach-config.json` is not valid JSON | The base resume file is missing; a limit is not a number |
| Documents | `Job-Thesis.md` or `Resume/Master-Resume.md` is missing | The answer bank, referral note or message templates are missing |
| Tracker server | — | It isn't running (skills then write straight to the files) |
| Git | — | Code or documents have uncommitted changes; the branch is behind its remote |

- **Any FAIL:** stop. Report the failing lines exactly and what would fix them. Do not work around a failed check.
- **Only WARNs:** carry on, and repeat the warnings at the top of the run report.

## 2. Check what the script can't see

Do these only for a run that needs them, and stop on the first one that fails.

- **Browser, for LinkedIn steps:** open `https://www.linkedin.com/feed/` in the browser the run will use (built-in first; see Outreach-Rules.md). It must show the signed-in feed. A login wall, security checkpoint or CAPTCHA is a hard stop: report it and do nothing else on LinkedIn.
- **File upload, for messages that attach a resume:** the upload tool lives in Claude in Chrome. If it isn't connected, say so before drafting sends, so the user can connect it; draft-only steps can still run.
- **Email, for the reply monitor or email outreach:** confirm an email connector is connected by listing one recent message. If none is connected, skip those steps and say so.
- **Data freshness, when the tracker is also hosted:** `git pull --rebase --autostash` before editing anything under `Data/`, so saves made on the hosted copy are present. Never force-push.

## 3. Report

One short block at the top of the run report: what passed, what warned, and for anything that stopped the run, the exact line and the fix. If everything passed, one line is enough.
