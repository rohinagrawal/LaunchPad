#!/bin/bash
# LaunchPad launcher (macOS/Linux shim) — delegates to the cross-platform
# Python launcher. Called by an app bundle that wraps it, or run directly:
#   ./launch.sh
# Windows users: run  py launch.py  instead (or make a shortcut to it).

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
exec /usr/bin/env python3 "$APP_DIR/launch.py" "$@"
