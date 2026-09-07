/*
 * dom.test.js — drives the real page in a real DOM.
 *
 * The other suites test logic and data. This one tests the WIRING: which
 * handler fires, what it writes into which field, and what the user ends up
 * seeing. Several of the worst defects found in this audit were wiring bugs
 * that no unit test would have caught.
 *
 * Needs jsdom, which is NOT a dependency of this repo (it ships as a single
 * static HTML file and has none). Skips cleanly if absent:
 *     npm install --no-save jsdom && node calc/dom.test.js
 */
'use strict';
let JSDOM;
try { ({ JSDOM } = require('jsdom')); }
catch (e) {
  console.log('SKIP — jsdom not installed. Run: npm install --no-save jsdom');
  process.exit(0);
}
const fs = require('fs');
const path = require('path');

let pass = 0, fail = 0;
function test(name, fn) {
  try { fn(); pass++; } catch (e) { fail++; console.log(`  FAIL  ${name}\n        ${e.message}`); }
}
function is(a, b, m) { if (a !== b) throw new Error(`${m || ''} expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`); }

function page() {
  const dom = new JSDOM(fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8'),
                        { runScripts: 'dangerously' });
  const d = dom.window.document, W = dom.window;
  const api = {
    d, W,
    set(id, v) { const e = d.getElementById(id); e.value = v; e.dispatchEvent(new W.Event('input', { bubbles: true })); return api; },
    change(id, v) { const e = d.getElementById(id); e.value = v; e.dispatchEvent(new W.Event('change', { bubbles: true })); return api; },
    clear(...ids) { ids.forEach(i => { const e = d.getElementById(i); if (e) e.value = ''; }); return api; },
    val(id) { return d.getElementById(id).value; },
    text(id) { return (d.getElementById(id).textContent || '').trim(); },
    cat(label) {
      [...d.querySelectorAll('.cat-btn')].find(b => b.textContent === label)
        .dispatchEvent(new W.Event('click', { bubbles: true }));
      return api;
    },
    row(re) {
      // Match against the NORMALISED text, so callers can anchor with ^ without
      // tripping over the whitespace the template leaves in textContent.
      const rows = [...d.querySelectorAll('#pd-out tr')]
        .map(r => r.textContent.replace(/\s+/g, ' ').trim());
      return rows.find(t => re.test(t)) || null;
    },
    age() { return `${api.val('g-yr')}y${api.val('g-mo')}m|${api.val('pd-yr')}y${api.val('pd-mo')}m`; }
  };
  return api;
}

/* ------------------------------- age sync -------------------------------- */

test('age entered on the home card reaches the paediatric calculator', () => {
  const p = page().set('g-yr', 3).set('g-mo', 6);
  is(p.age(), '3y6m|3y6m');
});

test('age entered on the paediatric calculator reaches the home card', () => {
  const p = page().set('pd-yr', 3).set('pd-mo', 6);
  is(p.age(), '3y6m|3y6m');
});

test('typing a weight does not wipe the age', () => {
  const p = page().set('pd-yr', 3).set('pd-mo', 6);
  p.set('pd-wt', 14);   is(p.age(), '3y6m|3y6m', 'after weight on the paed tab:');
  p.set('g-wt', 15);    is(p.age(), '3y6m|3y6m', 'after weight on the home card:');
  p.set('g-ht', 95);    is(p.age(), '3y6m|3y6m', 'after height on the home card:');
  p.change('g-sex', 'f'); is(p.age(), '3y6m|3y6m', 'after sex on the home card:');
});

test('months of 12 or more resolve into years and months', () => {
  [[17, '1y5m'], [12, '1y0m'], [23, '1y11m'], [24, '2y0m'], [11, '0y11m'], [30, '2y6m']]
    .forEach(([mo, want]) => {
      const p = page().set('pd-mo', mo);
      is(p.age(), `${want}|${want}`, `${mo} months ->`);
    });
});

test('normalisation also carries the existing years value', () => {
  const p = page().set('pd-yr', 1).set('pd-mo', 17);
  is(p.age(), '2y5m|2y5m', '1y + 17m ->');
});

test('normalisation works from the home card too', () => {
  is(page().set('g-mo', 30).age(), '2y6m|2y6m');
});

test('the age display is normalised, not the raw fields', () => {
  is(page().set('pd-mo', 17).text('pd-age-display'), '1y 5m');
  is(page().set('pd-mo', 7).text('pd-age-display'), '7m');
  is(page().set('pd-yr', 4).text('pd-age-display'), '4y 0m');
});

test('clearing the age on one card clears it on the other', () => {
  const p = page().set('pd-yr', 3).set('pd-mo', 6);
  p.clear('pd-yr').set('pd-mo', '');
  is(p.val('g-yr'), '',  'home years cleared:');
  is(p.val('g-mo'), '',  'home months cleared:');
  is(p.val('pd-yr'), '', 'paed years cleared:');
  is(p.val('pd-mo'), '', 'paed months cleared:');
});

test('DOB drives both cards', () => {
  const p = page();
  p.set('g-dob', '2023-01-15');
  const [gy, gm] = [p.val('g-yr'), p.val('g-mo')];
  is(p.val('pd-yr'), gy, 'years:');
  is(p.val('pd-mo'), gm, 'months:');
});

test('airway sizing is stable when a weight is added to a known age', () => {
  const p = page().set('pd-yr', 3).set('pd-mo', 0).cat('Airway');
  const before = p.row(/ETT uncuffed/);
  p.set('pd-wt', 14);
  is(p.row(/ETT uncuffed/), before, 'tube size changed when only a weight was added:');
});

/* ------------------------------ F5: airway ------------------------------- */

test('F5: a term neonate is sized by weight, not by Cole', () => {
  const p = page().set('pd-mo', 0).set('pd-wt', 3.5).cat('Airway');
  const ett = p.row(/ETT uncuffed/), lip = p.row(/lip/);
  if (!/3\.5 mm/.test(ett)) throw new Error(`expected 3.5 mm, got: ${ett}`);
  if (!/9\.5 cm/.test(lip)) throw new Error(`expected 9.5 cm, got: ${lip}`);
});

test('F5: an infant with only an age is sized from the APLS weight', () => {
  // 6 months -> APLS 7 kg -> the >3 kg band, depth 7 + 6 = 13 cm.
  const p = page().set('pd-mo', 6).cat('Airway');
  if (!/3\.5 mm/.test(p.row(/ETT uncuffed/))) throw new Error(p.row(/ETT uncuffed/));
  if (!/13 cm/.test(p.row(/lip/)))             throw new Error(p.row(/lip/));
  if (!/not valid under 1 year/i.test(p.text('pd-out'))) throw new Error('basis note missing');
});

test('F5: 0 months is a known age, not an absent one', () => {
  // Regression: ageKnown used to be (yr > 0 || mo > 0), so a term neonate
  // entered as 0y 0m fell through to estimating age from weight and was
  // refused outright.
  const p = page().set('pd-yr', 0).set('pd-mo', 0).set('pd-wt', 3.5).cat('Airway');
  if (!/3\.5 mm/.test(p.row(/ETT uncuffed/) || '')) throw new Error(`got: ${p.text('pd-out').slice(0, 90)}`);
  if (!/9\.5 cm/.test(p.row(/lip/) || ''))          throw new Error(p.row(/lip/));
});

test('F5: Cole still applies from 1 year', () => {
  const p = page().set('pd-yr', 8).cat('Airway');
  if (!/6 mm/.test(p.row(/ETT uncuffed/))) throw new Error(p.row(/ETT uncuffed/));
  if (!/16 cm/.test(p.row(/lip/)))         throw new Error(p.row(/lip/));
});

test('F5: 30 kg with no age is read as ~7.7y, not 11y', () => {
  const p = page().set('pd-wt', 30).cat('Airway');
  const ett = p.row(/ETT uncuffed/);
  if (!/6 mm/.test(ett)) throw new Error(`expected 6 mm (was 7.0 mm), got: ${ett}`);
  if (!/estimated from weight/i.test(p.text('pd-out'))) throw new Error('basis note missing');
});

test('F5: airway sizing is refused above 12 years', () => {
  const p = page().set('pd-yr', 40).set('pd-wt', 80).cat('Airway');
  if (!/over 12 years/i.test(p.text('pd-out'))) throw new Error(`got: ${p.text('pd-out')}`);
});

/* ------------------------------ F9: 4-2-1 -------------------------------- */

test('F9: maintenance fluid follows Holliday-Segar and carries a unit', () => {
  [[10, '40'], [20, '60'], [30, '70'], [45, '85']].forEach(([wt, want]) => {
    const p = page().set('pd-wt', wt).cat('Fluids');
    const r = p.row(/^Maintenance/);
    if (!new RegExp('\\b' + want + ' mL/hr').test(r)) {
      throw new Error(`${wt} kg: expected ${want} mL/hr, got: ${r}`);
    }
  });
});

/* --------------------------- the Tier 1 fixes ---------------------------- */

test('F1: an adult age is refused on the paediatric tab', () => {
  const p = page().set('pd-yr', 40).set('pd-mo', 0);
  is(p.text('pd-apls-wt'), 'N/A');
  if (!/over 12 years/i.test(p.text('pd-out'))) throw new Error(`got: ${p.text('pd-out')}`);
});

test('F1: a real child is unaffected', () => {
  const p = page().set('pd-yr', 3).set('pd-mo', 0);
  is(p.text('pd-apls-wt'), '14 kg');
  is(p.text('pd-wt-used'), '14.0 kg');
});

test('F3: the adrenaline cap bites and 1:1000 is offered first (F12)', () => {
  const p = page().set('pd-wt', 60).cat('Emergency');
  const r = p.row(/^Adrenaline Anaphylaxis/);
  if (!/0\.50 mg\*/.test(r)) throw new Error(`cap not applied: ${r}`);
  if (!/1:1000/.test(r.split('mL')[0] + 'mL')) throw new Error(`1:1000 not first: ${r}`);
});

test('F4: LA uses the lower of IBW and actual weight', () => {
  const p = page().set('la-ht', 170).set('la-wt', 45).change('la-sex', 'f');
  is(p.text('ibw-used'), '45 kg');
  is(p.text('ibw-used-note'), 'Actual (lower than IBW)');
});

test('F4: IBW still wins in obesity', () => {
  const p = page().set('la-ht', 160).set('la-wt', 90).change('la-sex', 'f');
  is(p.text('ibw-used'), '52.4 kg');
  is(p.text('ibw-used-note'), 'IBW (lower than actual)');
});

test('F2: the adenosine row shows the fixed SVT dose', () => {
  const p = page();
  [...p.d.querySelectorAll('#dd-cats .cat-btn')].find(b => b.textContent === 'Antiarrhythmics')
    .dispatchEvent(new p.W.Event('click', { bubbles: true }));
  const r = [...p.d.querySelectorAll('#drug-tbody tr')].find(r => /Adenosine/.test(r.textContent))
              .textContent.replace(/\s+/g, ' ');
  if (!/6-12 mg/.test(r)) throw new Error(`got: ${r.slice(0, 60)}`);
});

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) { console.log('FAIL'); process.exit(1); }
console.log('PASS');
