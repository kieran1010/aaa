#!/bin/sh
# Run every check. Exits non-zero if any fails.
set -e
cd "$(dirname "$0")/.."
echo "--- equivalence (module vs the functions that ship in index.html) ---"
node calc/equivalence.js
echo
echo "--- logic tests ---"
node calc/calculators.test.js
echo
echo "--- data tests (read from index.html) ---"
node calc/data.test.js
