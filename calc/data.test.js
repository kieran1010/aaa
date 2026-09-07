/*
 * data.test.js — assertions against the drug data in index.html itself.
 *
 * Run: node calc/data.test.js
 *
 * Same convention as calculators.test.js: test() pins behaviour and must pass,
 * pending() encodes a target for an open finding and is expected to fail.
 */
'use strict';
const D = require('./data.js');

let pass = 0, fail = 0, pend = 0, pendUnexpected = [];
function test(name, fn) {
  try { fn(); pass++; } catch (e) { fail++; console.log(`  FAIL  ${name}\n        ${e.message}`); }
}
function pending(id, name, fn) {
  try { fn(); pend++; pendUnexpected.push(`${id} — ${name}`); } catch (e) { pend++; }
}
function is(a, b, m) { if (a !== b) throw new Error(`${m || ''} expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`); }

/* -- the general lint: a "Max N" in prose must be backed by a maxDose field -- */

// Matches "Max 15 mg", "max 0.5 mg", "Max 150mcg", "max 6 mg 1st dose".
const MAX_IN_PROSE = /\bmax(?:imum)?\.?\s+([\d.]+)\s*(mg|mcg|g|units)\b/i;

function notesClaimingAMax(drugs, noteKey) {
  return drugs.filter(d => MAX_IN_PROSE.test(d[noteKey] || ''));
}
function unenforced(drugs, noteKey) {
  return notesClaimingAMax(drugs, noteKey).filter(d =>
    d.maxDose == null &&
    d.maxDoseFn == null &&
    // IV paracetamol's 1000 mg cap is applied by the paracetamolIV branch in
    // calcPaed rather than by a maxDose field. Genuinely enforced, so exempt.
    d.paracetamolIV !== true);
}

test('LINT: the paediatric max-dose lint is wired up and sees the data', () => {
  const claiming = notesClaimingAMax(D.PD_DRUGS, 'note');
  if (claiming.length < 10) throw new Error(`lint matched only ${claiming.length} notes — regex is probably broken`);
});

test('FIXED F3: every paediatric "Max N" in prose has a maxDose field', () => {
  const bad = unenforced(D.PD_DRUGS, 'note');
  if (bad.length) throw new Error(`${bad.length} unenforced: ${bad.map(d => `${d.n} (${d._cat})`).join(', ')}`);
});

test('FIXED F3: the caps bite at realistic weights', () => {
  const cap = (name, wt) => {
    const d = D.PD_DRUGS.find(x => x.n === name);
    const raw = parseFloat(d.doseStr) * wt;
    return d.maxDose != null ? Math.min(raw, d.maxDose) : raw;
  };
  is(cap('Suxamethonium (IV)', 100), 150, '100 kg adolescent, was 200 mg:');
  is(cap('Ondansetron', 45), 4, '45 kg, was 6.75 mg:');
  is(cap('Adrenaline', 60), 0.5, '60 kg IM, was 0.6 mg:');
  is(cap('Adrenaline (arrest)', 150), 1, 'was 1.5 mg:');
  is(cap('Atropine', 40), 500, '40 kg reversal (mcg), was 800 mcg:');
  is(cap('Midazolam', 40), 15, 'was 20 mg:');
  is(cap('Neostigmine', 120), 5000, 'was 6000 mcg:');
  is(cap('Cyclizine', 60), 50, 'was 60 mg:');
});

test('FIXED F3: caps do not fire below the threshold', () => {
  const dose = (name, wt) => {
    const d = D.PD_DRUGS.find(x => x.n === name);
    return Math.min(parseFloat(d.doseStr) * wt, d.maxDose);
  };
  is(dose('Ondansetron', 20), 3, '20 kg child is under the 4 mg cap:');
  is(dose('Adrenaline', 20), 0.2, '20 kg IM anaphylaxis:');
  is(dose('Midazolam', 10), 5, '10 kg premed:');
});
pending('F3', 'every adult "Max N" in prose must have a maxDose field', () => {
  const bad = unenforced(D.ADULT_DRUGS, 'notes');
  if (bad.length) throw new Error(`${bad.length} unenforced: ${bad.map(d => d.name).join(', ')}`);
});

test('drugs that DO enforce their cap keep doing so', () => {
  const enforced = ['Clonidine', 'Ketamine', 'Fentanyl', 'Morphine', 'Ibuprofen',
                    'Paracetamol (load)', 'Paracetamol (maintenance)', 'Tramadol', 'Amiodarone'];
  enforced.forEach(n => {
    const d = D.PD_DRUGS.find(x => x.n === n);
    if (d && d.maxDose == null) throw new Error(`${n} lost its maxDose`);
  });
});

/* ------------------------------- F2: adenosine --------------------------- */

test('FIXED F2: adult adenosine is the fixed 6 mg / 12 mg SVT dose', () => {
  const a = D.ADULT_DRUGS.find(d => d.name === 'Adenosine');
  is(a.bolusUnit, 'mg (fixed)', 'no longer per-kg:');
  is(a.bolusLo, 6);
  is(a.bolusHi, 12);
  if (!/NOT the 0\.3-0\.6 mg\/kg neurosurgical flow-arrest dose/.test(a.notes)) {
    throw new Error('the note should say explicitly that this is not the flow-arrest dose');
  }
});

test('FIXED F2: adenosine now agrees with the Tachycardia page', () => {
  const a = D.ADULT_DRUGS.find(d => d.name === 'Adenosine');
  if (!/Adenosine 6\s*mg rapid IV bolus/.test(D.SRC)) throw new Error('Tachycardia page changed');
  is(a.bolusLo, 6, 'table first dose matches the algorithm page:');
});

test('FIXED F12: IM adrenaline offers 1:1000 first', () => {
  const a = D.PD_DRUGS.find(d => d.n === 'Adrenaline');
  is(a.concs[0].c, '1:1000 (1 mg/mL)');
  is(a.concs[0].mgml, 1);
});

test('paediatric adenosine is correct at 0.1 mg/kg', () => {
  const a = D.PD_DRUGS.find(d => d.n === 'Adenosine');
  is(a.doseStr, '0.1'); is(a.unit, 'mg/kg');
});

test('the app states the SVT dose correctly on its Tachycardia page', () => {
  if (!/Adenosine 6\s*mg rapid IV bolus/.test(D.SRC)) throw new Error('Tachycardia page text changed');
});

/* --------------------- internal consistency across tabs ------------------ */

test('CURRENT: the two opioid tools disagree (F6)', () => {
  const conv = k => 10 / D.OPIOIDS.find(o => o.key === k).equiv;
  const om   = n => D.OMEDD_DRUGS.find(o => o.name === n).factor;
  const near = (a, b) => Math.abs(a - b) / b <= 0.05;
  if (near(conv('iv_fentanyl'), om('IV/SC fentanyl'))) throw new Error('expected fentanyl to still disagree');
  if (near(conv('iv_oxycodone'), om('IV/SC oxycodone'))) throw new Error('expected oxycodone to still disagree');
});
pending('F6', 'the two opioid tools must use the same factor for every shared drug', () => {
  const pairs = [['po_morphine','Oral morphine'],['po_oxycodone','Oral oxycodone'],
                 ['po_hydromorphone','Oral hydromorphone'],['po_codeine','Oral codeine'],
                 ['po_tramadol','Oral tramadol'],['po_tapentadol','Oral tapentadol'],
                 ['iv_morphine','IV/SC morphine'],['iv_oxycodone','IV/SC oxycodone'],
                 ['iv_fentanyl','IV/SC fentanyl']];
  const bad = pairs.filter(([k, n]) => {
    const a = 10 / D.OPIOIDS.find(o => o.key === k).equiv;
    const b = D.OMEDD_DRUGS.find(o => o.name === n).factor;
    return Math.abs(a - b) / b > 0.05;
  });
  if (bad.length) throw new Error(`disagree: ${bad.map(p => p[1]).join(', ')}`);
});

pending('F7', 'the oMEDD footnote must match the oMEDD code', () => {
  const bup = D.OMEDD_DRUGS.find(o => o.name === 'Buprenorphine patch').factor;
  const m = D.SRC.match(/Buprenorphine patch \(mcg\/hr\)\s*&times;\s*([\d.]+)|Buprenorphine patch \(mcg\/hr\)\s*×\s*([\d.]+)/);
  if (!m) throw new Error('footnote not found');
  const shown = parseFloat(m[1] || m[2]);
  if (Math.abs(shown - bup) > 1e-9) throw new Error(`footnote says ${shown}, code uses ${bup}`);
});

test('CURRENT: methadone is absent from the oMEDD list (F8)', () => {
  is(D.OMEDD_DRUGS.some(o => /methadone/i.test(o.name)), false);
});

/* ------------------- concentration / unit sanity across paeds ------------- */

test('every paediatric concentration is a positive number or explicitly null', () => {
  D.PD_DRUGS.forEach(d => d.concs.forEach(c => {
    if (c.mgml !== null && !(typeof c.mgml === 'number' && c.mgml > 0)) {
      throw new Error(`${d.n}: bad concentration ${JSON.stringify(c)}`);
    }
  }));
});

test('every paediatric drug has a unit and a parseable dose', () => {
  D.PD_DRUGS.forEach(d => {
    if (d.doseStr === 'wt' || d.doseStr === '4-2-1') return;   // special-cased rows
    if (isNaN(parseFloat(d.doseStr))) throw new Error(`${d.n}: unparseable doseStr "${d.doseStr}"`);
    if (!d.unit) throw new Error(`${d.n}: missing unit`);
  });
});

test('CURRENT: the maintenance row has no unit (F9)', () => {
  is(D.PD_DRUGS.find(d => d.n === 'Maintenance').unit, '');
});

test('antibiotic maxima are all present and positive', () => {
  D.ABX_DATA.forEach(d => {
    if (d.doseWt && d.maxDose == null && d.maxDoseFn == null) {
      throw new Error(`${d.name}: weight-based with no cap`);
    }
  });
});

console.log(`\n${pass} passed, ${fail} failed, ${pend} pending (expected to fail — open findings)`);
if (pendUnexpected.length) {
  console.log('\nPending tests that unexpectedly PASSED — promote them to test():');
  pendUnexpected.forEach(n => console.log(`  ${n}`));
}
if (fail) { console.log('\nFAIL'); process.exit(1); }
console.log('PASS');
