#!/usr/bin/env python3
"""Keep the tracker and the repo tidy: archive, never delete.

Run from anywhere (it finds the LaunchPad folder from its own location):

    python3 "LaunchPad App/cleanup.py"            # apply the rules, print a report
    python3 "LaunchPad App/cleanup.py" --dry-run  # only report what would change

Rules (numbers are the constants below):
  Tracker
   1. Screening/Researching for STALE_SCREENING_DAYS+ days      -> Won't Apply  [auto-closed …]
   2. Applied with the follow-up date passed by GHOST_DAYS+     -> Ghosted      [auto-closed …]
   3. Closed cards (Rejected/Withdrawn/Ghosted/Won't Apply) CLOSED_KEEP_DAYS+ after
      closing leave data.json for Archive/tracker/jobs-<year>.json (dateClosed is stamped
      the first time a card is seen closed).
   4. People: Found/Queued people whose roles have all closed   -> Skipped [outreach: auto-skipped …];
      Declined/No response/Skipped people CLOSED_KEEP_DAYS+ after closing move to
      Archive/tracker/people-<year>.json. Requests pending STALE_INVITE_DAYS+ are reported
      as withdraw suggestions (withdrawing happens on LinkedIn, with the user's yes).
  Repo
   5. Job Listings/<Company> - <Role>.md of an archived card    -> Archive/listings/<YYYY-MM>/
      Job Listings/New-Openings-<date>.md older than REVIEW_KEEP_DAYS -> Archive/listings/<YYYY-MM>/
   6. Job Listings/seen-postings.json keeps only the last LEDGER_KEEP_DAYS days.
   7. Applications/<Company>/ once the company has no Screening/To Apply role and at least
      one applied/closed one -> Archive/applications/<Company>/.
Git branch cleanup is done by the routine (git fetch --prune; delete merged local branches).

Data is written the same way the app writes it: through the tracker server when it is
running (with its revision check), otherwise straight to the file with a rolling backup.
"""
import argparse
import datetime as dt
import json
import os
import re
import shutil
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import contacts_store  # noqa: E402  (same folder; also brings `server` and the data paths)
import jobs_store  # noqa: E402  (same folder: reads and writes data.json)
import storage  # noqa: E402

STALE_SCREENING_DAYS = 21
GHOST_DAYS = 30
CLOSED_KEEP_DAYS = 30
STALE_INVITE_DAYS = 21
REVIEW_KEEP_DAYS = 14
LEDGER_KEEP_DAYS = 45

ROOT = storage.ROOT_DIR
LISTINGS = os.path.join(ROOT, "Job Listings")
APPLICATIONS = os.path.join(ROOT, "Applications")
ARCHIVE = os.path.join(ROOT, "Archive")
CLOSED_JOB = {"Rejected", "Withdrawn", "Ghosted", "Won't Apply"}
ACTIVE_JOB = {"Screening", "Researching", "To Apply"}
LIVE_JOB = ACTIVE_JOB | {"Applied", "Phone Screen", "Interviewing", "Take-home", "Final Round", "Offer"}
CLOSED_PERSON = {"Declined", "No response", "Skipped"}


def days_ago(today, iso):
    try:
        return (today - dt.date.fromisoformat(iso[:10])).days
    except (TypeError, ValueError):
        return None


def key(s):
    return (s or "").strip().lower()


def listing_name(company, role):
    return f"{company} - {role}.md".replace("/", "-").replace(":", "-")


# ---------------------------------------------------------------- data I/O
def load_jobs():
    return jobs_store.load_jobs()


def save_jobs(apps, revision):
    try:
        jobs_store.save_jobs(apps, revision)
    except jobs_store.ConflictError:
        raise SystemExit("data.json changed while cleaning up; nothing was saved — re-run.")


def append_archive(name, items):
    if not items:
        return
    path = os.path.join(ARCHIVE, "tracker", name)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    existing = storage.read_json(path, [])
    have = {x.get("id") for x in existing}
    existing.extend(x for x in items if x.get("id") not in have)
    storage.atomic_write(path, json.dumps(existing, indent=2, ensure_ascii=False))


def move(src, dest_dir, dry):
    dest = os.path.join(dest_dir, os.path.basename(src))
    if not dry:
        os.makedirs(dest_dir, exist_ok=True)
        if os.path.isdir(src) and os.path.isdir(dest):
            for f in os.listdir(src):
                shutil.move(os.path.join(src, f), os.path.join(dest, f))
            os.rmdir(src)
        else:
            shutil.move(src, dest)
    return os.path.relpath(dest, ROOT)


# ---------------------------------------------------------------- rules
def clean_jobs(apps, today, report):
    iso = today.isoformat()
    month = iso[:7]
    keep, archived = [], []
    for a in apps:
        s = a.get("status")
        age = days_ago(today, a.get("dateAdded"))
        if s in ("Screening", "Researching") and age is not None and age >= STALE_SCREENING_DAYS:
            a["status"] = "Won't Apply"
            a["autoClosed"] = iso
            a["notes"] = (a.get("notes") or "") + f" [auto-closed {iso} — {age} days in Screening without a decision]"
            report["auto_closed"].append(f"{a['company']} — {a.get('role','')} (Screening {age}d → Won't Apply)")
        late = days_ago(today, a.get("nextFollowup"))
        if s == "Applied" and late is not None and late >= GHOST_DAYS:
            a["status"] = "Ghosted"
            a["autoClosed"] = iso
            a["notes"] = (a.get("notes") or "") + f" [auto-closed {iso} — no reply {late} days after the follow-up date]"
            report["auto_closed"].append(f"{a['company']} — {a.get('role','')} (no reply {late}d → Ghosted)")
        if a.get("status") in CLOSED_JOB:
            if not a.get("dateClosed"):
                a["dateClosed"] = iso
            if (days_ago(today, a["dateClosed"]) or 0) >= CLOSED_KEEP_DAYS:
                archived.append(a)
                report["jobs_archived"].append(f"{a['company']} — {a.get('role','')} ({a['status']} since {a['dateClosed']})")
                continue
        elif a.get("dateClosed"):
            a.pop("dateClosed", None)  # reopened by hand: it's live again
            a.pop("autoClosed", None)
        keep.append(a)
    return keep, archived, month


def clean_people(contacts, apps, archived_ids, today, report):
    iso = today.isoformat()
    live_ids = {a["id"] for a in apps if a.get("status") in LIVE_JOB}
    live_cos = {key(a.get("company")) for a in apps if a.get("status") in LIVE_JOB}
    keep, archived = [], []
    for c in contacts:
        if c.get("stage") in ("Found", "Queued"):
            ids = c.get("appIds") or []
            roles_live = any(i in live_ids for i in ids)
            if not roles_live and key(c.get("company")) not in live_cos:
                c["stage"] = "Skipped"
                c["notes"] = (c.get("notes") or "") + f" [outreach: auto-skipped {iso} — every linked role has closed]"
                report["people_skipped"].append(f"{c['name']} ({c.get('company','')})")
        if c.get("stage") == "Requested":
            age = days_ago(today, c.get("dateRequested"))
            if age is not None and age >= STALE_INVITE_DAYS:
                report["withdraw_suggestions"].append(f"{c['name']} ({c.get('company','')}) — pending {age} days")
        if c.get("stage") in CLOSED_PERSON:
            if not c.get("dateClosed"):
                c["dateClosed"] = iso
            if (days_ago(today, c["dateClosed"]) or 0) >= CLOSED_KEEP_DAYS:
                archived.append(c)
                report["people_archived"].append(f"{c['name']} ({c.get('company','')}, {c['stage']})")
                continue
        else:
            c.pop("dateClosed", None)
        if archived_ids and c.get("appIds"):
            c["appIds"] = [i for i in c["appIds"] if i not in archived_ids]
        keep.append(c)
    return keep, archived


def clean_files(apps, archived_jobs, today, dry, report):
    month = today.isoformat()[:7]
    dest = os.path.join(ARCHIVE, "listings", month)
    # 5a. listings of archived cards (only if no live card still uses the same file)
    live_names = {listing_name(a.get("company", ""), a.get("role", "")) for a in apps}
    for a in archived_jobs:
        name = listing_name(a.get("company", ""), a.get("role", ""))
        path = os.path.join(LISTINGS, name)
        if name not in live_names and os.path.isfile(path):
            report["files_archived"].append(move(path, dest, dry))
    # 5b. old daily reviews
    if os.path.isdir(LISTINGS):
        for f in sorted(os.listdir(LISTINGS)):
            m = re.fullmatch(r"New-Openings-(\d{4}-\d{2}-\d{2})\.md", f)
            if m and (days_ago(today, m.group(1)) or 0) > REVIEW_KEEP_DAYS:
                report["files_archived"].append(move(os.path.join(LISTINGS, f), dest, dry))
    # 6. ledger
    ledger_path = os.path.join(LISTINGS, "seen-postings.json")
    if os.path.isfile(ledger_path):
        ledger = storage.read_json(ledger_path, {})
        fresh = {k: v for k, v in ledger.items()
                 if (days_ago(today, (v or {}).get("date_seen")) or 0) <= LEDGER_KEEP_DAYS}
        dropped = len(ledger) - len(fresh)
        if dropped:
            report["ledger_pruned"] = dropped
            if not dry:
                storage.atomic_write(ledger_path, json.dumps(fresh, indent=2, ensure_ascii=False))
    # 7. application folders (also folds the old Applications/Archive/ into Archive/applications/)
    active = {key(a.get("company")).replace("/", "").replace(":", "") for a in apps if a.get("status") in ACTIVE_JOB}
    seen = {key(a.get("company")).replace("/", "").replace(":", "") for a in apps} | \
           {key(a.get("company")).replace("/", "").replace(":", "") for a in archived_jobs}
    app_dest = os.path.join(ARCHIVE, "applications")
    if os.path.isdir(APPLICATIONS):
        for d in sorted(os.listdir(APPLICATIONS)):
            p = os.path.join(APPLICATIONS, d)
            if not os.path.isdir(p):
                continue
            if d == "Archive":
                for old in sorted(os.listdir(p)):
                    report["files_archived"].append(move(os.path.join(p, old), app_dest, dry))
                if not dry:
                    os.rmdir(p)
                continue
            k = key(d).replace("/", "").replace(":", "")
            if k in seen and k not in active:
                report["files_archived"].append(move(p, app_dest, dry))


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--dry-run", action="store_true", help="report only; change nothing")
    ap.add_argument("--today", help="YYYY-MM-DD (testing)")
    args = ap.parse_args(argv)
    today = dt.date.fromisoformat(args.today) if args.today else dt.date.today()
    report = {k: [] for k in ("auto_closed", "jobs_archived", "people_skipped", "people_archived",
                              "withdraw_suggestions", "files_archived")}

    apps, jobs_rev = load_jobs()
    before_jobs = json.dumps(apps, sort_keys=True)
    apps, archived_jobs, _ = clean_jobs(apps, today, report)

    contacts, contacts_rev = contacts_store.load_contacts()
    before_people = json.dumps(contacts, sort_keys=True)
    contacts, archived_people = clean_people(contacts, apps, {a["id"] for a in archived_jobs}, today, report)

    clean_files(apps, archived_jobs, today, args.dry_run, report)

    if not args.dry_run:
        year = str(today.year)
        append_archive(f"jobs-{year}.json", archived_jobs)        # archive first, so nothing is ever lost
        append_archive(f"people-{year}.json", archived_people)
        if json.dumps(apps, sort_keys=True) != before_jobs:
            save_jobs(apps, jobs_rev)
        if json.dumps(contacts, sort_keys=True) != before_people:
            contacts_store.save_contacts(contacts, contacts_rev)

    title = "Cleanup (dry run)" if args.dry_run else "Cleanup"
    print(f"## {title} — {today.isoformat()}")
    labels = [("auto_closed", "Auto-closed cards (drag back to undo)"), ("jobs_archived", "Cards archived"),
              ("people_skipped", "People auto-skipped"), ("people_archived", "People archived"),
              ("files_archived", "Files archived"), ("withdraw_suggestions", "Withdraw suggestions (pending invites)")]
    any_change = False
    for k, label in labels:
        items = report[k]
        print(f"- {label}: {len(items)}")
        for x in items:
            print(f"    - {x}")
        any_change |= bool(items) and k != "withdraw_suggestions"
    if report.get("ledger_pruned"):
        any_change = True
        print(f"- seen-postings.json: pruned {report['ledger_pruned']} entries older than {LEDGER_KEEP_DAYS} days")
    if not any_change:
        print("- Nothing to clean up.")


if __name__ == "__main__":
    main()
