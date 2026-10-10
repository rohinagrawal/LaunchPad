# Set up LaunchPad from scratch

From an empty computer to a working tracker with your own documents, in the order to do it. Steps 1 to 3 give you a running tracker. Steps 4 to 7 are optional and independent.

## What you need

| Need | For | Notes |
|---|---|---|
| Python 3.9 or newer | Running the tracker | Already on macOS and most Linux. Nothing to `pip install`; the app uses the standard library only |
| git | Getting the code and keeping history | Optional if you download a zip, but the hosted copy and the daily routine need it |
| [uv](https://docs.astral.sh/uv/) | The one-line run command | Optional. Without it, use the `python3` command shown below |
| Claude Code (desktop app or CLI) | Setup, searching, outreach, applying | The skills in `.agents/skills/` are picked up automatically when you open this folder |
| GitHub CLI (`gh`), signed in | The daily routine, which opens and merges its own pull requests | Only for step 6 |

## 1. Get the code

On GitHub, click **Use this template** on the LaunchPad repository and create your copy as a **private** repository, named for example `my-launchpad`. Then clone your copy:

```bash
git clone <your private copy> LaunchPad
```

```bash
cd LaunchPad
```

It has to be private, because your job search data (roles, the people you contact, your resume) is committed to it. A fork of a public repository cannot be made private, which is why this uses a template copy.

## 2. Run the tracker

```bash
uv run tracker.py
```

Without uv:

```bash
python3 "LaunchPad App/server.py"
```

Open http://localhost:8787. The rail on the left should end with `data.json · synced with the server`.

To look around with fake data first, without touching anything of yours:

```bash
uv run Demo/demo_people.py --port 8799
```

## 3. Make it yours

Open the folder in Claude Code and say **"set up LaunchPad"**. The `setup-launchpad` skill then:

1. Checks the folder and runs the readiness check.
2. Interviews you and writes `Job-Thesis.md`: the roles, level, companies, locations and pay floor that count as a fit. Every search reads this file.
3. Turns your resume into `Resume/Master-Resume.md`, the source every document and message is drawn from.
4. Writes `Resume/Answer-Bank.md`, your answers to the questions application forms always ask.
5. Copies the cover letter and company research templates, and writes your `START-HERE.md`.
6. Offers the optional pieces below.

It never overwrites a document that already exists. If the folder still holds a previous owner's documents and data, tell it you are starting fresh: it moves their files into `Archive/` first, with your yes, and then builds yours.

When it finishes, check the result yourself:

```bash
python3 "LaunchPad App/preflight.py"
```

Every line should read `OK` or `WARN`. A `FAIL` names what is missing and how to fix it.

## 4. Connect a browser for LinkedIn (optional)

Needed for LinkedIn job search, finding people and referral outreach.

- Sign in to LinkedIn once in the Claude desktop app's built-in browser. The skills use it first.
- Install the Claude in Chrome extension if you want referral asks to attach your resume PDF; the built-in browser cannot upload files.
- The skills stop at any LinkedIn login wall, security check or CAPTCHA and tell you. They never try to get past one.

## 5. Connect email (optional)

Connect Gmail or Outlook in Claude's connector settings. The `reply-monitor` skill reads replies to your applications and moves the cards, and email outreach creates drafts for you to approve.

## 6. Run it every day (optional)

See [Automation.md](Automation.md): one scheduled task that searches, finds people, checks replies and drafts messages each morning and evening.

## 7. Use it from your phone (optional)

See [Hosting.md](Hosting.md): the same tracker on a free host, behind a password, saving to your repository.

## Using it

`START-HERE.md` describes the daily loop. In short: new roles land in Screening, you approve the ones you like, people and documents are prepared for the approved ones, you apply and move the card along. **Today** in the tracker lists what needs you.

## Moving to another computer

Everything is in the repository, so clone it there and do step 2. Three things live outside the repository and have to be set up again on the new computer:

- the LinkedIn sign-in in the browser (step 4) and the email connector (step 5);
- the scheduled task (step 6), which belongs to the Claude app on that computer;
- the browser's own choices (theme, hidden columns).

## Updating

Your copy does not follow the public repository by itself. Connect it once:

```bash
git remote add upstream https://github.com/rohinagrawal/LaunchPad.git
```

```bash
git remote set-url --push upstream DISABLED
```

The second command makes it impossible to push your private files to the public repository by mistake. The first time, bring the product's history in with:

```bash
git pull --no-rebase upstream main --allow-unrelated-histories
```

After that, each update is:

```bash
git pull --no-rebase upstream main
```

`--no-rebase` makes the update a merge. Never rebase your copy onto the public repository: that would rewrite your own history.

Your own files (data, resume, thesis, documents) live in different paths from the product, so these pulls do not touch them. To pick up saves made on a hosted copy of yours:

```bash
git pull --rebase --autostash
```

Restart the tracker afterwards. If you host a copy, it redeploys when `main` changes.

## When something is wrong

| What you see | Cause | Fix |
|---|---|---|
| The page shows three demo rows | It was opened as a file, or the server is not running | Start the tracker and open http://localhost:8787 |
| "Your jobs and people could not be loaded" | The server is there but the data did not load | Reload; if hosted, sign in again |
| "Jobs changed elsewhere … reloaded" | Something else saved first (a Claude run, another tab, the hosted copy) | Redo the last change; nothing was overwritten |
| The tracker says it is already running | Another copy holds port 8787 | Use that one, or start a second with `--port 8790` |
| People says it needs the tracker server | The page was opened without the server | Start the tracker |
| A skill stops with a FAIL line | The readiness check found something broken | Read the line; it says what to fix |
