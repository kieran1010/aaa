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
const fs = require('fs');
const path = require('path');
// Calculation logic and the ANZCA table now live here, not in index.html.
const MODULE_SRC = fs.readFileSync(path.join(__dirname, 'calculators.js'), 'utf8');

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
test('FIXED F3: every adult "Max N" in prose has a maxDose field', () => {
  const bad = unenforced(D.ADULT_DRUGS, 'notes');
  if (bad.length) throw new Error(`${bad.length} unenforced: ${bad.map(d => d.name).join(', ')}`);
});

test('FIXED F3: the adult caps bite', () => {
  const pcc = D.ADULT_DRUGS.find(d => d.name === 'PCC (Octaplex/Beriplex)');
  is(pcc.maxDose, 3000, 'PCC was uncapped — 50 units/kg at 90 kg is 4500 units:');
  is(Math.min(50 * 90, pcc.maxDose), 3000);
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

// ANZCA FPM PS01(PM) Appendix 2, October 2025 — transcribed from the PDF.
const ANZCA_PRIMARY = {
  'Oral Morphine': 1, 'Oral Oxycodone': 1.5, 'Oral Hydromorphone': 5,
  'Oral Codeine': 0.13, 'Oral Dextropropoxyphene': 0.1, 'Oral Tramadol': 0.2,
  'Oral Tapentadol': 0.3, 'Sublingual Buprenorphine': 40, 'Rectal Oxycodone': 1.5,
  'Transdermal Buprenorphine': 2, 'Transdermal Fentanyl': 3,
  'Parenteral Morphine': 3, 'Parenteral Oxycodone': 3, 'Parenteral Hydromorphone': 15,
  'Parenteral Codeine': 0.25, 'Parenteral Pethidine': 0.4, 'Parenteral Fentanyl': 0.2,
  'Parenteral Sufentanil': 2
};

test('FIXED F6: index.html carries the ANZCA table verbatim', () => {
  is(D.ANZCA_OPIOIDS.length, Object.keys(ANZCA_PRIMARY).length, 'preparation count:');
  D.ANZCA_OPIOIDS.forEach(o => {
    const name = o.route + ' ' + o.drug;
    if (!(name in ANZCA_PRIMARY)) throw new Error(`${name} is not in the ANZCA table`);
    is(o.factor, ANZCA_PRIMARY[name], `${name}:`);
  });
});

test('FIXED F6: both tools are derived from it, so they cannot diverge', () => {
  D.ANZCA_OPIOIDS.forEach(o => {
    const conv = 10 / D.OPIOIDS.find(x => x.key === o.key).equiv;
    const om   = D.OMEDD_DRUGS.find(x => x.name === o.route + ' ' + o.drug).factor;
    if (Math.abs(conv - o.factor) > 1e-9) throw new Error(`${o.drug}: conversion tab ${conv} vs ${o.factor}`);
    if (Math.abs(om - o.factor) > 1e-9)   throw new Error(`${o.drug}: oMEDD tab ${om} vs ${o.factor}`);
  });
});

test('FIXED F6: neither tool stores its own factor list any more', () => {
  if (/const OPIOIDS = \[\s*\{ key:/.test(D.SRC)) throw new Error('conversion tab still has a hard-coded list');
  if (/var OMEDD_DRUGS = \[\s*\{name:/.test(D.SRC)) throw new Error('oMEDD tab still has a hard-coded list');
  is((MODULE_SRC.match(/var ANZCA_OPIOIDS =/g) || []).length, 1, 'one table, in the module:');
  is((D.SRC.match(/ANZCA_OPIOIDS\s*=\s*\[/g) || []).length, 0, 'and not a second copy in index.html:');
});

test('FIXED F6: the source and date are stated on screen', () => {
  if (!/ANZCA FPM PS01\(PM\) Appendix 2, October 2025/.test(MODULE_SRC)) {
    throw new Error('the table is not attributed in the module');
  }
  if (!/ANZCA_SOURCE/.test(D.SRC)) throw new Error('index.html does not render the attribution');
});

test('the take-home naloxone threshold is present', () => {
  if (!/THN_THRESHOLD_OMEDD = 40/.test(MODULE_SRC)) throw new Error('THN threshold missing from the module');
  if (!/take-home naloxone/i.test(D.SRC)) throw new Error('THN prompt text missing from the page');
});

test('methadone is absent from the oMEDD list, as ANZCA intends (F8)', () => {
  is(D.OMEDD_DRUGS.some(o => /methadone/i.test(o.name)), false);
  if (!/Methadone is not included/.test(D.SRC)) throw new Error('the exclusion is not stated');
});

/* ---- the adult table must agree with the app's own emergency algorithms ---- */

// Every row here was a real disagreement found in the audit (F10, F11, F17,
// F18, F21). The emergency pages were the better-sourced side each time, so
// these assert the table has been brought into line and stays there.
test('FIXED F18: atropine maximum is the ANZCOR 3 mg, in both places', () => {
  const a = D.ADULT_DRUGS.find(d => d.name === 'Atropine');
  if (/max\s*6\s*mg/i.test(a.notes)) throw new Error(`table still says 6 mg: ${a.notes}`);
  if (!/3 mg/.test(a.notes)) throw new Error(`table does not state 3 mg: ${a.notes}`);
  if (/repeat to max 6 mg/i.test(D.SRC)) throw new Error('Bradycardia page still says 6 mg');
});

test('FIXED F10: aminophylline load is 5 mg/kg, matching the Bronchospasm page', () => {
  const a = D.ADULT_DRUGS.find(d => d.name === 'Aminophylline');
  is(a.bolusLo, 5, 'was 10 mg/kg (700 mg at 70 kg vs the page\'s 400 mg):');
  is(a.maxDose, 500);
});

test('FIXED F17: IV salbutamol is ~250 mcg, matching the Bronchospasm page', () => {
  const a = D.ADULT_DRUGS.find(d => d.name === 'Salbutamol');
  is(a.bolusLo, 4, 'was 10 mcg/kg = 700 mcg at 70 kg:');
  is(a.maxDose, 250);
});

test('FIXED F17: esmolol load is 0.5-1 mg/kg', () => {
  const e = D.ADULT_DRUGS.find(d => d.name === 'Esmolol');
  is(e.bolusLo, 0.5); is(e.bolusHi, 1);
});

test('FIXED F17: ephedrine is titrated in mg, not dosed per kg', () => {
  const e = D.ADULT_DRUGS.find(d => d.name === 'Ephedrine');
  if (e.bolusUnit.indexOf('/kg') !== -1) throw new Error(`still per-kg: ${e.bolusUnit}`);
  is(e.bolusHi, 9, 'matches the 9 mg on the Hypotension and Bradycardia pages:');
});

test('FIXED F17: metoprolol values match their own note', () => {
  const m = D.ADULT_DRUGS.find(d => d.name === 'Metoprolol');
  is(m.bolusLo, 2.5); is(m.bolusHi, 15);
});

test('FIXED F21: the propofol infusion range matches its own note', () => {
  const p = D.ADULT_DRUGS.find(d => d.name === 'Propofol');
  is(p.infLo, 50); is(p.infHi, 150);
  const m = p.notes.match(/TIVA (\d+)-(\d+)/);
  if (!m) throw new Error('note no longer states a TIVA range');
  is(p.infLo, parseInt(m[1], 10), 'range vs note, low:');
  is(p.infHi, parseInt(m[2], 10), 'range vs note, high:');
});

test('FIXED F11: the sugammadex note has the block depths the right way round', () => {
  const n = D.PD_DRUGS.find(d => d.n === 'Sugammadex').note;
  if (/Deep: 16/.test(n)) throw new Error('still says deep = 16 mg/kg');
  if (!/[Mm]oderate.*2 mg\/kg/.test(n)) throw new Error(`moderate should be 2 mg/kg: ${n}`);
  if (!/deep.*4 mg\/kg/.test(n))        throw new Error(`deep should be 4 mg/kg: ${n}`);
  if (!/16 mg\/kg/.test(n))             throw new Error('16 mg/kg rescue dose missing');
});

test('FIXED F7: the footnote is generated from the table, not hand-written', () => {
  if (/Conversion factors: Oral morphine 1/.test(D.SRC)) throw new Error('hand-written footnote remains');
  if (!/function renderOmeddFactors/.test(D.SRC)) throw new Error('footnote renderer missing');
  if (!/id="omedd-factors"/.test(D.SRC)) throw new Error('footnote element missing');
});

test('FIXED F8: the oMEDD tab says methadone is excluded', () => {
  if (!/Methadone is not included/.test(D.SRC)) throw new Error('exclusion notice missing');
  if (!/Reduce by 25&ndash;50% when rotating/.test(D.SRC)) throw new Error('cross-tolerance warning missing');
});

test('FIXED F26: IM ketamine offers a concentration that gives a usable volume', () => {
  const k = D.PD_DRUGS.find(d => d.n === 'Ketamine (IM)');
  const vol = 5 * 20 / k.concs[0].mgml;      // 5 mg/kg for a 20 kg child
  if (vol > 3) throw new Error(`${vol} mL IM at ${k.concs[0].c} — was 10 mL at 10 mg/mL`);
});

test('FIXED F22: every regional block LA volume carries the max-dose caveat', () => {
  if (!/const LA_CAVEAT/.test(D.SRC)) throw new Error('LA_CAVEAT not defined');
  if (!/laCaveat\(b\.la\)/.test(D.SRC)) throw new Error('caveat not applied in the block renderer');
});

test('FIXED F23: dantrolene and Intralipid follow the patient weight', () => {
  ['mh-dantrolene-calc', 'last-bolus-calc', 'last-inf-calc'].forEach(id => {
    if (!new RegExp('id="' + id + '"').test(D.SRC)) throw new Error(`${id} placeholder missing`);
  });
  if (!/function updateEmergencyWeightDoses/.test(D.SRC)) throw new Error('recalculation missing');
  if (!/updateEmergencyWeightDoses\(\);/.test(D.SRC)) throw new Error('never called');
});

test('FIXED F14/F19: one shared body-weight implementation, in the module', () => {
  ['devineIBW', 'adjustedBW', 'janmahasatianLBW'].forEach(fn => {
    is((MODULE_SRC.match(new RegExp('function ' + fn + '\\b', 'g')) || []).length, 1, `${fn} in the module:`);
    is((D.SRC.match(new RegExp('function ' + fn + '\\b', 'g')) || []).length, 0, `${fn} not also in index.html:`);
  });
  if (/var lbwM = rnd\(\(9270/.test(D.SRC)) throw new Error('an inline LBW copy remains');
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
    if (!d.unit) throw new Error(`${d.n}: missing unit`);
    if (d.doseStr === 'wt' || d.doseStr === '4-2-1') return;   // special-cased rows
    if (isNaN(parseFloat(d.doseStr))) throw new Error(`${d.n}: unparseable doseStr "${d.doseStr}"`);
    if (!d.unit) throw new Error(`${d.n}: missing unit`);
  });
});

test('FIXED F9: the maintenance row carries a unit', () => {
  const m = D.PD_DRUGS.find(d => d.n === 'Maintenance');
  is(m.unit, 'mL/hr', 'was empty, so the rate rendered as a bare number:');
  is(m.doseStr, '4-2-1');
  if (!/Holliday-Segar/.test(m.note)) throw new Error('note should name the rule');
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
