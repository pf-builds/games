#!/bin/sh
# Bake levels.json with macOS JavaScriptCore (no node needed). Run from anywhere.
DIR="$(cd "$(dirname "$0")/.." && pwd)"
JSC=/System/Library/Frameworks/JavaScriptCore.framework/Versions/Current/Helpers/jsc
"$JSC" -e "
var ROOT = '$DIR';
var readText = function (p) { return readFile(p); };
var out = function (s) { print('# ' + s); };
var writeText = function (p, t) { print('JSON:' + t); };
load(ROOT + '/tools/bake-src.js');
" > "$DIR/tools/_bake.out" 2>&1
grep '^# ' "$DIR/tools/_bake.out" | sed 's/^# //'
if grep -q '^JSON:' "$DIR/tools/_bake.out"; then
  sed -n 's/^JSON://p' "$DIR/tools/_bake.out" > "$DIR/levels.json"
  echo "wrote levels.json ($(wc -c < "$DIR/levels.json" | tr -d ' ') bytes)"
else
  echo "BAKE PRODUCED NO JSON"; tail -5 "$DIR/tools/_bake.out"
fi
rm -f "$DIR/tools/_bake.out"
