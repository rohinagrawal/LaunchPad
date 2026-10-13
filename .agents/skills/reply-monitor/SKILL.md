---
name: reply-monitor
description: Scan the user's email for replies to job applications and advance the matching tracker cards (Phone Screen, Interviewing, Rejected, etc.). Use when the user says "check for job replies", "any word from companies?", "scan my email for application updates", or when a scheduled reply monitor fires. Requires an email connector.
---

# Reply monitor

Find application replies in the user's email and update the tracker to match. Read-and-update only — never send email or take irreversible action.

## Ground rules
- `<root>` is the user's LaunchPad folder (locate with `find ~ -maxdepth 4 -name Job-Thesis.md` if unknown). `jobs` below means `python3 "<root>/LaunchPad App/jobs_store.py"`: the only way to change jobs. It checks what you write, stamps the dates that follow from a status, skips duplicates, and works whether or not the tracker is running (an open tracker picks the change up when the user switches back to it). Never edit `data.json` yourself, and never POST to the server. Git commits are best-effort and optional — skip silently if git is unavailable.
- Requires a connected email connector (Gmail or Outlook). Without one, tell the user and stop.

## Steps
1. Roles "in play" (can receive replies): `jobs list --status "Applied,Phone Screen,Interviewing,Take-home,Final Round,Offer"`. Also list `jobs list --status "To Apply" --fields company,role,url`: an application the user sent without marking the card shows up in the inbox first.
2. Search the inbox for the last ~2 days (the last 7 on a first run): (a) company names of in-play and To Apply roles; (b) common ATS domains: greenhouse.io, lever.co, ashbyhq.com, rippling.com, myworkday.com, icims.com, smartrecruiters.com, workable.com, jobvite.com, eightfold.ai. Read full bodies of hits.
3. Classify each genuinely relevant message: which company/role; application received, interview request, scheduling, assessment, recruiter outreach, a referral entered by someone, or rejection.
4. Update matched jobs ONLY (company + role, case-insensitive). For each: `jobs move <id> "<status>"` with exactly one of "Phone Screen", "Interviewing" (scheduling, assessments, ongoing rounds), "Take-home", "Final Round", "Offer", or "Rejected" (a rejection, or the company closed the role). Leave "Applied" for automated acknowledgements with no human next step. Then `jobs update <id>` with `{"lastContact": "<today>"}` plus a sensible `nextFollowup` if action is needed, and `jobs note <id> "[<today>: one-line summary]"`. Never rewrite existing notes.
4a. Applications the board doesn't know about:
   - "Application received" for a card still in To Apply (same company and role): the user applied. `jobs update <id>` with `{"dateApplied": "<the email's date>", "lastContact": "<the email's date>"}`, then `jobs move <id> Applied` (the follow-up date is stamped from the applied date) and a note.
   - "You have been referred, now apply" for a To Apply card: leave the status, set `lastContact`, add a note, and put it at the top of the report as something to do now; referral links often expire within days.
   - An application or referral for a role with no card: change nothing. Report the company, role and link, and offer to add the card.
4b. Follow-up sweep (no email needed): `jobs list --status Applied`. Any with `nextFollowup` <= today, or 14+ days silent since `dateApplied` (no newer `lastContact`), goes in the report under "Needs a nudge" — company, role, dateApplied, days silent — then bump its `nextFollowup` +7 days with `jobs update` so it isn't re-flagged daily. At 21+ days silent, recommend marking it Ghosted (never change the status yourself). Set `nextFollowup` = `dateApplied` + 7 for any Applied entry missing one.
4c. Referral replies by email: run `python3 "<root>/LaunchPad App/contacts_store.py" list --stage Asked` and, for each contact that has an `email`, search the inbox for mail from that address after `dateLastReply` (or `dateAsked` when it is empty). On a new message, update the contact through the same tool (`update <id>` with `{"dateReplied": "<their first reply; keep an existing value>", "dateLastReply": "<date and time of this message, ISO>", "notes": "<existing notes> [email reply <today>: one-line summary]"}`); never hand-edit `contacts.json`. A clear yes or no changes the stage as in the `referral-outreach` skill.
4d. Interviews: when a card moves to Phone Screen or Interviewing and has no `prepMD`, say so in the report and offer the `interview-prep` skill.
5. Commit best-effort wherever git is set up (skip silently if it isn't): if `<root>` is a git repo, `git -C "<root>" add -A -- Data && git -C "<root>" commit -m "reply-monitor: <summary>"`.
6. Report a digest: company, role, what they said, recommended next action; offer to draft any needed reply (but never send). One line if nothing new.
