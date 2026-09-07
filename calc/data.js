/*
 * data.js — loads the drug data literals straight out of index.html.
 *
 * F2 and F3 are defects in DATA, not in logic, so the tests have to see the real
 * shipped file rather than a copy that could drift. Each literal below is a
 * self-contained object/array with no runtime dependencies, so it can be sliced
 * out of the source and evaluated as-is.
 */
'use strict';
const fs = require('fs');
const path = require('path');

const SRC = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

// Slice from `const NAME = ` to the matching close brace/bracket at depth 0,
// respecting string literals so a brace inside a note doesn't fool the counter.
function extract(name) {
  const start = SRC.indexOf('const ' + name + ' =');
  if (start === -1) throw new Error(`${name} not found in index.html`);
  let i = SRC.indexOf('=', start) + 1;
  while (/\s/.test(SRC[i])) i++;
  const open = SRC[i];
  const close = open === '{' ? '}' : ']';
  if (open !== '{' && open !== '[') throw new Error(`${name} is not an object or array literal`);

  let depth = 0, quote = null, esc = false;
  for (let j = i; j < SRC.length; j++) {
    const c = SRC[j];
    if (esc) { esc = false; continue; }
    if (c === '\\') { esc = true; continue; }
    if (quote) { if (c === quote) quote = null; continue; }
    if (c === "'" || c === '"' || c === '`') { quote = c; continue; }
    if (c === open) depth++;
    else if (c === close) {
      depth--;
      if (depth === 0) {
        // eslint-disable-next-line no-new-func
        return new Function('return (' + SRC.slice(i, j + 1) + ');')();
      }
    }
  }
  throw new Error(`unterminated literal for ${name}`);
}

const PD_CATS      = extract('PD_CATS');
const DRUG_CATS    = extract('DRUG_CATS');
const ABX_DATA     = extract('ABX_DATA');
const OPIOIDS      = extract('OPIOIDS');
const OMEDD_DRUGS  = (() => {
  const start = SRC.indexOf('var OMEDD_DRUGS =');
  const i = SRC.indexOf('[', start);
  let depth = 0, quote = null, esc = false;
  for (let j = i; j < SRC.length; j++) {
    const c = SRC[j];
    if (esc) { esc = false; continue; }
    if (c === '\\') { esc = true; continue; }
    if (quote) { if (c === quote) quote = null; continue; }
    if (c === "'" || c === '"') { quote = c; continue; }
    if (c === '[') depth++;
    else if (c === ']') { depth--; if (depth === 0) return new Function('return (' + SRC.slice(i, j + 1) + ');')(); }
  }
  throw new Error('OMEDD_DRUGS not found');
})();

// Flatten the paediatric categories to a single list for scanning.
const PD_DRUGS = Object.entries(PD_CATS).flatMap(([cat, drugs]) =>
  drugs.map(d => Object.assign({ _cat: cat }, d)));

// Adult drugs, excluding the 'abx' sentinel.
const ADULT_DRUGS = Object.entries(DRUG_CATS)
  .filter(([, v]) => v !== 'abx')
  .flatMap(([cat, drugs]) => drugs.map(d => Object.assign({ _cat: cat }, d)));

module.exports = { SRC, PD_CATS, PD_DRUGS, DRUG_CATS, ADULT_DRUGS, ABX_DATA, OPIOIDS, OMEDD_DRUGS };
