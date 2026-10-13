# Run LaunchPad every day

Everything in LaunchPad can be done by asking Claude in a session. A scheduled task does the same work on a timetable, so the board is fresh when you open it.

## What the daily routine does

| Run | Work |
|---|---|
| Morning | Looks for new roles and hiring posts, scores them against `Job-Thesis.md`, and adds matches to Screening. Finds people at approved companies. Checks who accepted and who replied. Drafts referral asks and follow-ups |
| Evening | Checks accepts and replies again, drafts follow-ups, then runs the cleanup, which archives stale and closed items and never deletes |

Each run starts with the readiness check and stops with the reason if it fails. Each run that changes files commits them on a branch, opens a pull request, checks it, and merges it.

## What it may send, and when

Nothing is sent just because the routine ran. A message or request goes out only when one of these is true:

- you approved that exact item in the tracker (a job moved to To Apply, **Approve** on a person, **Approve ask** on a message, **Approve reply** on a reply);
- you switched on **Autopilot** on the Today screen, and the item meets the rule you set there;
- you said yes to a list the routine showed you in its session.

Replies to people who answered you, and emails, always wait for your yes. Autopilot is off until you turn it on.

## Before you schedule it

- Finish [Setup.md](Setup.md) through step 4, and step 5 if you want replies read from email.
- Sign in to the GitHub CLI (`gh auth login`), because the routine opens and merges pull requests.
- Have `Referral/Referral-Playbook.md` in place. It holds your own rules: which roles to keep, whom to ask first, when to send. The setup skill writes it from a template when you choose referral outreach.

## Create the scheduled task

Ask Claude: **"set up the daily routine"**. The `setup-launchpad` skill fills in `.agents/skills/setup-launchpad/assets/Routine-Prompt-Template.md` with your folder, repository and timetable, and creates the task in the Claude app.

To do it by hand, copy that template, replace every `[BRACKETED]` value, and create a scheduled task in the Claude app with the result as its prompt. Suggested timetable: weekdays at 09:00 and 18:00.

Then click **Run now** once and stay with it. The first run asks for the tool permissions it needs; approving them then lets later runs go through unattended.

## Smaller schedules

If you do not want referral outreach, schedule single skills instead. Each prompt must name your folder and begin with the readiness check.

| Task | Suggested time | Prompt runs |
|---|---|---|
| Job scrub | 07:00 | the `job-scrub` skill |
| Reply monitor | 08:00 | the `reply-monitor` skill (needs email connected) |
| Tailored documents | after the scrub | the `generate-docs` skill, only if you tailor a resume per role |
| Cleanup | 22:00 | `python3 "LaunchPad App/cleanup.py"` |

## Keeping it healthy

- A scheduled task lives in the Claude app on one computer. It runs only while that computer is on and the app is open.
- The task's prompt is not in the repository. After renaming a folder or a skill, update the prompt too.
- If a run reports a LinkedIn security check, do nothing on LinkedIn until you have cleared it yourself in the browser.
- `python3 "LaunchPad App/cleanup.py" --dry-run` shows what the cleanup would move without moving it.
