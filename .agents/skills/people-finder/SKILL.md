---
name: people-finder
description: Find people at the user's To Apply companies who are most likely to refer them (former colleagues, fellow alumni, engineers in the role's org, hiring managers, recruiters), check who accepted their LinkedIn connection requests, and send approved requests in supervised batches. Use for "find people at <company>", "who can refer me", "check who accepted", "send connection requests", "send outreach", or when the outreach-prep task runs.
---

# People finder

Read `.agents/skills/referral-outreach/Outreach-Rules.md` first; it applies to every step (including what `<root>` and `store` mean).

- **Read-only modes** (these can run on schedule): Research and Acceptance check.
- **Supervised modes** (the user starts these): Send and Withdraw.

"Config" means `Data/outreach-config.json`. If that file is missing, the defaults in `LaunchPad App/outreach-config.json` apply; to change a setting, copy that file to `Data/outreach-config.json` first and edit the copy. Found people appear in the tracker's **People** tab, where the user can Approve someone by hand (connects next run even if the job isn't approved), skip someone, and choose the resume for each ask. People are not reviewed before connecting: once their job is approved (card in To Apply or later), requests go out automatically (see Outreach-Rules.md).

## Research (read-only)

1. **Know the user's network.** From `Resume/Master-Resume.md`, list every employer (with dates) and every school (with dates). These drive the searches and the scoring below.
2. **Targets:** companies with at least one `To Apply` card in the tracker's `data.json` (`Data/data.json`; older installs: `LaunchPad App/data.json`).
   - For each, run `store list --company "<Company>"`.
   - Skip companies that already have `contactsPerCompany` contacts not in `Skipped`.
3. **Budget:** open at most `maxProfileViewsPerRun` profile pages in this run, across all companies and the acceptance check. Count every profile page you open.
4. **Search** each company's People page, one keyword at a time, in this order:
   - URL: `https://www.linkedin.com/company/<company-slug>/people/?keywords=<keyword>`. Get the slug from the company's LinkedIn page URL.
   - Keywords:
     1. each of the user's employers, most recent first;
     2. each of the user's schools (a short, distinctive form of the name);
     3. the role's area, e.g. `backend`, `platform`, `data`, `design` or `AI`, from the To Apply card;
     4. `recruiter`;
     5. `talent acquisition`.
5. **Confirm:** open the profiles of promising people, within budget. Check:
   - current company and title;
   - one of the user's employers in their past experience;
   - one of the user's schools in their education;
   - connection degree.
6. **Score** `likelihood` from 0–100.
   - Base score by relation: `ex-colleague` 75, `alumni` 60, `same-org engineer` (a senior person in the role's team or org) 50, `hiring manager` 45, `recruiter` 40.
   - +10 if their dates overlapped with the user's at that employer or school.
   - +5 if their title is Senior, Staff, Lead or Principal.
   - −10 if they're clearly outside the role's org (e.g. sales, or non-tech HR).
   - Cap the score at 100.
   - `why` gives the honest basis in one line, e.g. "Acme 2020–2023 (overlapped), now Senior Engineer in Payments".
7. **Add** the best people, up to `contactsPerCompany` minus the company's existing count, in one call:
   ```bash
   echo '<json array>' | python3 "LaunchPad App/contacts_store.py" add
   ```
   - Each person needs:
     - `company`, spelled exactly as on the tracker card, plus `name`, `title`, `linkedinUrl` and `location`;
     - `relation`, one of `ex-colleague`, `alumni`, `same-org engineer`, `hiring manager`, `recruiter`;
     - `likelihood`, `why`, and `appIds` (that company's To Apply card ids).
   - Add `"stage": "Connected"` if they're already a 1st-degree connection.
   - If the person published an email address for applications or referrals (in a hiring post or their contact info), add `email` and `emailSource` (where you saw it). Never guess an address or use a lookup site. Someone you can only reach by email (no LinkedIn profile) is added with `"channel": "email"`; they start at Connected because there is no request to accept.
8. **Connection notes** depend on `noteSelection` in the config:
   - `"manual"` (default): select nothing. The user picks notes in the People screen.
   - `"auto-top"`: run `store quota` and take `remainingNotes` as N; if it is `null` (no note budget set), N is every new Found contact. Set `useNote: true` on the N new Found contacts with the highest likelihood, using `store update <id>` with `{"useNote": true}`.
   - `"off"`: do nothing.

   Then, for every Found or Queued contact with `useNote: true` and an empty `connectNote`, draft one from the `connect-note.md` template. It must fit `noteCharLimit` and follow the message rules. Save it with `store update <id>` and `{"connectNote": "<text>"}`.

## Acceptance check (read-only)

1. Run `store list --stage Requested`.
2. Open `https://www.linkedin.com/mynetwork/invitation-manager/sent/`. For each Requested contact who is no longer listed as pending:
   - Open their profile. This counts toward the budget.
   - If it shows them as 1st-degree (a "1st" badge or a Message button), run `store update <id>` with `{"stage": "Connected"}`.
   - Otherwise, leave them Requested and mention them in the report.
3. For invitations still pending, list those whose `dateRequested` is more than `staleInviteDays` ago as withdrawal suggestions in the report.

## Send connection requests (automatic for approved jobs)

Runs in every pipeline run, and whenever the user says "send outreach" or "send the requests". No yes is needed for the batch: approving the job was the approval.

1. **Pick the batch.**
   - Run `store list --stage Found` and `store list --stage Queued`. Take every Queued contact (approved by hand by the user). From Found, keep only contacts linked to an approved job: a card in Data/data.json with status To Apply, Applied, Phone Screen, Take-home, Interviewing, Final Round or Offer, matched by `appIds` (or by company when `appIds` is empty). Never connect Found contacts whose jobs are all in Screening or closed. Leave out anyone with `channel: "email"` or no `linkedinUrl`: there is no profile to connect with. Sort by likelihood, highest first.
   - Run `store quota`. `remainingToday` is `null` when no request limit is set: take them all. If it's a number, take the first `remainingToday`, and if it's 0, say the limit the user set is reached and stop.
2. **Prepare notes.**
   - Requests always go plain (the user's rule): ignore `useNote` and skip the rest of this step.
   - If `noteBudgetPerMonth` is set (not `null`), notes allowed this month = `noteBudgetPerMonth − notesSent`, and if more contacts in the batch have `useNote: true` than that, the lowest-likelihood ones go plain. With no budget set, every `useNote: true` contact keeps its note.
   - Draft any empty `connectNote` for contacts that keep their note.
3. **Don't ask.** List the batch in the run report afterwards (name · company · job).
4. **Send each request, in order:**
   1. Open their profile and find **Connect**. It is sometimes under **More**. If it isn't there, skip them per the rules.
   2. With a note: click **Add a note**, type the exact approved text, then **Send**. Plain: click **Send without a note**.
   3. Confirm the profile now shows **Pending**. Then immediately run `store update <id>` with `{"stage": "Requested"}`, and add `"useNote": false` if the request went plain.
   4. Wait a random `minSendGapSeconds`–`maxSendGapSeconds` before the next one.
5. **Report:** requests sent, people skipped (and why), and today's counts from `store quota` (plus what's left, if the user has set any limits).

## Withdraw stale invites (supervised)

Only when the user asks.
1. Recompute the stale list in this session; don't rely on a previous run's report. Run `store list --stage Requested`, then open `https://www.linkedin.com/mynetwork/invitation-manager/sent/` and keep only those whose `dateRequested` is more than `staleInviteDays` ago and who are confirmed still pending on that page. Show the exact names and wait for a yes.
2. For each, on that same page, click **Withdraw** and confirm the dialog.
3. Run `store update <id>` with `{"stage": "Skipped", "notes": "<existing notes> [outreach: withdrawn YYYY-MM-DD]"}`.
4. Wait the send gap between withdrawals.

At the end of every mode, commit per Outreach-Rules.md.
