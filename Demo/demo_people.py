"""Serve a throwaway copy of the tracker with demo jobs and people, to try every tab.

  uv run Demo/demo_people.py               -> http://localhost:8799  (Ctrl-C to stop)
  uv run Demo/demo_people.py --port 8798   -> another port

Self-contained: needs only the Python standard library and the app in
"LaunchPad App/". Never touches the real Data/ folder, and never syncs to
GitHub (any TRACKER_* settings in your shell are dropped for the demo).
"""
import argparse
import json
import os
import shutil
import subprocess
import sys
import tempfile
from datetime import date, timedelta
from pathlib import Path

APP_SRC = Path(__file__).resolve().parent.parent / "LaunchPad App"
PORT = 8799
DEMO_RESUME = "Resume/Example - Resume.pdf"  # a made-up path; the demo has no real files


def demo_contacts(today):
    def ago(n):
        return (today - timedelta(days=n)).isoformat()

    blank = {"appIds": ["app-demo1"], "location": "Example City", "useNote": False, "connectNote": "",
             "askMessage": "", "askApproved": False, "followupMessage": "",
             "attachmentSource": "tailored", "attachment": "", "dateFound": ago(3), "dateQueued": "",
             "dateRequested": "", "dateConnected": "", "dateAsked": "", "dateFollowedUp": "",
             "dateReplied": "", "nextFollowup": "", "notes": ""}
    people = [
        {"id": "ct-demo1", "name": "Example Person One", "title": "Senior Software Engineer",
         "company": "Demo Corp", "relation": "ex-colleague", "likelihood": 88,
         "why": "Demo: you both worked at Example Co", "stage": "Found"},
        {"id": "ct-demo2", "name": "Example Person Two", "title": "Staff Engineer",
         "company": "Demo Corp", "relation": "same-org engineer", "likelihood": 55,
         "why": "Demo: backend org", "stage": "Found"},
        {"id": "ct-demo3", "name": "Example Person Three", "title": "Engineering Manager",
         "company": "Demo Corp", "relation": "hiring manager", "likelihood": 60,
         "why": "Demo: manages the team", "stage": "Queued", "useNote": True,
         "connectNote": "Hi, demo note text.", "dateQueued": ago(1)},
        {"id": "ct-demo4", "name": "Example Person Four", "title": "Recruiter",
         "company": "Demo Corp", "relation": "recruiter", "likelihood": 40,
         "why": "Demo: engineering TA", "stage": "Requested", "dateRequested": today.isoformat()},
        {"id": "ct-demo5", "name": "Example Person Five", "title": "Senior Engineer",
         "company": "Demo Corp", "relation": "alumni", "likelihood": 75,
         "why": "Demo: same college", "stage": "Connected", "dateRequested": ago(4),
         "dateConnected": ago(2), "askMessage": "Hi, demo ask text.",
         "attachmentSource": "base", "attachment": DEMO_RESUME},
        {"id": "ct-demo6", "name": "Example Person Six", "title": "Senior Engineer",
         "company": "Sample Labs", "relation": "same-org engineer", "likelihood": 50,
         "why": "Demo: waiting for an upload", "stage": "Connected", "appIds": [],
         "dateConnected": ago(1), "askMessage": "Hi, demo ask text.", "attachmentSource": "upload"},
        {"id": "ct-demo7", "name": "Example Person Seven", "title": "Engineer",
         "company": "Demo Corp", "relation": "same-org engineer", "likelihood": 45,
         "why": "Demo: asked a week ago", "stage": "Asked", "dateAsked": ago(7),
         "askMessage": "Hi, demo ask text.", "followupMessage": "Demo follow-up text."},
        {"id": "ct-demo8", "name": "Example Person Eight", "title": "Engineer",
         "company": "Demo Corp", "relation": "same-org engineer", "likelihood": 20,
         "why": "Demo: skipped", "stage": "Skipped"},
        # People at the roles further along, so the later stages and Insights have something in them.
        {"id": "ct-demo10", "name": "Example Person Ten", "title": "Senior Engineer",
         "company": "Fictional Systems", "relation": "ex-colleague", "likelihood": 80,
         "why": "Demo: referred you last week", "stage": "Referred", "appIds": ["app-demo5"],
         "dateRequested": ago(14), "dateConnected": ago(12), "dateAsked": ago(10), "dateReplied": ago(7),
         "askMessage": "Hi, demo ask text.", "askApproved": True},
        {"id": "ct-demo11", "name": "Example Person Eleven", "title": "Engineering Manager",
         "company": "Mock Works", "relation": "hiring manager", "likelihood": 65,
         "why": "Demo: replied and passed your resume on", "stage": "Referred", "appIds": ["app-demo6"],
         "dateRequested": ago(26), "dateConnected": ago(24), "dateAsked": ago(22), "dateReplied": ago(20),
         "askMessage": "Hi, demo ask text.", "askApproved": True},
        {"id": "ct-demo12", "name": "Example Person Twelve", "title": "Staff Engineer",
         "company": "Specimen AI", "relation": "alumni", "likelihood": 70,
         "why": "Demo: asked three days ago, no reply yet", "stage": "Asked", "appIds": ["app-demo7"],
         "dateRequested": ago(9), "dateConnected": ago(6), "dateAsked": ago(3),
         "askMessage": "Hi, demo ask text.", "askApproved": True},
    ]
    out = [dict(blank, linkedinUrl=f"https://www.linkedin.com/in/{p['id']}", **p) for p in people]
    # Someone reached by email instead of LinkedIn: no profile, starts ready to ask.
    out.append(dict(blank, id="ct-demo9", name="Example Person Nine", title="Recruiter", company="Demo Corp",
                    relation="recruiter", likelihood=40, why="Demo: gave an address in a hiring post",
                    stage="Connected", dateConnected=ago(1), linkedinUrl="", email="person.nine@example.com",
                    emailSource="Demo hiring post", channel="email", askMessage="Hi, demo ask text.",
                    attachmentSource="base", attachment=DEMO_RESUME))
    return out


def demo_jobs(today):
    def ago(n):
        return (today - timedelta(days=n)).isoformat()

    return [
        {"id": "app-demo1", "company": "Demo Corp", "role": "Senior Backend Engineer (demo)", "tier": "A",
         "status": "To Apply", "dateAdded": ago(4), "source": "LinkedIn", "fitScore": "86",
         "fitBreakdown": {"role": 5, "skills": 4, "level": 4, "pay": 3, "location": 5, "posting": 4},
         "notes": "Tier A · demo role with a fit breakdown · comp not stated"},
        {"id": "app-demo2", "company": "Sample Labs", "role": "Platform Engineer (demo)", "tier": "B",
         "status": "Screening", "dateAdded": ago(1), "source": "Company site", "fitScore": "71",
         "fitBreakdown": {"role": 4, "skills": 3, "level": 2, "pay": 4, "location": 3, "posting": 5},
         "notes": "Tier B · demo role · asks for more years than the resume shows"},
        {"id": "app-demo3", "company": "Example Co", "role": "Staff Engineer (demo)", "tier": "A",
         "status": "Phone Screen", "dateAdded": ago(20), "dateApplied": ago(12), "source": "Referral",
         "fitScore": "90", "notes": "Tier A · demo role with an interview prep document",
         "prepPath": "Interview Prep/Example Co - Staff Engineer (demo).md",
         "prepMD": "# Interview prep — Example Co, Staff Engineer (demo)\n> Recruiter screen · demo\n\n"
                   "## Snapshot\n- What they do: demo text\n\n## Likely questions\n- Demo question one\n",
         "interviews": [{"id": "iv-demo1", "date": ago(-2), "time": "15:00", "round": "Recruiter screen",
                         "with": "Example Recruiter", "notes": "Demo round", "outcome": ""}]},
        {"id": "app-demo4", "company": "Placeholder Inc", "role": "Backend Engineer (demo)", "tier": "C",
         "status": "Screening", "dateAdded": ago(2), "source": "Job board", "fitScore": "64",
         "fitBreakdown": {"role": 4, "skills": 3, "level": 3, "pay": 2, "location": 3, "posting": 4},
         "notes": "Tier C · demo role · pay below your floor"},
        {"id": "app-demo5", "company": "Fictional Systems", "role": "Senior Engineer (demo)", "tier": "B",
         "status": "Applied", "dateAdded": ago(16), "dateApplied": ago(5), "nextFollowup": ago(-2),
         "source": "LinkedIn", "fitScore": "82", "notes": "Tier B · demo role · applied with a referral"},
        {"id": "app-demo6", "company": "Mock Works", "role": "Infrastructure Engineer (demo)", "tier": "A",
         "status": "Interviewing", "dateAdded": ago(28), "dateApplied": ago(18), "source": "Referral",
         "fitScore": "84", "notes": "Tier A · demo role · one round passed, the loop is next",
         "interviews": [{"id": "iv-demo2", "date": ago(6), "time": "11:00", "round": "Technical",
                         "with": "Example Engineer", "notes": "Demo round", "outcome": "Passed"},
                        {"id": "iv-demo3", "date": ago(-4), "time": "10:00", "round": "Onsite / loop",
                         "with": "Example panel", "notes": "Demo round", "outcome": ""}]},
        {"id": "app-demo7", "company": "Specimen AI", "role": "Senior Backend Engineer (demo)", "tier": "A",
         "status": "Offer", "dateAdded": ago(40), "dateApplied": ago(30), "source": "Company site",
         "fitScore": "88", "notes": "Tier A · demo role · an offer waiting for your answer"},
        {"id": "app-demo8", "company": "Sandbox Health", "role": "Software Engineer (demo)", "tier": "C",
         "status": "Rejected", "dateAdded": ago(34), "dateApplied": ago(25), "dateClosed": ago(6),
         "source": "Job board", "fitScore": "61", "notes": "Tier C · demo role · closed after the first screen"},
    ]


def main():
    parser = argparse.ArgumentParser(description="Serve a throwaway tracker with demo people.")
    parser.add_argument("--port", type=int, default=PORT)
    port = parser.parse_args().port
    root = Path(tempfile.mkdtemp(prefix="people-demo-"))
    app = root / "LaunchPad App"
    shutil.copytree(APP_SRC, app, ignore=shutil.ignore_patterns(
        "backups", "data.json", "contacts.json", "__pycache__"))
    data = root / "Data"  # same layout as the real thing: data lives next to the app
    data.mkdir()
    today = date.today()
    (data / "data.json").write_text(json.dumps(demo_jobs(today), indent=2))
    # The demo's own settings (settings in the data folder win over the app's defaults).
    (data / "outreach-config.json").write_text(json.dumps(
        {"defaultAttachment": "base", "baseResumePath": DEMO_RESUME}, indent=2))
    (data / "contacts.json").write_text(json.dumps(demo_contacts(today), indent=2))
    env = {k: v for k, v in os.environ.items() if not k.startswith("TRACKER_")}
    print(f"Demo tracker in {root}\nOpen http://localhost:{port}  (Ctrl-C to stop)", flush=True)
    return subprocess.call([sys.executable, str(app / "server.py"), "--port", str(port)], env=env)


if __name__ == "__main__":
    sys.exit(main())
