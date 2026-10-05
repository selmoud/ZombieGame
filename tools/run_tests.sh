#!/usr/bin/env bash
# Imports the project and runs all tests headless.
# Exit code 0 only when every test passes and Godot reports no errors.
set -u

cd "$(dirname "$0")/.."

GODOT="${GODOT:-/usr/local/bin/godot-4.7.2}"
STATE="${TMPDIR:-/tmp}/godot-user"
export XDG_DATA_HOME="$STATE/data" XDG_CONFIG_HOME="$STATE/config" XDG_CACHE_HOME="$STATE/cache"
mkdir -p "$XDG_DATA_HOME" "$XDG_CONFIG_HOME" "$XDG_CACHE_HOME"

log="$(mktemp)"
trap 'rm -f "$log"' EXIT

if ! timeout 180 "$GODOT" --headless --path . --import >"$log" 2>&1; then
	cat "$log"
	echo "IMPORT FAILED"
	exit 1
fi
# The editor cannot save its own settings in a sandbox; that is not a project error.
if grep -E "^(SCRIPT ERROR|ERROR)" "$log" | grep -vE "editor settings|Can't save resource to empty path"; then
	echo "IMPORT REPORTED ERRORS"
	exit 1
fi

timeout 300 "$GODOT" --headless --path . --script res://tests/run_all.gd 2>&1 | tee "$log"
status=${PIPESTATUS[0]}

if [ "$status" -eq 124 ]; then
	echo "TESTS TIMED OUT"
	exit 1
fi
if grep -qE "^(SCRIPT ERROR|ERROR)" "$log"; then
	echo "TESTS REPORTED ERRORS"
	exit 1
fi
exit "$status"
