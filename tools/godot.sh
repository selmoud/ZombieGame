#!/usr/bin/env bash
# Runs the project's Godot headless with writable user directories.
# Usage: tools/godot.sh [godot arguments]
set -u

cd "$(dirname "$0")/.."

GODOT="${GODOT:-/usr/local/bin/godot-4.7.2}"
STATE="${TMPDIR:-/tmp}/godot-user"
export XDG_DATA_HOME="$STATE/data" XDG_CONFIG_HOME="$STATE/config" XDG_CACHE_HOME="$STATE/cache"
mkdir -p "$XDG_DATA_HOME" "$XDG_CONFIG_HOME" "$XDG_CACHE_HOME"

exec "$GODOT" --headless --path . "$@"
