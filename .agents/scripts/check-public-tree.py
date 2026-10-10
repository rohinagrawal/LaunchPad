#!/usr/bin/env python3
"""Fail when a folder holds anything that must not be in the public LaunchPad repository.

    python3 .agents/scripts/check-public-tree.py [folder]           # personal paths only
    python3 .agents/scripts/check-public-tree.py [folder] --terms-file terms.txt

Two checks, both read-only:
  1. No personal path is present (see "Product And Personal Files" in the conventions rule).
  2. With --terms-file: no file contains any of the listed terms (one per line, case-insensitive),
     e.g. a name, an employer, an email address, the people on someone's board.

Prints one line per problem and exits 1 if there is any. Standard library only.
"""
import argparse
import os
import sys

# Folders whose whole contents are personal; README.md alone may stay where listed.
PERSONAL_DIRS = {
    "Resume": (), "Referral": (), "Applications": (), "Job Listings": (), "Interview Prep": (),
    "Cover Letters": (), "Company Research": (),
    "Data": ("README.md",), "Archive": ("README.md",),
}
PERSONAL_FILES = ("Job-Thesis.md", "Target-Companies.md", "START-HERE.md")
SKIP_DIRS = {".git", "__pycache__", ".venv", "node_modules"}


def walk(root):
    for folder, dirs, files in os.walk(root):
        dirs[:] = [d for d in dirs if d not in SKIP_DIRS]
        for name in files:
            full = os.path.join(folder, name)
            yield os.path.relpath(full, root).replace(os.sep, "/"), full


def personal_paths(root):
    found = []
    for rel, _ in walk(root):
        top = rel.split("/", 1)[0]
        if "/" not in rel:
            if rel in PERSONAL_FILES:
                found.append(rel)
        elif top in PERSONAL_DIRS and rel.split("/", 1)[1] not in PERSONAL_DIRS[top]:
            found.append(rel)
    return found


def term_hits(root, terms):
    hits = []
    for rel, full in walk(root):
        try:
            with open(full, "rb") as f:
                text = f.read().decode("utf-8", errors="ignore").lower()
        except OSError:
            continue
        for term in terms:
            if term in text or term in rel.lower():
                hits.append((rel, term))
    return hits


def main():
    ap = argparse.ArgumentParser(description="Check that a folder is safe to publish as LaunchPad.")
    ap.add_argument("folder", nargs="?", default=".")
    ap.add_argument("--terms-file", help="file with one personal term per line to search for")
    args = ap.parse_args()
    root = os.path.abspath(args.folder)
    problems = ["personal path present: " + p for p in personal_paths(root)]
    if args.terms_file:
        with open(args.terms_file, encoding="utf-8") as f:
            terms = sorted({line.strip().lower() for line in f if len(line.strip()) >= 4})
        # Never print the term itself: the output may end up in a public log.
        problems += ["personal term #%d found in: %s" % (terms.index(t) + 1, rel) for rel, t in term_hits(root, terms)]
    for line in problems:
        print("FAIL " + line)
    if problems:
        print("%d problem(s). Do not publish this folder." % len(problems))
        return 1
    print("OK   nothing personal found in " + root)
    return 0


if __name__ == "__main__":
    sys.exit(main())
