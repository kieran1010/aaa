/*
 * no-duplication.test.js — index.html must not redefine the shared logic.
 *
 * This replaces the old equivalence harness. That harness existed because the
 * calculation logic was written out twice — once in index.html and once in the
 * module — and it swept ~12k inputs through both to prove they still agreed.
 * index.html now LOADS the module instead, so there is nothing left to compare;
 * what needs guarding is that the duplication cannot come back, and that the
 * two files are wired together correctly.
 *
 * Run: node calc/no-duplication.test.js
 */
'use strict';
const fs = require('fs');
const path = require('path');
const C = require('./calculators.js');

const SRC = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const inline = [...SRC.matchAll(/<script>\n([\s\S]*?)\n<\/script>/g)].map(m => m[1]).join('\n');

let pass = 0, fail = 0;
function test(name, fn) {
  try { fn(); pass++; } catch (e) { fail++; console.log(`  FAIL  ${name}\n        ${e.message}`); }
}
function is(a, b, m) { if (a !== b) throw new Error(`${m || ''} expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`); }

test('index.html loads the module', () => {
  if (!/<script src="calc\/calculators\.js"><\/script>/.test(SRC)) {
    throw new Error('the <script src> tag is missing');
  }
  const tagAt = SRC.indexOf('<script src="calc/calculators.js">');
  const inlineAt = SRC.indexOf('<script>\n/* ====');
  if (inlineAt !== -1 && tagAt > inlineAt) throw new Error('the module must load BEFORE the inline script');
});

test('index.html redefines none of the shared functions', () => {
  const shared = Object.keys(C).filter(k => typeof C[k] === 'function');
  const dup = shared.filter(n => new RegExp('(?:^|\\n)\\s*function\\s+' + n + '\\s*\\(').test(inline));
  if (dup.length) throw new Error(`redefined in index.html: ${dup.join(', ')}`);
});

test('index.html redefines none of the shared constants', () => {
  const shared = Object.keys(C).filter(k => typeof C[k] !== 'function');
  const dup = shared.filter(n =>
    new RegExp('(?:^|\\n)\\s*(?:const|var|let)\\s+' + n + '\\s*=').test(inline));
  if (dup.length) throw new Error(`redefined in index.html: ${dup.join(', ')}`);
});

// The destructuring list is hand-written, so a typo there is a live TypeError.
function destructuredNames() {
  const m = /const\s*\{([\s\S]*?)\}\s*=\s*Calc\s*;/.exec(inline);
  if (!m) throw new Error('no `= Calc` destructuring found in index.html');
  return m[1].split(',').map(x => x.trim()).filter(Boolean);
}

test('every name destructured from Calc is actually exported', () => {
  const missing = destructuredNames().filter(n => !(n in C));
  if (missing.length) throw new Error(`not exported by the module: ${missing.join(', ')}`);
});

test('every shared name index.html uses is destructured', () => {
  const have = new Set(destructuredNames());
  const body = inline.replace(/const\s*\{[\s\S]*?\}\s*=\s*Calc\s*;/, '');
  const used = Object.keys(C).filter(n =>
    new RegExp('\\b' + n + '\\b').test(body) && !have.has(n) && !/\bCalc\.' + n + '/.test(body));
  if (used.length) throw new Error(`used but not destructured (would be undefined): ${used.join(', ')}`);
});

test('the module still exports everything index.html needs', () => {
  destructuredNames().forEach(n => {
    if (C[n] === undefined) throw new Error(`${n} is undefined`);
  });
});

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) { console.log('FAIL'); process.exit(1); }
console.log('PASS — one definition of the calculation logic, correctly wired');
