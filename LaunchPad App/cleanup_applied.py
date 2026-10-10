#!/usr/bin/env python3
"""Kept for older callers (the docs-cleanup skill and older setups).

All cleanup now lives in cleanup.py, which archives application folders along
with stale cards, closed people, old listings and the posting ledger. This
wrapper just runs it, passing any arguments through (e.g. --dry-run).
"""
import os
import runpy
import sys

if __name__ == "__main__":
    sys.argv[0] = os.path.join(os.path.dirname(os.path.abspath(__file__)), "cleanup.py")
    runpy.run_path(sys.argv[0], run_name="__main__")
