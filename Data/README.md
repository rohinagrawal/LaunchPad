# Data

Everything the tracker stores, kept apart from the app in `LaunchPad App/`.

| File | What it is | Written by |
|---|---|---|
| `data.json` | The jobs board: one entry per role. | The tracker (Jobs view) and `LaunchPad App/jobs_store.py` (used by the skills) |
| `contacts.json` | The People screen: referral contacts and where each is in the outreach pipeline. | The tracker (People view) and `LaunchPad App/contacts_store.py` (used by the outreach skills) |
| `outreach-config.json` | Your outreach settings (base resume, limits, pacing). Optional: without it the defaults in `LaunchPad App/outreach-config.json` apply. | You, or the setup skill |
| `backups/` | The last 20 versions of each file, made before every save. Local only (not committed). | The tracker server |

Optional fields the skills add (cards and people without them work as before):

- On a job: `fitBreakdown` (six parts, 0–5 each: `role`, `skills`, `level`, `pay`, `location`, `posting`), and `prepMD` / `prepPath` for an interview-prep document.
- On a person: `email`, `emailSource` (where the address was published) and `channel` (`linkedin` or `email`); `replyMessage` (the drafted reply to someone who answered) `replyApproved` (the **Approve reply** tick) and `replyDone` (nothing is owed on their latest message: the reply was sent, or you chose **No reply needed**; a newer message from them clears it) with `dateLastReply` (when they last wrote; `dateReplied` stays their first reply).

Rules:

- Change these through the tracker or its tools, not by hand. When the server is running it owns the files (atomic writes, backups, conflict checks).
- The hosted copy on Render commits its saves straight to these files on GitHub, so `git pull` before editing here.
- To restore an older version, copy a file from `backups/` (or check one out from git history) while the server is stopped.
