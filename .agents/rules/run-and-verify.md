---
description: How to run the LaunchPad tracker and check a change without touching real data
alwaysApply: true
---

# LaunchPad Run And Verify Rules

LaunchPad is a uv-managed Python project with no dependencies and no build step.

## Running

- `uv run tracker.py` from the repo root starts the tracker on http://localhost:8787. Without uv, `cd "LaunchPad App" && python3 server.py` does the same.
- `uv run Demo/demo_people.py` serves a throwaway tracker with demo people on port 8799 (`--port` to change it). It writes to a temporary folder and ignores `TRACKER_*` environment variables.
- `python3 Site/build.py --serve 8801` serves the landing page with its live demo; the demo there is the real app answered by `Site/demo-shim.js`, with no server and no data folder.
- `--host`/`HOST` and `PORT` control where the server listens. It refuses to listen beyond localhost unless `TRACKER_PASSWORD` is set.

## Checking A Change

- Never test against the real `Data/`. Point a test server at a scratch folder with `TRACKER_DATA_DIR=<folder>` and a spare port, or use the demo.
- Unset `TRACKER_GITHUB_TOKEN` and `TRACKER_GITHUB_REPO` for local test servers so nothing is committed.
- Stop every server you started when you are done. Do not stop one you did not start.
- For a server change, exercise the routes you touched with `curl`: `/health`, `/data.json`, `/save` (including a stale `X-Base-Revision`, which must return 409) and `/contacts.json`.
- For a page change, load it in a browser, check the Today, Jobs, People, Companies, Interviews and Insights screens, open a job panel and a person panel, look at a phone width and at dark mode, and reload once to confirm the view and data persist. App files are served with `Cache-Control: no-cache`, so a normal reload picks up edits.
- Check syntax on the oldest supported interpreter when you can: `/usr/bin/python3 -m py_compile "LaunchPad App"/*.py`.

## Useful Commands

```bash
uv run tracker.py
uv run Demo/demo_people.py --port 8799
curl -s http://localhost:8787/health
uv run "LaunchPad App/contacts_store.py" list
python3 "LaunchPad App/preflight.py"
python3 .agents/scripts/validate-agent-assets.py --mode adapters
```
