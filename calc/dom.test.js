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

const HTML   = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const MODULE = fs.readFileSync(path.join(__dirname, 'calculators.js'), 'utf8');

/*
 * index.html loads calc/calculators.js with a <script src>. jsdom will fetch
 * that only with `resources: 'usable'`, which makes loading asynchronous and
 * would turn every test below into an async one. For the synchronous tests the
 * module is inlined in place of the tag instead — same code, same order.
 * `loadsModuleForReal()` at the end covers the tag itself, asynchronously.
 */
function page() {
  const html = HTML.replace('<script src="calc/calculators.js"></script>',
                            '<script>' + MODULE + '</script>');
  const dom = new JSDOM(html, { runScripts: 'dangerously' });
  const d = dom.window.document, W = dom.window;
  const api = {
    d, W,
    set(id, v) { const e = d.getElementById(id); e.value = v; e.dispatchEvent(new W.Event('input', { bubbles: true })); return api; },
    change(id, v) { const e = d.getElementById(id); e.value = v; e.dispatchEvent(new W.Event('change', { bubbles: true })); return api; },
    clear(...ids) { ids.forEach(i => { const e = d.getElementById(i); if (e) e.value = ''; }); return api; },
    val(id) { return d.getElementById(id).value; },
    attr(id, name) { return d.getElementById(id).getAttribute(name); },
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

/* --------------------------- F13: input guards ---------------------------- */

test('F13: out-of-range values are clamped on blur', () => {
  const p = page();
  const el = p.d.getElementById('g-wt');
  el.value = '9000';
  el.dispatchEvent(new p.W.Event('change', { bubbles: true }));
  is(el.value, '250', 'weight clamped to its declared max:');

  const yr = p.d.getElementById('pd-yr');
  yr.value = '400';
  yr.dispatchEvent(new p.W.Event('change', { bubbles: true }));
  is(yr.value, '18', 'age clamped to its declared max:');
});

test('F13: a negative value is clamped to the minimum', () => {
  const p = page();
  const el = p.d.getElementById('la-ht');
  el.value = '-50';
  el.dispatchEvent(new p.W.Event('change', { bubbles: true }));
  is(el.value, '100');
});

test('F13: typing flags but does not rewrite mid-keystroke', () => {
  const p = page();
  const el = p.d.getElementById('g-wt');
  el.value = '3';                                       // below min=1? no - valid
  el.dispatchEvent(new p.W.Event('input', { bubbles: true }));
  is(el.value, '3', 'still what the user typed:');
  el.value = '900';
  el.dispatchEvent(new p.W.Event('input', { bubbles: true }));
  is(el.value, '900', 'not rewritten while typing:');
  if (!el.style.borderColor) throw new Error('out-of-range value was not flagged');
});

test('F13: in-range values are untouched and unflagged', () => {
  const p = page();
  const el = p.d.getElementById('g-wt');
  el.value = '70';
  el.dispatchEvent(new p.W.Event('change', { bubbles: true }));
  is(el.value, '70');
  is(el.style.borderColor, '', 'no warning border:');
});

test('F13: clamping still triggers the dependent calculations', () => {
  const p = page();
  const el = p.d.getElementById('g-wt');
  el.value = '9000';
  el.dispatchEvent(new p.W.Event('change', { bubbles: true }));
  is(p.text('g-tbw'), '250 kg', 'body-weight box recalculated from the clamped value:');
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

/* --------------------------- Tier 3 in the page --------------------------- */

test('F14/F19: the two body-weight displays agree, and never exceed the patient', () => {
  const p = page().set('g-wt', 45).set('g-ht', 170).change('g-sex', 'f');
  is(p.text('g-abw'), '45 kg', 'patient card ABW = TBW:');
  p.set('dd-wt', 45).set('dd-ht', 170);
  const dd = p.text('dd-abw');
  if (!/^45\/45 kg/.test(dd)) throw new Error(`drugs tab disagrees: ${dd} (was 61/61)`);
});

test('F19: below 152 cm both displays decline rather than showing 0 kg', () => {
  const p = page().set('g-wt', 40).set('g-ht', 140).change('g-sex', 'f');
  is(p.text('g-ibw'), '—');
  if (!/not valid/i.test(p.text('g-ibw-note'))) throw new Error(p.text('g-ibw-note'));
  p.set('dd-wt', 40).set('dd-ht', 140);
  if (!/not valid/i.test(p.text('dd-ibw'))) throw new Error(p.text('dd-ibw'));
});

test('F19: LBW is still shown below 152 cm, where it is valid', () => {
  const p = page().set('g-wt', 40).set('g-ht', 140).change('g-sex', 'f');
  if (p.text('g-lbw') === '—') throw new Error('LBW should still be available');
});

test('F15/F25: a date of birth gives the right age either side of a birthday', () => {
  const p = page();
  const el = p.d.getElementById('g-dob');
  const today = new Date();
  const dob = new Date(today.getFullYear() - 6, today.getMonth(), today.getDate() + 1);
  const iso = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  el.value = iso(dob);
  el.dispatchEvent(new p.W.Event('input', { bubbles: true }));
  is(p.val('g-yr'), '5', 'the day before the 6th birthday is 5, not 6:');
  is(p.val('g-mo'), '11');
});

test('F15: a future date of birth is refused and flagged', () => {
  const p = page();
  const el = p.d.getElementById('g-dob');
  el.value = `${new Date().getFullYear() + 3}-01-01`;
  el.dispatchEvent(new p.W.Event('input', { bubbles: true }));
  is(p.val('g-yr'), '', 'no age written:');
  if (!el.style.borderColor) throw new Error('not flagged');
});

test('F20: a 5.5-year-old is estimated in the 1-5y band', () => {
  const p = page().set('pd-yr', 5).set('pd-mo', 6);
  is(p.text('pd-apls-wt'), '19 kg', 'was 23.5 kg:');
  is(p.text('pd-apls-formula'), '2 x (age + 4)');
});

test('F23: dantrolene and Intralipid follow the entered weight', () => {
  const p = page().set('g-wt', 100);
  const dan = p.text('mh-dantrolene-calc');
  if (!/250 mg/.test(dan) || !/13 vials/.test(dan)) throw new Error(`dantrolene: ${dan}`);
  const lb = p.text('last-bolus-calc');
  if (!/150 ml/.test(lb)) throw new Error(`intralipid bolus: ${lb}`);
  const li = p.text('last-inf-calc');
  if (!/1500 ml\/hr/.test(li)) throw new Error(`intralipid infusion: ${li}`);
  if (!/1200 ml/.test(li)) throw new Error(`max total missing: ${li}`);
});

test('F23: with no weight entered they still show the 70 kg example', () => {
  const p = page();
  if (!/70 kg adult/.test(p.text('mh-dantrolene-calc'))) throw new Error(p.text('mh-dantrolene-calc'));
  if (!/175 mg = 9 vials/.test(p.text('mh-dantrolene-calc'))) throw new Error(p.text('mh-dantrolene-calc'));
});

test('F6: the oMEDD tab scores fentanyl on the ANZCA factor', () => {
  const p = page();
  const sel = p.d.querySelector('#omedd-rows select');
  const opt = [...sel.options].find(o => o.textContent === 'Parenteral Fentanyl');
  if (!opt) throw new Error(`Parenteral Fentanyl not offered: ${[...sel.options].map(o => o.textContent).join(', ')}`);
  sel.value = opt.value;
  sel.dispatchEvent(new p.W.Event('change', { bubbles: true }));
  p.set(p.d.querySelector('#omedd-rows input').id, 600);
  is(p.text('omedd-total'), '120.0 mg/day', '600 mcg/day, was scored 60:');
});

test('F6: the oMEDD tab offers every ANZCA preparation', () => {
  const p = page();
  const names = [...p.d.querySelector('#omedd-rows select').options].map(o => o.textContent);
  ['Transdermal Fentanyl', 'Transdermal Buprenorphine', 'Parenteral Pethidine',
   'Parenteral Sufentanil', 'Sublingual Buprenorphine', 'Rectal Oxycodone']
    .forEach(n => { if (!names.includes(n)) throw new Error(`missing: ${n}`); });
  if (names.some(n => /methadone/i.test(n))) throw new Error('methadone should be excluded');
});

test('F6: ANZCA take-home naloxone prompt fires at 40 mg oMEDD', () => {
  const p = page();
  const inp = p.d.querySelector('#omedd-rows input');
  const sel = p.d.querySelector('#omedd-rows select');
  sel.value = [...sel.options].find(o => o.textContent === 'Oral Oxycodone').value;
  sel.dispatchEvent(new p.W.Event('change', { bubbles: true }));
  p.set(inp.id, 20);                                   // 20 x 1.5 = 30 mg
  is(p.d.getElementById('omedd-thn').style.display, 'none', 'below 40 mg:');
  p.set(inp.id, 40);                                   // 40 x 1.5 = 60 mg
  is(p.d.getElementById('omedd-thn').style.display, 'block', 'ANZCA worked example, 60 mg oMEDD:');
  if (!/take-home naloxone/i.test(p.text('omedd-thn'))) throw new Error(p.text('omedd-thn'));
});

test('F7: the factor footnote is rendered and attributed', () => {
  const p = page();
  const t = p.text('omedd-factors');
  if (!/October 2025/.test(t)) throw new Error(`not attributed: ${t.slice(0, 80)}`);
  if (!/Fentanyl \(mcg\/hr\) × 3/.test(t)) throw new Error(`patch factor wrong: ${t}`);
  if (/× 25/.test(t)) throw new Error('the old buprenorphine x 25 text is still there');
});

test('F16: methadone round-trips through the conversion tab', () => {
  const p = page();
  const sel = p.d.getElementById('oc-ref');
  sel.value = 'po_methadone';
  sel.dispatchEvent(new p.W.Event('change', { bubbles: true }));
  p.set('oc-dose', 15);
  const rows = [...p.d.querySelectorAll('#opioid-tbody tr')].map(r => r.textContent.replace(/\s+/g, ' ').trim());
  const morphine = rows.find(r => /^Oral Morphine/.test(r));
  if (!/120/.test(morphine)) throw new Error(`15 mg methadone should be 120 mg oMEDD: ${morphine}`);
  const meth = rows.find(r => /^Oral Methadone/.test(r));
  if (!/15(\.0)? mg/.test(meth)) throw new Error(`should return 15 mg, not drift: ${meth}`);
});

test('F26: IM ketamine volume is practical', () => {
  const p = page().set('pd-wt', 20).cat('Induction');
  const r = p.row(/^Ketamine \(IM\)/);
  if (!/1\.00 mL/.test(r)) throw new Error(`expected 1.00 mL at 100 mg/mL, got: ${r}`);
  // The concentration itself is asserted in data.test.js; the note deliberately
  // mentions 10 mg/mL, so match on the rendered volume only.
});

/* ------------- F31: weight/height cross-population, incl. an age alone ---- */

test('F31: an infant age alone now produces a weight on the home card', () => {
  // Was the reported bug: entering just an age on the home screen computed no
  // weight at all — the box stayed hidden, because globalPatientUpdate() keyed
  // everything off the ACTUAL g-wt field and never looked at age.
  const p = page().set('g-mo', 6);
  is(p.d.getElementById('g-bw-boxes').style.display, 'grid', 'box now shown:');
  is(p.text('g-tbw'), '7 kg', 'APLS estimate for 6 months:');
  is(p.text('g-tbw-note'), 'kg · APLS estimate', 'clearly labelled as an estimate, not "(entered)":');
});

test('F31: the estimate reaches the drugs and LA tabs as a hint, never as a value', () => {
  // These tabs have no age input of their own and previously showed nothing.
  // The estimate must not be written into the field as if it were user-typed —
  // F1 and F4 exist specifically to keep "measured" and "estimated" weight
  // distinguishable, and these fields drive real dosing math.
  const p = page().set('g-mo', 6);
  is(p.val('dd-wt'), '', 'not silently filled in:');
  is(p.attr('dd-wt', 'placeholder'), '~7', 'shown as a placeholder instead:');
  if (!/~7 kg from age \(APLS estimate\)/.test(p.text('dd-wt-est-note'))) {
    throw new Error(`drugs-tab hint missing: ${p.text('dd-wt-est-note')}`);
  }
  is(p.val('la-wt'), '', 'LA tab not silently filled in either:');
  is(p.attr('la-wt', 'placeholder'), '~7');
  if (!/~7 kg from age \(APLS estimate\)/.test(p.text('la-wt-est-note'))) {
    throw new Error(`LA-tab hint missing: ${p.text('la-wt-est-note')}`);
  }
});

test('F31: an actual weight overrides the estimate everywhere and clears the hints', () => {
  const p = page().set('g-mo', 6).set('pd-wt', 8.2);   // typed on the paed tab
  is(p.val('g-wt'), '8.2', 'backpopulated to the home card:');
  is(p.text('g-tbw'), '8 kg');
  is(p.text('g-tbw-note'), 'kg (entered)', 'no longer labelled an estimate:');
  is(p.val('dd-wt'), '8.2', 'now filled with the real value:');
  is(p.text('dd-wt-est-note'), '', 'hint cleared:');
  is(p.val('la-wt'), '8.2');
  is(p.text('la-wt-est-note'), '');
});

test('F31: an adult age produces no phantom estimate or hint (F1 preserved)', () => {
  const p = page().set('g-yr', 40);
  is(p.d.getElementById('g-bw-boxes').style.display, 'none', 'box stays hidden:');
  is(p.attr('dd-wt', 'placeholder'), '70', 'default placeholder, not an APLS guess:');
  is(p.text('dd-wt-est-note'), '');
  is(p.attr('la-wt', 'placeholder'), '70');
  is(p.text('la-wt-est-note'), '');
});

test('F31: clearing the age removes the estimate and restores the default hint', () => {
  const p = page().set('g-mo', 6);
  is(p.attr('dd-wt', 'placeholder'), '~7');
  p.set('g-mo', '');
  is(p.d.getElementById('g-bw-boxes').style.display, 'none', 'box hides again, as if nothing had been entered:');
  is(p.attr('dd-wt', 'placeholder'), '70', 'placeholder reset:');
  is(p.text('dd-wt-est-note'), '', 'hint cleared:');
});

test('F31: height now backpopulates from the drugs tab to the home card and out to LA', () => {
  // Weight already did this (backpopulateWeight); height had no equivalent, so
  // a height typed on one tab never reached any other.
  const p = page().set('dd-ht', 165);
  is(p.val('g-ht'), '165', 'reaches the home card:');
  is(p.val('la-ht'), '165', 'and fans back out to the LA tab:');
});

test('F31: height backpopulates from the LA tab too, and does not clobber an existing value', () => {
  const p = page().set('g-ht', 180);
  p.set('la-ht', 165);              // home already has a height — must not be overwritten
  is(p.val('g-ht'), '180', 'home card height is untouched:');
});

test('F31: DOB on the home card flows through to age, weight estimate, and every tab', () => {
  // The full chain the user asked to have checked: DOB -> age (home + paed) ->
  // estimated weight (home box) -> hint on the tabs with no age input.
  const p = page();
  const el = p.d.getElementById('g-dob');
  const today = new Date();
  const dob = new Date(today.getFullYear() - 3, today.getMonth(), today.getDate());
  const iso = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  el.value = iso(dob);
  el.dispatchEvent(new p.W.Event('input', { bubbles: true }));   // g-dob is wired to oninput, not onchange

  is(p.val('g-yr'), '3', 'age reaches the home card:');
  is(p.val('pd-yr'), '3', 'and the paediatric tab:');
  is(p.d.getElementById('g-bw-boxes').style.display, 'grid', 'weight box now shown from age alone:');
  is(p.text('g-tbw-note'), 'kg · APLS estimate');
  if (p.attr('dd-wt', 'placeholder') === '70') throw new Error('drugs-tab hint did not pick up the DOB-derived age');
});

test('F31: an actual weight typed on the home card reaches every tab (forward direction)', () => {
  const p = page().set('g-wt', 82).set('g-ht', 178).change('g-sex', 'f');
  is(p.val('dd-wt'), '82'); is(p.val('pd-wt'), '82'); is(p.val('la-wt'), '82');
  is(p.val('dd-ht'), '178'); is(p.val('la-ht'), '178');
  is(p.val('la-sex'), 'f');
});

test('F31: getPdWt is no longer a second copy of the weight-selection logic', () => {
  // getPdWt() used to reimplement "actual, else APLS estimate" by hand instead
  // of calling the shared paedWeight(). Same behaviour, checked here so a
  // future edit to one can't silently diverge from the other.
  const p = page().set('pd-yr', 3);
  is(p.text('pd-wt-used'), '14.0 kg');
  p.set('pd-wt', 16);
  is(p.text('pd-wt-used'), '16.0 kg');
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

/* ------------- the <script src> itself, loaded the way a browser does ------ */

function loadsModuleForReal() {
  return new Promise((resolve) => {
    const dom = new JSDOM(HTML, {
      runScripts: 'dangerously',
      resources: 'usable',
      url: 'file://' + path.join(__dirname, '..', 'index.html')
    });
    let done = false;
    const timer = setTimeout(() => {
      if (done) return;
      done = true;
      fail++;
      console.log('  FAIL  the real <script src> never fired load');
      resolve();
    }, 60000);

    dom.window.addEventListener('load', () => {
      if (done) return;
      done = true;
      clearTimeout(timer);          // otherwise it fires later and logs a phantom failure
      try {
        const W = dom.window, d = W.document;
        if (typeof W.Calc !== 'object') throw new Error('window.Calc was not defined by the <script src>');
        if (typeof W.Calc.aplsWeight !== 'function') throw new Error('Calc.aplsWeight missing');
        // and the page actually works off it
        const el = d.getElementById('pd-yr');
        el.value = '3';
        el.dispatchEvent(new W.Event('input', { bubbles: true }));
        if (d.getElementById('pd-apls-wt').textContent !== '14 kg') {
          throw new Error(`page did not compute from the module: ${d.getElementById('pd-apls-wt').textContent}`);
        }
        pass++;
      } catch (e) { fail++; console.log(`  FAIL  the real <script src> loads and drives the page\n        ${e.message}`); }
      dom.window.close();           // release jsdom's timers so node can exit
      resolve();
    });
  });
}

loadsModuleForReal().then(() => {
  console.log(`\n${pass} passed, ${fail} failed`);
  if (fail) { console.log('FAIL'); process.exit(1); }
  console.log('PASS');
});
