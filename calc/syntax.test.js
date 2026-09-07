/*
 * syntax.test.js — the inline <script> in index.html must parse.
 *
 * Cheap, but it is the check that catches a botched edit to a 2,300-line inline
 * script before it reaches a browser, where the failure mode is a silently dead
 * page. Run: node calc/syntax.test.js
 */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const file = path.join(__dirname, '..', 'index.html');
const src = fs.readFileSync(file, 'utf8');

const blocks = [...src.matchAll(/<script>\n([\s\S]*?)\n<\/script>/g)].map(m => m[1]);
if (!blocks.length) { console.log('FAIL — no inline <script> found'); process.exit(1); }

let fail = 0;
blocks.forEach((code, i) => {
  try {
    new vm.Script(code, { filename: `index.html inline script #${i + 1}` });
    console.log(`  script #${i + 1}: ${code.split('\n').length} lines — parses`);
  } catch (e) {
    fail++;
    console.log(`  script #${i + 1}: SYNTAX ERROR — ${e.message}`);
  }
});

// Every function referenced from an inline handler must actually exist.
const handlers = new Set();
for (const m of src.matchAll(/\son(?:input|click|change)="([a-zA-Z_$][\w$]*)\s*\(/g)) handlers.add(m[1]);
const defined = new Set([...src.matchAll(/function\s+([a-zA-Z_$][\w$]*)\s*\(/g)].map(m => m[1]));
const missing = [...handlers].filter(h => !defined.has(h));
if (missing.length) { fail++; console.log(`  FAIL — handlers with no definition: ${missing.join(', ')}`); }
else console.log(`  all ${handlers.size} inline handlers resolve to a defined function`);

if (fail) { console.log('\nFAIL'); process.exit(1); }
console.log('\nPASS');
