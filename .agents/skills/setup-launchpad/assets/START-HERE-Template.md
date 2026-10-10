# LaunchPad — Start Here

Your command center. The board lives in `LaunchPad App/`. Open it by asking
Claude **"open LaunchPad"**, or run `uv run tracker.py` in this folder
and go to http://localhost:8787. It opens on **Today**, which lists what
needs you. Setup, the daily routine and hosting are covered in `Docs/`.

> Claude will occasionally ask permission to open this folder — on a new
> session, or when an automation runs. Just approve
> it; that access is what lets it help.

## The loop
1. **Find roles.** New matches land in the **Screening** column
   (automatically, if the daily scrub is on — or ask Claude to run a scrub).
2. **Screen.** Open a card and click **✓ Approve → To Apply**, or **✗ Drop**.
   **Review all** on Today does a whole batch at once.
3. **Get documents.** Tailored resume + cover letter are generated per
   To Apply card (scheduled, or just ask Claude).
4. **Apply.** Ask Claude to "apply to <company>": it fills the form from
   `Resume/Answer-Bank.md` and stops for you to review before anything is
   submitted. Or apply yourself with the document buttons in the job's panel.
   Then click **✓ Mark applied**.
5. **Track replies.** The reply monitor advances cards when companies write
   back (or ask Claude to check).
6. **Interviews.** Add each round with **+ Add interview** on the Interviews
   screen. Ask Claude to "prep me for <company>"; the prep document shows in
   the job's panel and next to the round.
7. **See what's working.** The **Insights** screen shows where roles and
   outreach are getting stuck.

## The files
- `Job-Thesis.md` — what "a fit" means; edit anytime, automations follow it.
- `Resume/Master-Resume.md` — canonical resume; tailored copies derive from it.
- `Resume/Answer-Bank.md` — your answers to the questions forms always ask.
- `Data/data.json` — the single source of truth for the board (and
  `Data/contacts.json` for the People screen), kept apart from the app.
  Git-versioned; rolling backups in `Data/backups/`.

## Referral outreach (optional — keep this section only if it's set up)

1. **Every morning** the outreach prep adds new LinkedIn roles to Screening. For companies in **To Apply**, it finds people likely to refer you and drafts messages. It never sends anything.
2. **Open People** in the tracker and click a person to open their panel:
   - **Approve** the people you want to connect with. Use **+ Add person** for someone you already know at a company.
   - Tick **Send with a note** for the people worth one (LinkedIn's free plan allows only a few notes a month).
   - For connected people, check the drafted ask, pick the resume (tailored, base, or upload a PDF), and tick **Approve ask**.
3. **Say "send outreach"** to Claude. You'll see the exact list of requests and messages first, and nothing goes out until you say yes.

Settings (default resume, note length, pacing, optional limits) are in `Data/outreach-config.json`.
