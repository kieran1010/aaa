/*
 * live.js — pulls the real functions out of index.html and makes them callable.
 *
 * The point is to remove transcription risk. A harness that compares the module
 * against a hand-copied "original" only proves the copy matches; this executes
 * the source that actually ships, with a minimal DOM stub standing in for the
 * page so DOM-reading functions can be driven directly.
 */
'use strict';
const fs = require('fs');
const path = require('path');

const SRC = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

// Slice `function NAME(...) { ... }` out of the source by brace matching,
// respecting strings, template literals, comments and regex-ish slashes.
function fnSource(name) {
  const re = new RegExp('function\\s+' + name + '\\s*\\(');
  const m = re.exec(SRC);
  if (!m) throw new Error(`function ${name} not found in index.html`);
  const start = m.index;
  let i = SRC.indexOf('{', start);
  let depth = 0, quote = null, esc = false, line = false, block = false;
  for (let j = i; j < SRC.length; j++) {
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
    if (c === '{') depth++;
    else if (c === '}') { depth--; if (depth === 0) return SRC.slice(start, j + 1); }
  }
  throw new Error(`unterminated function ${name}`);
}

// Constants the extracted functions close over.
function constValue(name) {
  const m = new RegExp('const\\s+' + name + '\\s*=\\s*([^;]+);').exec(SRC);
  if (!m) throw new Error(`const ${name} not found`);
  return new Function('return (' + m[1] + ');')();
}

/*
 * Minimal DOM stub. Only what the extracted functions touch: getElementById
 * returning an element with .value / .textContent / .style / .className.
 */
function makeDom(values) {
  const els = {};
  const get = id => (els[id] || (els[id] = {
    value: values && values[id] != null ? String(values[id]) : '',
    textContent: '', innerHTML: '', className: '',
    style: {}, classList: { add(){}, remove(){}, toggle(){} },
    dataset: {}
  }));
  return { getElementById: get, querySelector: () => null, querySelectorAll: () => [], _els: els };
}

// Build a callable version of a DOM-reading function.
function withDom(name, extraNames) {
  const src = [].concat(extraNames || []).map(fnSource).concat([fnSource(name)]).join('\n');
  return function (values) {
    const document = makeDom(values);
    const factory = new Function('document', 'APLS_MAX_MONTHS', 'DEVINE_MIN_HEIGHT_CM',
      src + '\nreturn ' + name + ';');
    let APLS_MAX_MONTHS = null, DEVINE_MIN_HEIGHT_CM = null;
    try { APLS_MAX_MONTHS = constValue('APLS_MAX_MONTHS'); } catch (e) {}
    try { DEVINE_MIN_HEIGHT_CM = constValue('DEVINE_MIN_HEIGHT_CM'); } catch (e) {}
    const fn = factory(document, APLS_MAX_MONTHS, DEVINE_MIN_HEIGHT_CM);
    const out = fn();
    return { result: out, dom: document._els };
  };
}

// Pure functions: compile once, call directly.
function pure(name, deps) {
  const src = [].concat(deps || []).map(fnSource).concat([fnSource(name)]).join('\n');
  let APLS_MAX_MONTHS = null;
  try { APLS_MAX_MONTHS = constValue('APLS_MAX_MONTHS'); } catch (e) {}
  return new Function('APLS_MAX_MONTHS', src + '\nreturn ' + name + ';')(APLS_MAX_MONTHS);
}

module.exports = { SRC, fnSource, constValue, pure, withDom, makeDom };
