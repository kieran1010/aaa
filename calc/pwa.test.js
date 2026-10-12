/*
 * pwa.test.js — the installable-app wiring is complete and consistent.
 *
 * The failure this guards against is quiet: an image added to index.html but
 * not to sw.js still works online and is simply missing offline; a renamed
 * icon breaks installation without breaking the page. Run: node calc/pwa.test.js
 */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const read = f => fs.readFileSync(path.join(root, f), 'utf8');
const html = read('index.html');
const swSrc = read('sw.js');

let fail = 0;
function check(name, ok, detail) {
  console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${name}${!ok && detail ? ` — ${detail}` : ''}`);
  if (!ok) fail++;
}
const fileFor = p => (p === '/' ? 'index.html' : p.replace(/^\//, ''));
const exists = p => fs.existsSync(path.join(root, fileFor(p)));
function pngSize(f) {
  const b = fs.readFileSync(path.join(root, fileFor(f)));
  return b.toString('ascii', 1, 4) === 'PNG' ? `${b.readUInt32BE(16)}x${b.readUInt32BE(20)}` : null;
}

// sw.js parses, and its lists can be read out of it.
let lists;
try {
  const ctx = { self: { addEventListener() {}, location: { origin: 'https://example' } } };
  lists = vm.runInNewContext(`${swSrc}\n;({ SHELL, STATIC, IMAGES })`, ctx, { filename: 'sw.js' });
  check('sw.js parses', true);
} catch (e) {
  check('sw.js parses', false, e.message);
  process.exit(1);
}
const { SHELL, STATIC, IMAGES } = lists;

const missing = [...SHELL, ...STATIC, ...IMAGES].filter(p => !exists(p));
check('every precached path is a file in the repo', !missing.length, missing.join(', '));

const referenced = new Set([...html.matchAll(/\/images\/[\w.-]+\.(?:jpe?g|png|webp|gif|svg)/g)].map(m => m[0]));
const notCached = [...referenced].filter(p => !IMAGES.includes(p));
const unused = IMAGES.filter(p => !referenced.has(p));
check('every image index.html uses is precached in sw.js', !notCached.length, notCached.join(', '));
check('sw.js precaches no image index.html does not use', !unused.length, unused.join(', '));

const iconLinks = [...html.matchAll(/<link rel="(?:icon|apple-touch-icon)" href="([^"]+)"/g)].map(m => m[1]);
const iconsNotCached = iconLinks.filter(p => !STATIC.includes(p));
check('every icon index.html links is precached', !iconsNotCached.length, iconsNotCached.join(', '));

let manifest;
try { manifest = JSON.parse(read('manifest.webmanifest')); check('manifest.webmanifest is valid JSON', true); }
catch (e) { check('manifest.webmanifest is valid JSON', false, e.message); process.exit(1); }
for (const k of ['name', 'short_name', 'start_url', 'display', 'icons']) check(`manifest has ${k}`, manifest[k] != null);
check('manifest is in STATIC', STATIC.includes('/manifest.webmanifest'));
for (const icon of manifest.icons || []) {
  const ok = exists(icon.src) && STATIC.includes(icon.src) && pngSize(icon.src) === icon.sizes;
  check(`manifest icon ${icon.src} exists, is ${icon.sizes} and is precached`, ok, exists(icon.src) ? `actual ${pngSize(icon.src)}` : 'missing');
}
const sizes = (manifest.icons || []).map(i => i.sizes);
check('manifest has 192x192 and 512x512 icons (needed to install on Android)', sizes.includes('192x192') && sizes.includes('512x512'));

check('index.html links the manifest', html.includes('<link rel="manifest" href="/manifest.webmanifest">'));
check('index.html registers /sw.js', /serviceWorker\.register\('\/sw\.js'\)/.test(html));
check('index.html loads the calculators from the path sw.js treats as shell',
  html.includes('<script src="calc/calculators.js"></script>') && SHELL.includes('/calc/calculators.js'));

if (fail) { console.log('\nFAIL'); process.exit(1); }
console.log('\nPASS');
