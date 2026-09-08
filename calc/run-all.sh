#!/bin/sh
# Run every check. Exits non-zero if any fails.
set -e
cd "$(dirname "$0")/.."
echo "--- syntax (index.html inline script) ---"
node calc/syntax.test.js
echo
echo "--- no duplication (index.html loads the module, does not redefine it) ---"
node calc/no-duplication.test.js
echo
echo "--- logic tests ---"
node calc/calculators.test.js
echo
echo "--- data tests (read from index.html) ---"
node calc/data.test.js
echo
echo "--- DOM tests (skipped unless jsdom is installed) ---"
node calc/dom.test.js
