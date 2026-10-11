---
name: job-scrub
description: Scan job boards for new openings matching the user's job thesis, dedupe against their tracker, and add matches to the Screening column. Use when the user says "run a job scrub", "find new roles", "look for new openings", "any new jobs today?", or when a scheduled daily scrub fires.
---

# Job scrub

Find newly posted openings that fit the user's thesis, then (1) write a dated review file and (2) append genuinely new roles to the tracker.

## Ground rules
- `<root>` is the user's LaunchPad folder (contains `Job-Thesis.md` and `LaunchPad App/`). If unknown, ask, or locate with: `find ~ -maxdepth 4 -name Job-Thesis.md`. The data file is `<root>/Data/data.json` (installs from before v0.3.0 keep it at `<root>/LaunchPad App/data.json` — use whichever exists; the server's `/data.json` always serves the right one).
- `jobs` below means `python3 "<root>/LaunchPad App/jobs_store.py"`: the only way to change jobs. It checks what you write, stamps the dates that follow from a status, skips duplicates, and works whether or not the tracker is running (an open tracker picks the change up when the user switches back to it). Never edit `data.json` yourself, and never POST to the server. Never modify `index.html`. Never create `.bak` files. Git is optional (see Step 5).
- Never fabricate listings. If zero new roles, say so.

## Step 1 — Read the thesis
Read `<root>/Job-Thesis.md`. It defines Tier A (weight highest), Tier B (stretch — surface only when its stated conditions are met, and flag it), Tier C (IC targets), plus arrangement, company-size, comp-floor, and industry constraints. Judge every result against it, including its "background reality check" — do not surface roles that oversell the user.

## Step 2 — Search
Run several searches per tier (Tier A phrasings first) across:
- Any connected job-board connectors (Indeed, ZipRecruiter, Dice, etc.)
- Public boards via web search/fetch: Google Jobs, We Work Remotely, Built In (best comp data), Wellfound (often login-gated — skip gracefully), and any boards named in the thesis (e.g., Idealist for mission-driven).
Prefer postings from the last 1-3 days. Keep apply URLs intact; tag each role with its true source. Verify remote eligibility and comp against the thesis rather than trusting board filters; flag uncertainties instead of dropping roles silently.

## Step 3 — Score and capture (per surviving role)
For each genuinely new role:
- FIT SCORE: judge it against the thesis and assign 0-100 (90+ bullseye on Tier A with constraints met; 70-89 strong; 50-69 plausible with caveats; below 50 don't add it). Write one honest clause of "why" for the notes. Score against the thesis's reality check, not aspiration.
- FIT BREAKDOWN: alongside the score, record why, as six parts scored 0-5 each in `fitBreakdown`. The tracker shows them under the fit score. `role`: the day-to-day work against the thesis's tier titles. `skills`: the must-have skills the master resume genuinely covers. `level`: the seniority and years asked against the user's. `pay`: stated pay against the floor. `location`: arrangement and location against the thesis. `posting`: whether the posting is real and fresh (posted date, a requisition ID, reposts, still accepting applications). With no signal for a part (pay not stated, no posting date), give it 3 and say so in the notes; never invent a signal. `fitScore` stays your overall judgment; it is not computed from the parts.
- CAPTURE THE POSTING: when you fetched the full job description, save it to `<root>/Job Listings/<Company> - <Role>.md` (sanitize / and : in names) with the URL and capture date at the top. This makes document generation work later even if the posting goes down. Skip the file (never fabricate one) when you only saw a summary.

## Step 3b — Dedupe (critical)
Run `jobs find --company "<Company>" --role "<Role>" --url "<link>"` for each candidate: anything it returns is already on the board. Also check recent `New-Openings-*.md` files in `<root>/Job Listings/` and duplicates within today's results (keep the source with the cleanest URL/comp). Quality over quantity.

## Step 4 — Write the review file
`<root>/Job Listings/New-Openings-YYYY-MM-DD.md` (never in `<root>` itself — the root holds only the thesis, README and similar instruction docs): short intro, then a table per tier (Company | Role | Comp | Fit | Notes | Link), rows sorted by fit score, flags for anything to verify, and an honest "Reality check" paragraph at the end.

## Step 5 — Add to the tracker
Pass all the new roles to `jobs add` as one JSON array on stdin. Per role, give only what you found:
```json
[{ "company": "", "role": "", "location": "", "arrangement": "Remote|Hybrid|Onsite", "url": "<apply link>",
   "salary": "", "tier": "A|B|C", "fitScore": "<0-100>",
   "fitBreakdown": {"role": 0, "skills": 0, "level": 0, "pay": 0, "location": 0, "posting": 0},
   "notes": "<tier + fit why + verify flags>", "source": "<board>" }]
```
The tool sets the id, today's date and the `Screening` status, and skips anything already on the board. Read its output: `added` is what landed, `skipped` says why the rest did not. If it prints an error, nothing was saved; fix the value it names and run it again. Then commit best-effort wherever git is set up (skip silently if it isn't): if `<root>` is a git repo, `git -C "<root>" add -A -- Data "Job Listings" && git -C "<root>" commit -m "job-scrub: add N roles"`.

## Step 6 — Report
How many new roles, the Tier A standouts, link to the review file. New roles appear in the app's Screening column on next load.
