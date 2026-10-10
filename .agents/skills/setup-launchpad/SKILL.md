---
name: setup-launchpad
description: Set up LaunchPad for a person — check the tracker app that ships in this repo, then build their job thesis, master resume, answer bank and (optionally) referral outreach and automations. Use when the user says "set up LaunchPad", "start my job hunt", "get me set up for job hunting", "set this up for me", "set up the daily routine", "set this up on a new computer", "host my tracker", or has just cloned this repo and asks how to begin.
---

# Set up LaunchPad

The tracker app and these skills already live in this repo. Setup makes the system the user's own: it builds the documents every other skill reads. Everything downstream depends on two of them, `Job-Thesis.md` and `Resume/Master-Resume.md`.

`<root>` is the repo folder (it holds `LaunchPad App/` and `tracker.py`). Templates are in this skill's `assets/` folder.

**Never overwrite a document that already exists.** If `Job-Thesis.md`, `Resume/Master-Resume.md` or any other file below is already there, read it, tell the user what you found, and only fill gaps they ask for. Setup on a folder that is already in use is a check-up, not a reset.

## Step 0 — Whose folder is this, and can it run?

Ask once, unless it is obvious from the conversation: is this a fresh start for a new person, or an existing setup being checked (for example on a new computer)?

- **Existing setup:** change nothing here; go to Step 1. On a new computer the documents are already in the repo, and what is missing lives outside it: the browser sign-in, the email connector and the scheduled task (see `Docs/Setup.md`, "Moving to another computer").
- **Fresh start in a folder that holds someone else's search:** list what belongs to the previous owner (`Job-Thesis.md`, `Target-Companies.md`, `START-HERE.md`, everything under `Resume/`, `Referral/`, `Applications/`, `Interview Prep/`, `Job Listings/`, and `Data/data.json`, `Data/contacts.json`, `Data/autopilot.json`). With the user's explicit yes, move those into `Archive/previous-owner-<today>/`, keeping their paths, including `Data/outreach-config.json`. Archive, never delete. Stop the tracker first if it is running, and start it again afterwards.

Then check the tools: `python3 --version` must be 3.9 or newer; `uv`, `git` and `gh` are optional, so note which are missing and what each is for (`Docs/Setup.md`, "What you need") without blocking on them.

## Step 1 — Check the folder

Expected layout (create only the folders that are missing; never create files the steps below don't name):

```
<root>/
├── START-HERE.md
├── Job-Thesis.md
├── LaunchPad App/            (the app, code only)
├── Docs/                     (setup, hosting and automation guides)
├── Data/                     (the tracker's data: data.json, contacts.json, backups)
├── Applications/             (per-company documents, added as you apply)
├── Interview Prep/           (one prep doc per interview, written by the interview-prep skill)
├── Resume/
│   ├── Master-Resume.md
│   └── Answer-Bank.md
├── Cover Letters/
│   └── Cover-Letter-Template.md
├── Company Research/
│   └── Company-Research-Template.md
├── Job Listings/
└── Referral/                 (optional LinkedIn and email referral outreach)
    ├── Templates/            (editable message templates)
    └── Referral-Note.md
```

If `Data/data.json` doesn't exist, create it containing `[]`. Then run the check and read its report:

```
python3 "<root>/LaunchPad App/preflight.py"
```

A FAIL about a missing thesis or resume is expected before Steps 2 and 3. Fix any other FAIL before going on.

Git is optional. If `<root>` isn't a repo and git is available, offer to init one so the data and documents are versioned; `Data/backups/` stays out of it.

## Step 2 — Build the Job Thesis (the most important step)

Interview the user, then write `<root>/Job-Thesis.md` from `assets/Job-Thesis-Template.md`.

Interview mechanics (follow exactly):
- BATCH questions into at most three grouped rounds using a multi-question form (the question tool supports several questions per call), never a long series of one-question turns.
- Track what has been answered. NEVER re-ask a question that has an answer. If the user picks "Other"/"I'll type it" and provides text, that text IS the answer.
- Only follow up on a specific answer when it fails the sanity check below, and phrase it as a follow-up ("You said $10K, did you mean $100K?"), not a repeat of the original question.
- Read what's already on disk first (a resume in `Resume/`, an existing thesis) and prefill from it instead of asking.

Cover these six blocks:

1. **What.** Target roles in tiers: Tier A (primary fit: roles they're most competitive for), Tier B (stretch: wanted but needing honest flagging), Tier C (solid individual-contributor targets). Push for honesty: the thesis works only if Tier A reflects what their track record actually supports. Ask what they've *actually* run, built or led versus been adjacent to.
2. **Level.** Where they are now (student, new graduate, years of experience, current title) and the level they're aiming for. This sets the search filters and what counts as over- or under-level.
3. **Where.** Target companies by priority (apply to anything they post / apply if the fit is strong / never), plus company size or stage. Location: must-have cities or countries, remote preference, willingness to relocate.
4. **When.** Start date, the date they need an offer by (or "rolling"), notice period, and anything that limits the next few weeks.
5. **Constraints.** Compensation floor (don't push if they'd rather not say), work authorisation or sponsorship needs, industries to favor or avoid, dealbreakers.
6. **How.** How they want to apply: through referrals first, direct applications, cold email, or a mix. This decides which automations Step 6 offers.

Sanity-check answers as they come in: an implausible value (a "$10K" comp floor, an empty Tier A, a location that contradicts "remote only") gets one friendly follow-up question, not silently written into the thesis.

## Step 3 — Build the Master Resume

If the user has a resume (any format), convert it into `Resume/Master-Resume.md`: complete history, everything included (tailored copies trim from it). If they don't, interview them role by role.

The master resume is the source of truth every document and message inherits from:
- **Everything in the user's own words.** Capture stories and outcomes as the user tells them; don't "improve" their phrasing. Never add a skill, metric, or accomplishment the user didn't state. Ask for the real number and record it verbatim, or leave it out.
- **Canonical terms for hard skills.** Record tools, platforms, and certifications under their exact standard names so tailored resumes can match ATS keywords honestly. Spell out acronyms once.
- **Standard structure:** Summary, Skills, Professional Experience (reverse-chronological, "Month YYYY – Month YYYY" dates), Education. Contact info at the top of the body.
- **Interview-survivable only:** if the user hesitates to claim something, note it as adjacent experience rather than ownership.

If they have a PDF of their usual resume, save it under `Resume/` and put its path (relative to `<root>`, e.g. `Resume/<Name> - Resume.pdf`) in `baseResumePath` in `Data/outreach-config.json` (create it as a copy of `LaunchPad App/outreach-config.json` if it is missing; never edit the copy in the app folder, which holds the defaults every user gets). Set `defaultAttachment` to `"base"` if they want that PDF used everywhere, or leave it `"tailored"` if they want a resume tailored per role.

## Step 4 — Answer bank

Write `Resume/Answer-Bank.md` from `assets/Answer-Bank-Template.md`. It holds the answers application forms ask for again and again, so the `apply-to-job` skill can fill forms without asking each time.

- Prefill only what the master resume and thesis already state (name, contact details, current employer, years of experience, location, pay floor).
- Ask the user for the rest in one grouped round. Leave any answer they skip as `(not set)`; never invent one.
- Optional self-identification questions (gender, ethnicity, disability, veteran status) default to "Prefer not to say" unless the user gives an answer.

## Step 5 — Templates and START-HERE

Copy `assets/Cover-Letter-Template.md` and `assets/Company-Research-Template.md` into their folders if missing, filling in the user's name and contact details. Write `START-HERE.md` from `assets/START-HERE-Template.md`, adapted to their setup.

## Step 6 — Offer the automations (optional, each independently)

Offer only what fits how they said they want to apply (Step 2, block 6).

1. **Daily job scrub**: a scheduled task (suggest 7 AM) running the `job-scrub` skill against their thesis.
2. **Reply monitor**: a scheduled task (suggest 8 AM) running `reply-monitor`. Needs a connected email connector (Gmail or Outlook).
3. **Tailored documents**: a scheduled sweep running `generate-docs` for To Apply cards. Skip this if they apply with one base resume.
4. **Nightly cleanup**: a scheduled task (suggest 10 PM) running `python3 "LaunchPad App/cleanup.py"`, which archives and never deletes.
5. **Referral outreach**: only if they want it. LinkedIn steps need a browser signed in to LinkedIn (the desktop app's built-in browser, or Claude in Chrome). Explain it in two sentences: Claude finds people at their approved companies who could refer them and drafts the messages; the People screen shows every draft and what will be sent. If yes:
   - Write `<root>/Referral/Referral-Note.md` from `assets/Referral-Note-Template.md`, using only facts from the master resume (confirm the LinkedIn URL and email with the user).
   - Copy the message templates from the `referral-outreach` skill's `templates/` folder into `Referral/Templates/` if that folder is empty, so the user can edit their own copies.
   - Write `<root>/Referral/Referral-Playbook.md` from `assets/Referral-Playbook-Template.md` if it is missing: ask for the choices it brackets (whom to ask first, former employers and schools, length and style of the ask, when to send, what may go out without a second yes) in one grouped round, and prefill the role filters from the thesis.
   - Offer the **daily routine**: one scheduled task, morning and evening, that does the whole loop. Build its prompt from `assets/Routine-Prompt-Template.md`, filling every bracket from the user's folder, repository and answers. It needs `gh` signed in, because each run opens and merges a pull request. `Docs/Automation.md` is the user's guide to it. If they want the routine, skip the separate tasks in 1–4 above; the routine covers them.
   - Offer a daily **outreach prep** scheduled task (suggest 7:30 AM) that runs, read-only: `linkedin-job-search`, then `people-finder` Research and Acceptance check, then `referral-outreach` Draft. Its prompt must start with the preflight check and stop at any LinkedIn checkpoint.
   - Tell them where it shows up: the **People** switch at the top of the tracker.

6. **Hosted copy**: if they want the tracker on their phone, walk them through `Docs/Hosting.md`. They create the token and set the environment values themselves in the host's dashboard; never ask them to paste a password or token into the chat.

Outside the repo, and therefore the user's to do (tell them which apply): sign in to LinkedIn in the built-in browser, install Claude in Chrome if asks should attach a resume, connect an email connector, and run `gh auth login`.

For any scheduled task created, write the prompt to be fully self-contained (each run has no memory): include the user's folder path, start with `python3 "LaunchPad App/preflight.py"`, and name the skills in `.agents/skills/` it should follow. Recommend the user click "Run now" once per task to pre-approve its tools.

## Step 7 — Hand off

Start the tracker for the user (`uv run tracker.py` from `<root>`, or `python3 "LaunchPad App/launch.py"`) and confirm the rail on the left ends with "data.json · synced with the server".

The handoff message must pass the non-technical-reader test:
- Plain language. To open the board, say "just ask me to open LaunchPad".
- No implementation details (servers, JSON, sync, backups) unless the user is technical. One reassurance sentence is allowed: "Everything lives in your <folder> folder on your computer."
- Keep it short: what got set up (in their words: "your board", "your resume file"), the loop in three or four plain sentences (new roles appear in Screening → approve the ones you like → people and documents are prepared for you → apply and move the card along), and ONE clear next action.
- If the user seems technical (they asked about ports, git, code), match their level instead.

## Step 8 — Self-check (run before sending the handoff)

1. `python3 "LaunchPad App/preflight.py"` prints no FAIL.
2. `<root>/Job-Thesis.md` exists, has no unfilled [BRACKETS], and contains no implausible values you failed to question.
3. `<root>/Resume/Master-Resume.md` exists and reflects the user's actual history.
4. `<root>/Resume/Answer-Bank.md` has no invented answers: everything is from the user, the resume, or marked `(not set)`.
5. No existing document was overwritten.
6. No personal details were written into app code or skill files; they belong only in the user's documents and `Data/outreach-config.json`.
