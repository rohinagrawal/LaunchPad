# Referral Playbook

Your own rules for referral outreach. The daily routine and the outreach skills read this file first, and what it says wins over their defaults. Edit it whenever your search changes.

How the mechanics work (LinkedIn safety, limits, how drafts are stored) is in `.agents/skills/referral-outreach/Outreach-Rules.md`; this file only holds your choices.

## 1. Which roles to keep

Search in this order: [e.g. hiring posts at target companies, then target companies by priority, then target titles anywhere that fits].

| Filter | Your rule |
|---|---|
| Fit | [e.g. 80+ is recommended; 65–79 is kept with the gap named; lower is dropped] |
| Pay | [your floor from Job-Thesis.md, and what you accept below it, if anything] |
| Level | [the levels that count as right for you, and what is over or under] |
| Experience asked | [e.g. up to N years is fine; more is a flagged stretch] |
| Location | [your order of preference] |

## 2. Whom to ask, in order

Rank by how likely the person is to refer you, not by how many there are.

1. [People you are already connected to at the company]
2. [Former colleagues: name the employers]
3. [People who posted that they are hiring or referring]
4. [Engineers or peers on the team the role is in]
5. [Fellow alumni: name the schools]
6. [Recruiters]

People per company: [e.g. up to 5]. Skip: [e.g. accounts with very large followings].

## 3. The ask

Templates are in `Referral/Templates/`. Each ask has the job link, one line on who you are, [two] points tying a need in the job description to work you actually did, and a direct ask with your resume attached. Length: [e.g. 90–120 words].

Style rules of your own: [e.g. "no statistics", "always name the team", or leave empty].

When to send: [best days and hours in your time zone].

## 4. Follow up

One follow-up after [N] days without a reply, then close the person out. Never a second follow-up.

## 5. What goes out without asking you again

- Connection requests: [e.g. "to people at companies whose job I approved" or "only people I approve one by one"].
- Messages: [e.g. "only the ones I tick Approve ask on" or "Autopilot after N hours unless I hold one"].
- Replies to people who answered, and emails: always wait for my yes.

## 6. Cleanup

`LaunchPad App/cleanup.py` archives stale and closed items and never deletes. Change its thresholds here if you want different ones: [or "defaults are fine"].
