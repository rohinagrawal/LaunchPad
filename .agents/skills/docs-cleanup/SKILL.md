---
name: docs-cleanup
description: Run LaunchPad's cleanup, which archives finished applications' documents along with stale and closed cards, closed people and old listings, and never deletes. Use when the user says "clean up my tailored docs", "archive old application materials", "tidy my resume folder", "run the cleanup", or when a nightly cleanup task fires.
---

# Cleanup

Run the cleanup script that ships with the tracker app. It does more than tidy documents: it also closes and archives tracker cards and people, so preview it first when the user is in the session.

`<root>` is the user's LaunchPad folder. The script finds the tracker data itself and writes the way the tracker does (through the server when it is running, otherwise straight to the files). It is idempotent and safe to re-run. It archives and never deletes.

## What it changes

The numbers are constants at the top of `cleanup.py`.

| Rule | When | Result |
|---|---|---|
| Stale Screening | Screening or Researching for 21+ days | Won't Apply, with an `[auto-closed …]` note; Today offers an undo for a day |
| Ghosted | Applied, and the follow-up date (`nextFollowup`) passed 30+ days ago | Ghosted, with an `[auto-closed …]` note |
| Closed cards | Rejected, Withdrawn, Ghosted or Won't Apply for 30+ days | Moved to `Archive/tracker/jobs-<year>.json` |
| People of closed roles | Found or Queued, and every linked role is closed | Skipped, with an `[outreach: auto-skipped …]` note |
| Closed people | Declined, No response or Skipped for 30+ days | Moved to `Archive/tracker/people-<year>.json` |
| Pending invites | A connection request pending 21+ days | Reported as a withdraw suggestion only; withdrawing is done on LinkedIn with the user's yes |
| Listings | The saved posting of an archived card; `New-Openings-*.md` older than 14 days | Moved to `Archive/listings/<YYYY-MM>/` |
| Posting ledger | `Job Listings/seen-postings.json` | Keeps the last 45 days |
| Application documents | `Applications/<Company>/` once the company has cards on the board but none in Screening, Researching or To Apply | Moved to `Archive/applications/<Company>/`. A leftover `Applications/Archive/` from older versions is folded in there too. Cards' file paths (`referralPath`, `resumePath`, `coverPath`, `prepPath`) into a moved folder are repointed to the archived copy, as are ones an earlier run left dangling |

A company's shared resume and cover letter stay in `Applications/` while any of its roles is still before applying.

## Steps

1. **Asked in a session:** preview first.

   ```
   python3 "<root>/LaunchPad App/cleanup.py" --dry-run
   ```

   Show the report. If it would auto-close or archive anything beyond documents, say so plainly and ask before going on. If it would change nothing, say that in one line and stop.

2. **Run it** (after the user's yes, or straight away in a scheduled run):

   ```
   python3 "<root>/LaunchPad App/cleanup.py"
   ```

3. **Report** the script's output as it printed it: auto-closed cards (and that they can be dragged back to undo), archived cards, people and files, and withdraw suggestions. In a scheduled run, paste it into the run report.

If the script is missing, say so and offer to restore it from git (`git checkout -- "LaunchPad App/cleanup.py"`) rather than improvising the logic. `cleanup_applied.py` is a wrapper kept for older callers; it runs the same script.
