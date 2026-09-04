#!/bin/sh
# Bake levels.json with macOS JavaScriptCore (no node needed).
cd "$(dirname "$0")" && /System/Library/Frameworks/JavaScriptCore.framework/Versions/Current/Helpers/jsc levels-src.js > ../levels.json && echo "wrote levels.json"
