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

// Slice `const NAME = <expression>;` and evaluate it, with any earlier
// definitions it depends on already in scope. OPIOIDS and OMEDD_DRUGS are now
// DERIVED from the single ANZCA table rather than being literals, which is the
// whole point of that change - so they have to be evaluated, not parsed.
// Slice `const NAME = <expression>;` and evaluate it, with any earlier
// definitions it depends on already in scope. OPIOIDS and OMEDD_DRUGS are now
// DERIVED from the single ANZCA table rather than being literals, which is the
// whole point of that change - so they have to be evaluated, not parsed.
// The terminating semicolon is found at bracket depth 0 and outside strings and
// comments, so a `;` inside the expression does not truncate it.
function statementSource(name) {
  const m = new RegExp('(?:const|var|let)\\s+' + name + '\\s*=').exec(SRC);
  if (!m) throw new Error(`${name} not found in index.html`);
  let depth = 0, quote = null, esc = false, line = false, block = false;
  for (let j = m.index + m[0].length; j < SRC.length; j++) {
    const c = SRC[j], n = SRC[j + 1];
    if (line)  { if (c === '\n') line = false; continue; }
    if (block) { if (c === '*' && n === '/') { block = false; j++; } continue; }
    if (esc)   { esc = false; continue; }
    if (quote) {
      if (c === '\\') { esc = true; continue; }
      if (c === quote) quote = null;
      continue;
    }
    if (c === '/' && n === '/') { line = true; j++; continue; }
    if (c === '/' && n === '*') { block = true; j++; continue; }
    if (c === "'" || c === '"' || c === '`') { quote = c; continue; }
    if (c === '{' || c === '[' || c === '(') depth++;
    else if (c === '}' || c === ']' || c === ')') depth--;
    else if (c === ';' && depth === 0) return SRC.slice(m.index, j + 1);
  }
  throw new Error(`unterminated statement for ${name}`);
}

function evaluateChain(names, scope) {
  const src = names.map(statementSource).join('\n');
  const last = names[names.length - 1];
  const keys = Object.keys(scope || {});
  // eslint-disable-next-line no-new-func
  return new Function(...keys, src + '\nreturn ' + last + ';')(...keys.map(k => scope[k]));
}

const PD_CATS      = extract('PD_CATS');
const DRUG_CATS    = extract('DRUG_CATS');
const ABX_DATA     = extract('ABX_DATA');
// The ANZCA table moved into calc/calculators.js; index.html destructures it.
const { ANZCA_OPIOIDS } = require('./calculators.js');
const OPIOIDS     = evaluateChain(['OPIOIDS'], { ANZCA_OPIOIDS });
const OMEDD_DRUGS = evaluateChain(['OMEDD_DRUGS'], { ANZCA_OPIOIDS });

// Flatten the paediatric categories to a single list for scanning.
const PD_DRUGS = Object.entries(PD_CATS).flatMap(([cat, drugs]) =>
  drugs.map(d => Object.assign({ _cat: cat }, d)));

// Adult drugs, excluding the 'abx' sentinel.
const ADULT_DRUGS = Object.entries(DRUG_CATS)
  .filter(([, v]) => v !== 'abx')
  .flatMap(([cat, drugs]) => drugs.map(d => Object.assign({ _cat: cat }, d)));

module.exports = { SRC, PD_CATS, PD_DRUGS, DRUG_CATS, ADULT_DRUGS, ABX_DATA,
                   ANZCA_OPIOIDS, OPIOIDS, OMEDD_DRUGS };
