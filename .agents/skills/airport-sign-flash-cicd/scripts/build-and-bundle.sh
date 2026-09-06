#!/usr/bin/env bash
set -euo pipefail
root_dir="$(cd "$(dirname "$0")/../../../.." && pwd)"
project_dir="$root_dir/../esp-idf-mvp"
site_dir="$root_dir"
source /Users/wed/.espressif/v6.0.2/esp-idf/export.sh
cd "$project_dir"
idf.py -B "$project_dir/build-idf602" merge-bin
mkdir -p "$site_dir/firmware"
cp "$project_dir/build-idf602/merged-binary.bin" "$site_dir/firmware/airport-display.bin"
test -s "$site_dir/firmware/airport-display.bin"
printf 'Bundled %s (%s bytes)\n' "$site_dir/firmware/airport-display.bin" "$(stat -f %z "$site_dir/firmware/airport-display.bin" 2>/dev/null || stat -c %s "$site_dir/firmware/airport-display.bin")"
