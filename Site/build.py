#!/usr/bin/env python3
"""Build the landing page together with a live demo of the tracker.

    python3 Site/build.py <folder>        # write the site into <folder>
    python3 Site/build.py --serve 8801    # build into a temporary folder and serve it locally

The output is Site/ plus app/: a copy of the tracker's own page, scripts and styles with
demo-shim.js added, and demo-data.json holding the demo jobs and people from Demo/. Nothing
is duplicated in the repository, so the demo on the site is always the current app.
Standard library only.
"""
import argparse
import functools
import html
import http.server
import importlib.util
import json
import re
import shutil
import sys
import tempfile
from datetime import date
from pathlib import Path

SITE = Path(__file__).resolve().parent
ROOT = SITE.parent
APP = ROOT / "LaunchPad App"
APP_SUFFIXES = (".html", ".js", ".css")  # never the server's .py files or its settings
SHIM = "demo-shim.js"
# What the server answers for /autopilot.json before anyone has switched anything on.
AUTOPILOT_OFF = {"jobs": {"enabled": False, "minFit": 80, "tiers": ["A"]},
                 "messages": {"enabled": False, "holdHours": 12}}


def demo_module():
    spec = importlib.util.spec_from_file_location("demo_people", ROOT / "Demo" / "demo_people.py")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def add_faq_data(page):
    """Give search engines the FAQ as structured data, read from the page so it cannot drift."""
    html_text = page.read_text(encoding="utf-8")
    pairs = re.findall(r"<details[^>]*><summary>(.*?)</summary><p>(.*?)</p></details>", html_text, re.S)
    if not pairs:
        return
    plain = lambda text: html.unescape(re.sub(r"<[^>]+>", "", text)).strip()
    data = {"@context": "https://schema.org", "@type": "FAQPage", "mainEntity": [
        {"@type": "Question", "name": plain(q), "acceptedAnswer": {"@type": "Answer", "text": plain(a)}}
        for q, a in pairs]}
    block = '<script type="application/ld+json">' + json.dumps(data).replace("</", "<\\/") + "</script>\n</head>"
    page.write_text(html_text.replace("</head>", block, 1), encoding="utf-8")


def build(out):
    out = Path(out).resolve()
    if out in (ROOT, SITE) or out in ROOT.parents or out == APP:
        raise SystemExit(f"refusing to build into {out}")
    if out.exists():
        shutil.rmtree(out)
    shutil.copytree(SITE, out, ignore=shutil.ignore_patterns("build.py", SHIM, "__pycache__", ".DS_Store"))
    app = out / "app"
    app.mkdir()
    for src in sorted(APP.iterdir()):
        if src.suffix in APP_SUFFIXES:
            shutil.copy2(src, app / src.name)
    shutil.copy2(SITE / SHIM, app / SHIM)
    page = app / "index.html"
    app_html = page.read_text(encoding="utf-8")
    if "<head>" not in app_html:
        raise SystemExit("the tracker page has no <head> to add the demo shim to")
    # First in <head>, so the tracker's requests are answered before any of its scripts run.
    page.write_text(app_html.replace("<head>", f'<head>\n<script src="{SHIM}"></script>', 1), encoding="utf-8")
    add_faq_data(out / "index.html")
    demo, today = demo_module(), date.today()
    config = json.loads((APP / "outreach-config.json").read_text(encoding="utf-8"))
    config.update({"defaultAttachment": "base", "baseResumePath": demo.DEMO_RESUME})
    (app / "demo-data.json").write_text(json.dumps({
        "builtOn": today.isoformat(), "jobs": demo.demo_jobs(today), "contacts": demo.demo_contacts(today),
        "config": config, "autopilot": AUTOPILOT_OFF}), encoding="utf-8")
    return out


def serve(port):
    out = Path(tempfile.mkdtemp(prefix="launchpad-site-")) / "site"
    build(out)

    class Handler(http.server.SimpleHTTPRequestHandler):
        def do_GET(self):
            # Rebuild when a page is asked for, so an edit shows up on reload.
            if self.path.split("?")[0].endswith(("/", ".html")):
                build(out)
            super().do_GET()

        def end_headers(self):
            self.send_header("Cache-Control", "no-cache")
            super().end_headers()

    server = http.server.ThreadingHTTPServer(("127.0.0.1", port), functools.partial(Handler, directory=str(out)))
    print(f"Site with live demo on http://localhost:{port}  (Ctrl-C to stop)", flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        shutil.rmtree(out.parent, ignore_errors=True)


def main():
    parser = argparse.ArgumentParser(description="Build the LaunchPad landing page with its live demo.")
    parser.add_argument("out", nargs="?", help="folder to write the site into")
    parser.add_argument("--serve", type=int, metavar="PORT", help="build to a temporary folder and serve it")
    args = parser.parse_args()
    if args.serve:
        return serve(args.serve)
    if not args.out:
        parser.error("give an output folder or --serve PORT")
    print(f"Built {build(args.out)}")


if __name__ == "__main__":
    sys.exit(main())
