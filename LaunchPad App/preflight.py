#!/usr/bin/env python3
"""Check that the LaunchPad folder is ready for a run. Reads only; changes nothing.

    python3 "LaunchPad App/preflight.py"          # one line per check, exit 1 on any FAIL
    python3 "LaunchPad App/preflight.py" --json   # the same report as JSON

FAIL means a run should stop (broken data, missing thesis or resume). WARN means it
can go on, with the warning repeated in the run report. What this can't see (the
browser being signed in, an email connector) is checked by the preflight skill.

Env: JOBTRACKER_PORT (default 8787).
"""
import argparse
import json
import os
import subprocess
import sys
import urllib.request

import contacts_store  # same folder: the link check used when messages are saved
import jobs_store  # same folder: the statuses the tracker knows
import server  # same folder: the tracker's own validation
import storage

PORT = os.environ.get("JOBTRACKER_PORT", "8787")
LIMIT_KEYS = ("maxRequestsPerDay", "maxRequestsPerWeek", "noteBudgetPerMonth")
REQUIRED_DOCS = ("Job-Thesis.md", os.path.join("Resume", "Master-Resume.md"))
OPTIONAL_DOCS = (os.path.join("Resume", "Answer-Bank.md"), os.path.join("Referral", "Referral-Note.md"),
                 os.path.join("Referral", "Templates"))


class Report:
    def __init__(self):
        self.rows = []

    def add(self, level, check, message):
        self.rows.append({"level": level, "check": check, "message": message})

    def ok(self, check, message):
        self.add("OK", check, message)

    def warn(self, check, message):
        self.add("WARN", check, message)

    def fail(self, check, message):
        self.add("FAIL", check, message)

    def failed(self):
        return any(r["level"] == "FAIL" for r in self.rows)


def shown_path(path):
    """Relative to the LaunchPad folder when it's inside it, otherwise the full path."""
    rel = os.path.relpath(path, storage.ROOT_DIR)
    return path if rel.startswith("..") else rel


def load_json(path):
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def check_jobs(rep):
    """Return the jobs list, or None when it can't be used."""
    path = storage.DATA_FILE
    shown = shown_path(path)
    if not os.path.exists(path):
        rep.fail("jobs", f"{shown} is missing")
        return None
    try:
        jobs = load_json(path)
    except (OSError, ValueError) as e:
        rep.fail("jobs", f"{shown} is not valid JSON: {e}")
        return None
    if not isinstance(jobs, list) or not all(isinstance(j, dict) for j in jobs):
        rep.fail("jobs", f"{shown} must be a list of job objects")
        return None
    ids = [j.get("id") for j in jobs if j.get("id")]
    dupes = sorted({i for i in ids if ids.count(i) > 1})
    if dupes:
        rep.warn("jobs", f"{len(dupes)} job id(s) used more than once: {', '.join(dupes[:5])}")
    odd = sorted({str(j.get("status")) for j in jobs if j.get("status") not in jobs_store.STATUSES})
    if odd:
        rep.warn("jobs", f"{sum(1 for j in jobs if j.get('status') not in jobs_store.STATUSES)} job(s) have a status "
                         f"the tracker does not know ({', '.join(odd[:5])}); they show under Screening")
    rep.ok("jobs", f"{shown}: {len(jobs)} jobs")
    return jobs


def check_people(rep, jobs, root):
    path = storage.CONTACTS_FILE
    shown = shown_path(path)
    if not os.path.exists(path):
        rep.ok("people", f"{shown} not created yet (no people)")
        return
    try:
        people = server.validate_contacts(load_json(path))
    except (OSError, ValueError) as e:
        rep.fail("people", f"{shown}: {e}")
        return
    rep.ok("people", f"{shown}: {len(people)} people")
    if jobs is not None:
        job_ids = {j.get("id") for j in jobs}
        orphans = [c["name"] for c in people
                   if c.get("stage") not in ("Declined", "No response", "Skipped")
                   and c.get("appIds") and not any(a in job_ids for a in c["appIds"])]
        if orphans:
            rep.warn("people", f"{len(orphans)} active people point only at jobs that are no longer "
                               f"on the board: {', '.join(orphans[:5])}")
    # Unsent drafts whose link has punctuation stuck to it (it would not open once sent).
    unsent = [(c, "askMessage") for c in people if c.get("stage") == "Connected"]
    unsent += [(c, "followupMessage") for c in people
               if c.get("stage") == "Asked" and not c.get("dateFollowedUp") and not c.get("dateReplied")]
    broken = sorted({c["name"] for c, key in unsent if contacts_store.broken_links(c.get(key))})
    if broken:
        rep.warn("people", f"{len(broken)} unsent message(s) have a link that would not open "
                           f"(punctuation attached): {', '.join(broken[:5])}")
    missing = [c["name"] for c in people
               if c.get("stage") == "Connected" and c.get("askApproved")
               and not (c.get("attachment") and os.path.exists(os.path.join(root, c["attachment"])))]
    if missing:
        rep.warn("people", f"{len(missing)} approved ask(s) have no resume file to attach: "
                           f"{', '.join(missing[:5])}")


def check_autopilot(rep):
    path = server.AUTOPILOT_FILE
    if not os.path.exists(path):
        rep.ok("autopilot", "not set (off)")
        return
    try:
        ap = server.validate_autopilot(load_json(path))
    except (OSError, ValueError) as e:
        rep.fail("autopilot", f"{shown_path(path)}: {e}")
        return
    on = [k for k in ("jobs", "messages") if ap[k]["enabled"]]
    rep.ok("autopilot", "on for " + " and ".join(on) if on else "off")


def check_settings(rep, root):
    path = storage.settings_file()
    if not os.path.exists(path):
        rep.ok("settings", "outreach-config.json not present (defaults apply)")
        return
    try:
        cfg = load_json(path)
        if not isinstance(cfg, dict):
            raise ValueError("expected a JSON object")
    except (OSError, ValueError) as e:
        rep.fail("settings", f"{shown_path(path)}: {e}")
        return
    rep.ok("settings", f"{shown_path(path)} is valid")
    for key in LIMIT_KEYS:
        value = cfg.get(key)
        if value is not None and (isinstance(value, bool) or not isinstance(value, int) or value < 0):
            rep.warn("settings", f"{key} should be a whole number or null, not {value!r}")
    base = cfg.get("baseResumePath") or ""
    if base and not os.path.exists(os.path.join(root, base)):
        rep.warn("settings", f"baseResumePath points at a missing file: {base}")
    elif not base and cfg.get("defaultAttachment") == "base":
        rep.warn("settings", "defaultAttachment is \"base\" but baseResumePath is empty")


def check_documents(rep, root):
    for rel in REQUIRED_DOCS:
        if os.path.exists(os.path.join(root, rel)):
            rep.ok("documents", rel)
        else:
            rep.fail("documents", f"{rel} is missing (run the setup-launchpad skill)")
    absent = [rel for rel in OPTIONAL_DOCS if not os.path.exists(os.path.join(root, rel))]
    if absent:
        rep.warn("documents", "not set up yet: " + ", ".join(absent))


def check_server(rep):
    try:
        with urllib.request.urlopen(f"http://127.0.0.1:{PORT}/health", timeout=2) as r:
            health = json.load(r)
    except (OSError, ValueError):
        rep.warn("server", f"tracker server is not running on port {PORT}; writes go straight to the files")
        return
    if health.get("ok") is True:
        sync = health.get("sync")
        rep.ok("server", f"tracker server is running on port {PORT}" + (f" (sync: {sync})" if sync else ""))
    else:
        rep.warn("server", f"port {PORT} answered, but not as the tracker server")


def git(root, *args):
    try:
        done = subprocess.run(["git", "-C", root, *args], stdout=subprocess.PIPE,
                              stderr=subprocess.DEVNULL, universal_newlines=True, timeout=10)
    except (OSError, subprocess.SubprocessError):
        return None
    return done.stdout if done.returncode == 0 else None


def check_git(rep, root):
    if git(root, "rev-parse", "--is-inside-work-tree") is None:
        rep.ok("git", "not a git repository (optional)")
        return
    branch = (git(root, "rev-parse", "--abbrev-ref", "HEAD") or "").strip() or "?"
    status = git(root, "status", "--porcelain") or ""
    changed = [line[3:].strip('"') for line in status.splitlines() if line.strip()]
    other = [p for p in changed if not p.startswith("Data/")]
    if other:
        rep.warn("git", f"on {branch}; {len(other)} uncommitted change(s) outside Data/: "
                        f"{', '.join(other[:4])}{'…' if len(other) > 4 else ''}")
    else:
        rep.ok("git", f"on {branch}; no uncommitted code or document changes")
    behind = (git(root, "rev-list", "--count", "HEAD..@{u}") or "").strip()
    if behind.isdigit() and int(behind) > 0:
        rep.warn("git", f"{behind} commit(s) behind the remote as last fetched; pull before editing Data/")


def run(root):
    rep = Report()
    jobs = check_jobs(rep)
    check_people(rep, jobs, root)
    check_autopilot(rep)
    check_settings(rep, root)
    check_documents(rep, root)
    check_server(rep)
    check_git(rep, root)
    return rep


def main(argv=None):
    ap = argparse.ArgumentParser(description="Readiness check for the LaunchPad folder (read-only)")
    ap.add_argument("--json", action="store_true", help="print the report as JSON")
    ap.add_argument("--root", default=storage.ROOT_DIR, help="LaunchPad folder (default: this repo)")
    args = ap.parse_args(argv)
    rep = run(os.path.abspath(args.root))
    if args.json:
        json.dump({"ok": not rep.failed(), "checks": rep.rows}, sys.stdout, indent=2, ensure_ascii=False)
        print()
    else:
        for r in rep.rows:
            print(f"{r['level']:<4} {r['check']:<10} {r['message']}")
        counts = {lv: sum(r["level"] == lv for r in rep.rows) for lv in ("FAIL", "WARN")}
        print(f"\n{'NOT READY' if rep.failed() else 'READY'}: {counts['FAIL']} failed, {counts['WARN']} warning(s)")
    return 1 if rep.failed() else 0


if __name__ == "__main__":
    sys.exit(main())
