#!/usr/bin/env python3
"""Run the LaunchPad tracker's server from the repo root.

The app itself lives in `LaunchPad App/` (kept separate so it stays a
clean, self-contained folder you could hand someone on its own). This is
just a thin pointer so `uv run tracker.py` works from the repo root without
having to `cd` in first.
"""
import runpy
from pathlib import Path

SERVER = Path(__file__).parent / "LaunchPad App" / "server.py"

if __name__ == "__main__":
    runpy.run_path(str(SERVER), run_name="__main__")
