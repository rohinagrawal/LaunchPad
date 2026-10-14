---
name: referral-outreach
description: Draft and send tailored LinkedIn referral asks (with a resume attached) to the user's connected contacts, check their replies, and handle the single follow-up. Use for "draft referral asks", "ask for referrals", "check replies from my contacts", "send the approved asks", "send outreach", or when the outreach-prep task runs.
---

# Referral outreach

Read `Outreach-Rules.md` (next to this file) first; it applies to every step (including what `<root>` and `store` mean). Templates are the user's copies in `<root>/Referral/Templates/`, falling back to this skill's `templates/` folder.

- **Draft** (including the reply check) is read-only on LinkedIn and can run on schedule.
- **Send** is supervised.

"Config" means `Data/outreach-config.json`. If that file is missing, the defaults in `LaunchPad App/outreach-config.json` apply; to change a setting, copy that file to `Data/outreach-config.json` first and edit the copy. The user reviews every draft in the tracker's **People** tab and ticks **Approve ask** (or **Approve reply**, for a reply to someone who answered) before anything can be sent.

## Draft (read-only)

### 1. Replies

Run `store list --stage Asked` and `store list --stage Referred`. For each person, open their conversation at `https://www.linkedin.com/messaging/` (search their name) and read anything they wrote after `dateLastReply` (after `dateReplied` when that is empty, and after `dateAsked` when both are). For a person with `channel: "email"`, search the connected email connector for mail from their `email` after that same point instead (skip them, and say so, if no email connector is connected):
- **Any new message from them:** if `dateReplied` is empty, set it to today. Always set `dateLastReply` to the date and time of their latest message (ISO with +05:30). Saving a newer `dateLastReply` clears `replyDone`, so a person whose earlier reply was sent or marked **No reply needed** comes back on Today. Nothing new from them: change nothing, and never draft a reply while `replyDone` is true.
- **A clear yes** (for example, "send me the link" or "I'll refer you"): run `store update <id>` with `{"stage": "Referred"}`, making sure `appIds` names the job they will refer for, and `jobs update <job id>` with `{"referredBy": "<their name>"}`. Then run `store settle`, which stops asking anyone else for that job, and draft the after-yes reply (step 5).
- **A clear no:** `{"stage": "Declined"}`.
- **Anything else:** append a one-line summary to `notes` for the user. When the reply calls for an answer (a question, or an offer to refer for another role), also draft that answer and save it as in step 5.

### 2. Resolve the attachment

For each contact from `store list --stage Connected` whose `attachment` is empty, go by `attachmentSource`:
- **`tailored`:** look in `Applications/<Company>/` for the tailored resume PDF that `generate-docs` wrote for the card in `appIds` (`<Candidate Name> - Resume.pdf`, or `<Candidate Name> - <Role> - Resume.pdf`).
  - If none exists, run the `generate-docs` skill. It handles To Apply cards without documents.
  - If that produces the PDF, use it.
  - If it skipped the card (the card's notes gain `[docs: skipped …]`), run `store update <id>` with `{"attachmentSource": "base", "notes": "<existing notes> [outreach: tailored resume unavailable — <reason>, using base]"}`.
- **`base`:** `attachment` should already be `baseResumePath`. If it's empty, set it to that. If `baseResumePath` itself is empty, leave the attachment empty and note `set baseResumePath in outreach-config.json` for the user.
- **`upload`:** use `attachment` if it's set. If it's empty, still draft the message (step 3), and add `waiting for upload` to `notes`.

Save a resolved file with `store update <id>` and `{"attachment": "<path relative to <root>>"}`.

### 3. Draft the ask

For each Connected contact whose `askMessage` is empty, pick the job the ask is for: one of their `appIds` (or, when empty, a To Apply job at their company) that is open (posting checked today) and has no referral yet (no `referredBy`, and no Referred person linked to it). No such job: draft nothing for them and say so in the report. Otherwise, use `ask-recruiter.md` if `relation` is `recruiter`, and `ask-engineer.md` otherwise. Fill in:
- `{first_name}` from the contact.
- `{role}` and `{company}` from the linked card.
- `{job_link}`: the direct link to the job description, on a line of its own. Start from the card's `url` and resolve it to the page it finally lands on, with no redirect or tracking parameters (see "Writing messages" in Outreach-Rules.md).
- `{job_id}` from the posting, if it shows one.
- `{intro}` and `{sender_name}` from `Resume/Master-Resume.md`.
- `{fit_points}`:
  1. Read the job description, from `Job Listings/<Company> - <Role>.md` or else the card's URL.
  2. Pick the two needs where the master resume has the strongest real match.
  3. Write each as one plain sentence about what the user did, with numbers exactly as in the resume.

For a contact with `channel: "email"`, draft the same ask; it goes out as an email (see "Email" in Outreach-Rules.md), so drop "thanks for connecting" from the opening.

Follow the message rules, and compare against other asks at the same company (`store list --company`). Save with `{"askMessage": "<text>", "askApproved": false, "dateDrafted": "<now, ISO with +05:30>"}` (dateDrafted starts the autopilot hold window).

### 4. Follow-ups and close-out

These apply only to Asked contacts with an empty `dateReplied`:
- **Draft a follow-up** from `follow-up.md` when all of these hold: `dateFollowedUp` is empty, `followupMessage` is empty, and `dateAsked` is at least `followupAfterDays` days ago. Save it as `followupMessage`, with `dateDrafted` set to now.
- **Close out** with `{"stage": "No response"}` when `dateFollowedUp` is at least `followupAfterDays` days ago.

### 5. After a yes

Skip a person with `replyDone: true`. Otherwise draft a reply from `referral-yes.md`. For `{referral_note}`, use the body of `Referral/Referral-Note.md` (everything after its `---` line). If that file doesn't exist, offer to write it from the master resume (setup's `Referral-Note-Template.md`) instead of drafting the reply. Save the draft with `{"replyMessage": "<text>"}` (saving it clears `replyApproved`). It shows in the person's panel as **Your reply**, where the user edits it and ticks **Approve reply**. Never put a draft in `notes`; if an older one is there after `[reply draft]`, move it to `replyMessage` and remove it from `notes` in the same update.

At the end of Draft, commit per Outreach-Rules.md.

## Send (supervised, or automatic per the tracker)

When the user asks in chat, or in a pipeline run for the messages Outreach-Rules.md lets go out without a chat yes (approved in the tracker, or autopilot after the hold window). For those, skip step 2 and list them in the run report instead. "Send outreach" means `people-finder`'s Send (connection requests) first, then this mode, each with its own list and its own yes; see Outreach-Rules.md.

1. **Build the batch:**
   - Run `store settle` first. Leave out an ask or follow-up whose job is not open today or already has a referral, and say why.
   - Contacts with `channel: "email"` are never in the automatic batch. Their asks and follow-ups go in the list the user approves in chat, and are created as email drafts per "Email" in Outreach-Rules.md. After the user sends or approves sending, update the contact exactly as for a LinkedIn message.
   - Connected contacts with `askApproved: true`. Check that each one's `attachment` file exists under `<root>`. If it doesn't, leave that person out and say why.
   - Asked contacts with a non-empty `followupMessage`, an empty `dateFollowedUp`, and an empty `dateReplied`.
   - Contacts on LinkedIn with `replyApproved: true`, a non-empty `replyMessage` and no `replyDone`, and any reply the user has approved in this conversation.
2. **Show the user the batch:** recipient · company · ask, follow-up or reply · the full text · the attachment file name. Ask: "Send these N messages?" Wait for an explicit yes. A yes covers only this list.
3. **Send each message:**
   1. Open their profile and click **Message**. If there's no Message button, skip them per the rules.
   2. Type the exact approved text.
   3. For an ask, attach the PDF: use the paperclip control, and upload `<root>/<attachment>` (absolute path) with the browser's file-upload tool (open the full-page compose, `/messaging/compose/?…`, not the profile pop-up chat, whose file input the upload tool can't reach). Wait until it shows as attached.
   4. Click **Send** and confirm the message appears in the thread.
   5. Update the contact straight away:
      - ask: `{"stage": "Asked"}`, which stamps `dateAsked`;
      - follow-up: `{"dateFollowedUp": "<today>"}`;
      - reply: `{"replyMessage": "", "replyApproved": false, "replyDone": true}`, and append `[reply sent YYYY-MM-DD: <one-line summary>]` to `notes`.
   6. Wait a random `minSendGapSeconds`–`maxSendGapSeconds` before the next one.
4. **Report** what was sent and what was skipped (and why), then commit per Outreach-Rules.md.
