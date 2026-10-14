#!/usr/bin/env python3
"""data.json access for the skills. Never hand-edit data.json.

The jobs counterpart of contacts_store.py, with the same guarantees: writes go
through the running tracker server when it is up, otherwise straight to the
file with the server's backups; a write is refused if the jobs changed since
this tool loaded them (an open tracker tab saved, or another run wrote first),
in which case the whole load-apply-save is retried once and then fails hard
rather than overwrite someone else's save.

  list   [--status S[,S…]] [--company NAME] [--id ID] [--full] [--fields a,b,…]   matching jobs as JSON
  find   --company NAME --role ROLE [--url URL]                  jobs that are the same posting
  add                                                            JSON array of new jobs on stdin
  update ID                                                      JSON object of fields on stdin
  move   ID STATUS                                               change status (dates are stamped for you)
  note   ID TEXT                                                 append to the job's notes
  posting ID open|closed                                         record that the posting was checked today
  list --check-due                                               jobs whose posting needs checking now

`list` leaves out the long document fields (resumeMD, coverMD, referralMD,
prepMD) unless --full or --id is given; --fields keeps only the named ones. There is no delete: close a job with
`move`, and cleanup.py archives it later.

Nobody works on a posting that has stopped taking applications. `posting ID closed`
moves a job that is not applied for yet (Researching, Screening, To Apply) to
Won't Apply; for an application already sent it only records the date. A job in
To Apply is due for a check every day, one in Screening or Researching every
CHECK_SCREENING_DAYS days.

The rules here (statuses, ids, date stamps) must match the page's own in
index.html (ALL_STATUSES, uid, stampApplied, stampClosed), which it keeps so
that the tracker also works with no server.

Env: JOBTRACKER_PORT (default 8787), OUTREACH_TODAY (YYYY-MM-DD, tests only).
"""
import argparse
import json
import os
import random
import re
import sys
import time
import urllib.error
import urllib.request
from datetime import date, timedelta

import contacts_store  # same folder: server detection, login headers
import storage

STATUSES = ["Researching", "Screening", "To Apply", "Applied", "Phone Screen", "Interviewing", "Take-home",
            "Final Round", "Offer", "Accepted", "Rejected", "Withdrawn", "Ghosted", "Won't Apply"]
CLOSED = ("Rejected", "Withdrawn", "Ghosted", "Won't Apply")
TIERS = ("", "A", "B", "C")
ARRANGEMENTS = ("", "Remote", "Hybrid", "Onsite")
DATE_FIELDS = ("dateAdded", "dateApplied", "nextFollowup", "lastContact", "dateClosed", "postingChecked",
               "postingClosed")
# The page escapes these as text, so anything but a string breaks the card.
TEXT_FIELDS = ("company", "role", "location", "url", "salary", "excitement", "fitScore", "notes", "source",
               "contact", "resumeVersion", "coverLetter", "referredBy")
FIT_PARTS = ("role", "skills", "level", "pay", "location", "posting")
LONG_FIELDS = ("resumeMD", "coverMD", "referralMD", "prepMD")
# What a new card starts with, so every card has the fields the page expects.
BLANK = {"company": "", "role": "", "location": "", "arrangement": "", "url": "", "dateAdded": "",
         "dateApplied": "", "status": "Screening", "resumeVersion": "", "coverLetter": "", "contact": "",
         "lastContact": "", "nextFollowup": "", "salary": "", "excitement": "", "fitScore": "", "notes": "",
         "source": ""}
DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")
MAX_SAVE_ATTEMPTS = 2
# Not applied for yet: a closed posting ends these. Later stages keep going.
BEFORE_APPLYING = ("Researching", "Screening", "To Apply")
CHECK_SCREENING_DAYS = 7


class ConflictError(RuntimeError):
    """data.json changed underneath us (stale revision) between load and save."""


# ---- reading and writing ---------------------------------------------------
def load_jobs():
    """Return (jobs, revision). Pass `revision` back to save_jobs."""
    if contacts_store.server_up():
        req = urllib.request.Request(contacts_store.BASE_URL + "/data.json", headers=contacts_store._auth_headers())
        with urllib.request.urlopen(req, timeout=5) as r:
            return json.load(r), r.headers.get("X-Data-Revision", "")
    return storage.read_json(storage.DATA_FILE, []), storage.file_revision(storage.DATA_FILE)


def save_jobs(jobs, base_revision):
    """Write `jobs`, but only if `base_revision` still matches. Raises ConflictError otherwise."""
    body = json.dumps(jobs, indent=2, ensure_ascii=False)
    if contacts_store.server_up():
        req = urllib.request.Request(contacts_store.BASE_URL + "/save", data=body.encode("utf-8"), method="POST",
                                     headers={"Content-Type": "application/json", "X-Base-Revision": base_revision,
                                              **contacts_store._auth_headers()})
        try:
            with urllib.request.urlopen(req, timeout=10) as r:
                json.load(r)
        except urllib.error.HTTPError as e:
            payload = json.loads(e.read() or b"{}")
            message = payload.get("error", str(e))
            if e.code == 409:
                raise ConflictError(message) from e
            raise RuntimeError(message) from e
        return "server"
    if storage.file_revision(storage.DATA_FILE) != base_revision:
        raise ConflictError("jobs changed while updating; re-run the command")
    storage.rotate_backup(storage.DATA_FILE, "data")
    storage.atomic_write(storage.DATA_FILE, body)
    return "file"


# ---- rules -----------------------------------------------------------------
def new_id(taken):
    """Same shape as the page's uid(): app-<base36 milliseconds><4 random>."""
    while True:
        ms, out = int(time.time() * 1000), ""
        while ms:
            ms, r = divmod(ms, 36)
            out = contacts_store.BASE36[r] + out
        jid = "app-" + out + "".join(random.choice(contacts_store.BASE36) for _ in range(4))
        if jid not in taken:
            return jid


def key(text):
    return str(text or "").strip().lower()


def url_key(url):
    """A posting's address without its query, fragment or trailing slash."""
    return re.sub(r"[?#].*$", "", key(url)).rstrip("/")


def find_same(jobs, company, role, url=""):
    """Jobs that are the same posting: same company and role, or the same link."""
    link = url_key(url)
    return [j for j in jobs
            if (key(j.get("company")) == key(company) and key(j.get("role")) == key(role))
            or (link and url_key(j.get("url")) == link)]


def clean_fields(fields):
    """Check the values being written and return them in the form the page expects.
    Only what is given is checked, so an old card with an odd value never blocks a save."""
    out = dict(fields)
    if "fitScore" in out and isinstance(out["fitScore"], (int, float)) and not isinstance(out["fitScore"], bool):
        out["fitScore"] = str(int(out["fitScore"]))
    if "excitement" in out and isinstance(out["excitement"], int) and not isinstance(out["excitement"], bool):
        out["excitement"] = str(out["excitement"])
    for name in TEXT_FIELDS + DATE_FIELDS:
        if name in out and not isinstance(out[name], str):
            raise ValueError(f"{name} must be text, got {type(out[name]).__name__}")
    if "company" in out and not out["company"].strip():
        raise ValueError("company is required")
    if "status" in out and out["status"] not in STATUSES:
        raise ValueError(f"unknown status {out['status']!r}; use one of: {', '.join(STATUSES)}")
    if "tier" in out and out["tier"] not in TIERS:
        raise ValueError(f"tier must be A, B or C (or empty), got {out['tier']!r}")
    if "arrangement" in out and out["arrangement"] not in ARRANGEMENTS:
        raise ValueError(f"arrangement must be Remote, Hybrid or Onsite (or empty), got {out['arrangement']!r}")
    for name in DATE_FIELDS:
        if out.get(name) and not DATE_RE.match(out[name]):
            raise ValueError(f"{name} must look like 2026-01-31, got {out[name]!r}")
    if out.get("fitScore"):
        if not out["fitScore"].isdigit() or not 0 <= int(out["fitScore"]) <= 100:
            raise ValueError(f"fitScore must be a whole number from 0 to 100, got {out['fitScore']!r}")
    if out.get("excitement") and out["excitement"] not in ("1", "2", "3", "4", "5"):
        raise ValueError(f"excitement must be 1 to 5 (or empty), got {out['excitement']!r}")
    if "fitBreakdown" in out:
        parts = out["fitBreakdown"]
        if not isinstance(parts, dict):
            raise ValueError("fitBreakdown must be an object")
        for name, value in parts.items():
            if name not in FIT_PARTS:
                raise ValueError(f"fitBreakdown has no part {name!r}; the parts are: {', '.join(FIT_PARTS)}")
            if isinstance(value, bool) or not isinstance(value, (int, float)) or not 0 <= value <= 5:
                raise ValueError(f"fitBreakdown.{name} must be a number from 0 to 5, got {value!r}")
    return out


def stamp(job, today):
    """Dates that follow from the status. Must match stampApplied and stampClosed in index.html."""
    if job.get("status") == "Applied":
        if not job.get("dateApplied"):
            job["dateApplied"] = today
        if not job.get("nextFollowup"):
            job["nextFollowup"] = (date.fromisoformat(job["dateApplied"]) + timedelta(days=7)).isoformat()
    if job.get("status") in CLOSED:
        if not job.get("dateClosed"):
            job["dateClosed"] = today
    else:
        job.pop("dateClosed", None)
        job.pop("autoClosed", None)


def add_jobs(jobs, new, today):
    """Append new jobs. A job already on the board (same company and role, or same link) is skipped."""
    added, skipped = [], []
    taken = {j.get("id") for j in jobs}
    for raw in new:
        if not isinstance(raw, dict):
            raise ValueError("every job must be an object")
        if "id" in raw:
            raise ValueError("leave id out; the tool assigns it")
        fields = clean_fields(raw)
        if not key(fields.get("company")):
            raise ValueError("company is required")
        same = find_same(jobs, fields.get("company"), fields.get("role"), fields.get("url"))
        if same:
            skipped.append({"company": fields.get("company"), "role": fields.get("role", ""),
                            "reason": "already on the board as " + same[0].get("id", "?"),
                            "status": same[0].get("status", "")})
            continue
        job = dict(BLANK)
        job.update(fields)
        job["id"] = new_id(taken)
        taken.add(job["id"])
        if not job["dateAdded"]:
            job["dateAdded"] = today
        stamp(job, today)
        jobs.append(job)
        added.append(job)
    return added, skipped


def update_job(jobs, jid, fields, today):
    """Change only the given fields of one job; every other field is kept."""
    job = next((j for j in jobs if j.get("id") == jid), None)
    if job is None:
        raise KeyError(f"no job with id {jid}")
    if "id" in fields and fields["id"] != jid:
        raise ValueError("a job's id cannot be changed")
    job.update(clean_fields(fields))
    if "status" in fields:
        stamp(job, today)
    return job


def append_note(jobs, jid, text):
    job = next((j for j in jobs if j.get("id") == jid), None)
    if job is None:
        raise KeyError(f"no job with id {jid}")
    text = str(text or "").strip()
    if not text:
        raise ValueError("the note is empty")
    job["notes"] = (str(job.get("notes") or "").rstrip() + " " + text).strip()
    return job


def check_due(jobs, today):
    """Jobs not applied for yet whose posting was not checked recently enough."""
    out = []
    for j in jobs:
        status, checked = j.get("status"), j.get("postingChecked") or ""
        if status not in BEFORE_APPLYING:
            continue
        if status == "To Apply":
            due = checked < today
        else:
            due = not checked or (date.fromisoformat(today) - date.fromisoformat(checked)).days >= CHECK_SCREENING_DAYS
        if due:
            out.append(j)
    return out


def record_posting(jobs, jid, state, today):
    """The posting was checked today. A closed one ends a job that is not applied for yet."""
    job = next((j for j in jobs if j.get("id") == jid), None)
    if job is None:
        raise KeyError(f"no job with id {jid}")
    if state not in ("open", "closed"):
        raise ValueError("the posting is either open or closed")
    job["postingChecked"] = today
    if state == "open":
        job.pop("postingClosed", None)
        return job
    if not job.get("postingClosed"):
        job["postingClosed"] = today
        if job.get("status") in BEFORE_APPLYING:
            job["status"] = "Won't Apply"
            stamp(job, today)
            append_note(jobs, jid, f"[posting closed {today}: no longer accepting applications]")
        else:
            append_note(jobs, jid, f"[posting closed {today}]")
    return job


def brief(job):
    return {k: v for k, v in job.items() if k not in LONG_FIELDS}


# ---- commands --------------------------------------------------------------
def run(change):
    """Load, apply `change(jobs)`, save — retried once on a revision conflict."""
    for attempt in range(MAX_SAVE_ATTEMPTS):
        jobs, revision = load_jobs()
        result, changed = change(jobs)
        if not changed:
            return dict(result, savedVia="unchanged")
        try:
            saved_via = save_jobs(jobs, revision)
        except ConflictError:
            if attempt < MAX_SAVE_ATTEMPTS - 1:
                continue
            raise RuntimeError("jobs changed while updating; re-run the command")
        return dict(result, savedVia=saved_via)


def main(argv=None):
    ap = argparse.ArgumentParser(description="data.json helper for the skills")
    sub = ap.add_subparsers(dest="cmd", required=True)
    ls = sub.add_parser("list")
    ls.add_argument("--status", help="one status, or several separated by commas")
    ls.add_argument("--company")
    ls.add_argument("--id")
    ls.add_argument("--full", action="store_true", help="include the long document fields")
    ls.add_argument("--fields", help="only these fields, separated by commas (id is always included)")
    ls.add_argument("--check-due", action="store_true", help="only jobs whose posting needs checking now")
    fd = sub.add_parser("find")
    fd.add_argument("--company", required=True)
    fd.add_argument("--role", required=True)
    fd.add_argument("--url", default="")
    sub.add_parser("add")
    up = sub.add_parser("update")
    up.add_argument("id")
    mv = sub.add_parser("move")
    mv.add_argument("id")
    mv.add_argument("status")
    nt = sub.add_parser("note")
    nt.add_argument("id")
    nt.add_argument("text")
    pg = sub.add_parser("posting")
    pg.add_argument("id")
    pg.add_argument("state", choices=("open", "closed"))
    args = ap.parse_args(argv)

    today = os.environ.get("OUTREACH_TODAY") or date.today().isoformat()
    try:
        if args.cmd == "list":
            jobs, _ = load_jobs()
            wanted = [s.strip() for s in (args.status or "").split(",") if s.strip()]
            for s in wanted:
                if s not in STATUSES:
                    raise ValueError(f"unknown status {s!r}; use one of: {', '.join(STATUSES)}")
            out = [j for j in jobs
                   if (not wanted or j.get("status") in wanted)
                   and (not args.company or key(j.get("company")) == key(args.company))
                   and (not args.id or j.get("id") == args.id)]
            if args.check_due:
                due = {j.get("id") for j in check_due(jobs, today)}
                out = [j for j in out if j.get("id") in due]
            if not (args.full or args.id):
                out = [brief(j) for j in out]
            if args.fields:
                names = ["id"] + [f.strip() for f in args.fields.split(",") if f.strip() and f.strip() != "id"]
                out = [{k: j[k] for k in names if k in j} for j in out]
        elif args.cmd == "find":
            jobs, _ = load_jobs()
            out = [brief(j) for j in find_same(jobs, args.company, args.role, args.url)]
        elif args.cmd == "add":
            payload = json.load(sys.stdin)
            if not isinstance(payload, list):
                raise TypeError("add stdin must be a JSON array")

            def change(jobs):
                added, skipped = add_jobs(jobs, payload, today)
                return {"added": [brief(j) for j in added], "skipped": skipped}, bool(added)
            out = run(change)
        elif args.cmd == "update":
            payload = json.load(sys.stdin)
            if not isinstance(payload, dict):
                raise TypeError("update stdin must be a JSON object")
            out = run(lambda jobs: ({"job": brief(update_job(jobs, args.id, payload, today))}, True))
        elif args.cmd == "move":
            out = run(lambda jobs: ({"job": brief(update_job(jobs, args.id, {"status": args.status}, today))}, True))
        elif args.cmd == "posting":
            out = run(lambda jobs: ({"job": brief(record_posting(jobs, args.id, args.state, today))}, True))
        else:
            out = run(lambda jobs: ({"job": brief(append_note(jobs, args.id, args.text))}, True))
    except (KeyError, ValueError, RuntimeError, OSError, TypeError) as e:
        print(f"error: {e.args[0] if isinstance(e, KeyError) and e.args else e}", file=sys.stderr)
        return 1
    json.dump(out, sys.stdout, indent=2, ensure_ascii=False)
    print()
    return 0


if __name__ == "__main__":
    sys.exit(main())
