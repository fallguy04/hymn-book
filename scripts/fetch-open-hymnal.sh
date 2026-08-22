#!/usr/bin/env bash
#
# Fetch the Open Hymnal Project source files that scripts/build-other-songs.mjs
# reads. Two files, fetched once — no crawling, no per-hymn requests.
#
# openhymnal.org exists to distribute public-domain hymnody freely; its own
# rights statement is "Public Domain". We keep the sources under vendor/ so the
# build is reproducible without going back to the network.
set -euo pipefail

DIR="vendor/open-hymnal"
UA="hymn-book/1.0 (congregational hymnal; github.com/fallguy04/hymn-book)"

mkdir -p "$DIR"

echo "→ ABC bundle (titles, attributions, and true line breaks)"
curl -sL --fail -m 180 -A "$UA" \
  "http://openhymnal.org/OpenHymnal2014.06-abc.zip" -o "$DIR/abc.zip"
rm -rf "$DIR/abc"
mkdir -p "$DIR/abc"
unzip -q -o "$DIR/abc.zip" -d "$DIR/abc"
rm -f "$DIR/abc.zip"

echo "→ ThML build (every verse, as prose)"
curl -sL --fail -m 180 -A "$UA" \
  "http://openhymnal.org/openhymnal.201406.xml" -o "$DIR/openhymnal.xml"

echo "✓ $(find "$DIR/abc" -name '*.abc' | wc -l | tr -d ' ') ABC files, $(du -h "$DIR/openhymnal.xml" | cut -f1) XML"
