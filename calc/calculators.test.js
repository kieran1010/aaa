/*
 * calculators.test.js — no framework, no install. Run: node calc/calculators.test.js
 *
 * Two kinds of test:
 *   test()    asserts CURRENT behaviour. These must always pass. They are the
 *             safety net: if a fix changes something it should not have, one of
 *             these breaks.
 *   pending() asserts the TARGET behaviour for an open finding. These are
 *             EXPECTED TO FAIL today. Each names its finding ID. As a fix lands,
 *             promote the pending() to test() and delete the stale current-
 *             behaviour assertion it replaces.
 *
 * Every number here was derived by executing the application's own logic.
 */
'use strict';
const C = require('./calculators.js');

let pass = 0, fail = 0, pend = 0, pendUnexpected = [];
const near = (a, b, tol) => Math.abs(a - b) <= (tol == null ? 1e-9 : tol);

function test(name, fn) {
  try { fn(); pass++; }
  catch (e) { fail++; console.log(`  FAIL  ${name}\n        ${e.message}`); }
}
function pending(id, name, fn) {
  try { fn(); pend++; pendUnexpected.push(`${id} — ${name}`); }
  catch (e) { pend++; }
}
// eq(actual, expected, tolerance?, message?) — tolerance defaults to exact-ish
function eq(a, b, tol, msg) {
  if (typeof tol === 'string') { msg = tol; tol = undefined; }
  if (!near(a, b, tol)) throw new Error(`${msg || ''} expected ${b}${tol ? ' +/- ' + tol : ''}, got ${a}`);
}
function is(a, b, msg) { if (a !== b) throw new Error(`${msg || ''} expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`); }

/* ============================ paediatric weight ========================== */

test('APLS matches the published 2011 formulae (Addendum B.1)', () => {
  eq(C.aplsWeight(6),   7,  '6 months:');     // 0.5*6 + 4
  eq(C.aplsWeight(12),  10, '1 year:');       // 2*1 + 8
  eq(C.aplsWeight(36),  14, '3 years:');      // 2*3 + 8
  eq(C.aplsWeight(60),  18, '5 years:');      // 2*5 + 8
  eq(C.aplsWeight(72),  25, '6 years:');      // 3*6 + 7
  eq(C.aplsWeight(144), 43, '12 years:');     // 3*12 + 7
});

test('APLS returns null below 3 months', () => {
  is(C.aplsWeight(0), null);
  is(C.aplsWeight(2), null);
  eq(C.aplsWeight(3), 5.5);
});

test('17 months in the months field is handled correctly ARITHMETICALLY', () => {
  eq(C.paedWeight(0, 17, null), 10.8);        // 2*(17/12 + 4)
  eq(C.paedWeight(1, 5, null),  10.8);        // same age, split differently
});

test('CURRENT: adult ages return a paediatric weight (F1)', () => {
  eq(C.aplsWeight(40 * 12), 127);
  eq(C.aplsWeight(85 * 12), 262);
  is(C.aplsFormula(40 * 12), 'adult', 'label says adult while weight is paediatric:');
});
pending('F1', 'aplsWeight should refuse ages above 12 years', () => {
  is(C.aplsWeight(13 * 12), null);
  is(C.aplsWeight(40 * 12), null);
});

test('CURRENT: 5-6 year olds get the 6-12y formula (F20)', () => {
  eq(C.aplsWeight(66), 23.5, '5.5 years:');
});
pending('F20', '5-6y should not be over-estimated by the 6-12y formula', () => {
  const w = C.aplsWeight(66);
  if (w > 21) throw new Error(`5.5y estimated at ${w} kg; APLS 1-5y band gives 19 kg`);
});

test('formatPaedAge normalisation (F24)', () => {
  is(C.formatPaedAge(0, 17, 17), '17m', 'CURRENT:');
  is(C.formatPaedAge(1, 17, 29), '1y 17m', 'CURRENT:');
  is(C.formatPaedAge(1, 5, 17), '1y 5m', 'already correct when entered normally:');
});
pending('F24', 'age display should normalise months into years', () => {
  is(C.formatPaedAge(0, 17, 17), '1y 5m');
});

/* ================================ age / DOB ============================== */

test('CURRENT: DOB borrow is swallowed (F15)', () => {
  const a = C.ageFromDOB(new Date(2020, 2, 15), new Date(2026, 2, 10));
  is(a.years, 6);  is(a.months, 0);           // true age is 5y 11m
  const b = C.ageFromDOB(new Date(2025, 5, 20), new Date(2026, 5, 10));
  is(b.years, 1);  is(b.months, 0);           // true age is 0y 11m — crosses the APLS band
});
pending('F15', 'DOB should borrow from the year correctly', () => {
  const a = C.ageFromDOB(new Date(2020, 2, 15), new Date(2026, 2, 10));
  is(a.years, 5); is(a.months, 11);
});

test('CURRENT: a future DOB yields a negative age (F15)', () => {
  const a = C.ageFromDOB(new Date(2030, 0, 1), new Date(2026, 8, 5));
  if (a.years >= 0) throw new Error('expected a negative year');
});
pending('F15', 'a future DOB should be rejected', () => {
  is(C.ageFromDOB(new Date(2030, 0, 1), new Date(2026, 8, 5)), null);
});

/* ============================== body weights ============================= */

test('Devine and Janmahasatian at a reference patient', () => {
  eq(C.devineIBW(180, 'm'), 75, 0.1);
  eq(C.devineIBW(165, 'f'), 56.9, 0.1);
  eq(C.lbw(80, 180, 'm'), 61.6, 0.5);
});

test('CURRENT: the two ABW variants disagree when TBW < IBW (F14)', () => {
  eq(C.abw(45, 170, 'f', false), 45, 0.1, 'patient card:');
  eq(C.abw(45, 170, 'f', true),  61.2, 0.5, 'drugs tab returns IBW > patient:');
});
pending('F14', 'ABW should never exceed the patient', () => {
  const v = C.abw(45, 170, 'f', true);
  if (v > 45) throw new Error(`ABW ${v} kg exceeds TBW 45 kg`);
});

test('CURRENT: Devine clamps to 0 below its valid range (F19)', () => {
  eq(C.devineIBW(100, 'f'), 0);
  eq(C.devineIBW(100, 'm'), 2.6, 0.1);
});
pending('F19', 'Devine should refuse heights below ~152 cm', () => {
  is(C.devineIBW(100, 'f'), null);
});

/* ============================== LA toxicity ============================== */

test('LA maxima are the standard ceilings', () => {
  eq(C.laMaxDose('lig', 70), 200, 0, 'lignocaine capped at 200 mg:');
  eq(C.laMaxDose('lig', 50), 150, 0, '3 mg/kg below the ceiling:');
  eq(C.laMaxDose('bupi', 100), 150, 0, 'bupivacaine capped at 150 mg:');
  eq(C.laMaxDose('ligadr', 50), 350, 0);
});

test('CURRENT: IBW overrides actual weight in underweight adults (F4)', () => {
  eq(C.laWeightUsed(170, 45, 'f'), 61.4, 0.1);
  eq(C.laWeightUsed(175, 50, 'm'), 70.5, 0.1);
  eq(C.laMaxDose('lig', C.laWeightUsed(170, 45, 'f')), 184.2, 0.1);
});
pending('F4', 'LA weight should be min(IBW, TBW)', () => {
  eq(C.laWeightUsed(170, 45, 'f'), 45, 0.1);
  eq(C.laMaxDose('lig', C.laWeightUsed(170, 45, 'f')), 135, 0.1);
});

test('IBW is conservative in obesity, as intended', () => {
  eq(C.laWeightUsed(160, 90, 'f'), 52.4, 0.1);
});

test('falls back to actual weight when sex is not given', () => {
  eq(C.laWeightUsed(170, 45, ''), 45);
});

test('cumulative toxicity fraction is additive and sound', () => {
  const r = C.cumulativeToxicFraction(
    [{ key: 'lig', concPct: 1, volMl: 10 }, { key: 'bupi', concPct: 0.5, volMl: 10 }], 70);
  eq(r.rows[0].dose, 100, 0, 'lignocaine 10 mL of 1% = 100 mg:');
  eq(r.rows[0].frac, 0.5, 0.001, '100/200:');
  eq(r.rows[1].dose, 50, 0);
  eq(r.rows[1].frac, 50 / 140, 0.001);
  eq(r.total, 0.5 + 50 / 140, 0.001);
  eq(r.rows[0].safeVolRemainingMl, r.remaining * 200 / 10, 0.001);
});

/* ============================= paediatric dosing ========================= */

test('CURRENT: 4-2-1 maintenance returns a flat 4 mL/kg/hr (F9)', () => {
  eq(C.calcDose('4-2-1', 20).lo, 80, 0, 'should be 60:');
  eq(C.calcDose('4-2-1', 45).lo, 180, 0, 'should be 85:');
  eq(C.calcDose('4-2-1', 10).lo, 40, 0, 'coincidentally right at 10 kg:');
});
pending('F9', '4-2-1 should be implemented as the Holliday-Segar rule', () => {
  eq(C.calcDose('4-2-1', 20).lo, 60, 0);
  eq(C.calcDose('4-2-1', 45).lo, 85, 0);
});

test('CURRENT: a maxDose field is honoured; a note is not (F3)', () => {
  eq(C.applyMaxDose({ lo: 300, hi: 300 }, 200).hi, 200, 0, 'field present:');
  eq(C.applyMaxDose({ lo: 300, hi: 300 }, null).hi, 300, 0, 'note-only max ignored:');
});
pending('F3', 'suxamethonium IV should cap at its stated 150 mg', () => {
  eq(C.applyMaxDose(C.calcDose('2', 100), null).hi, 150, 0);
});

test('paracetamol IV weight bands and the 1 g cap', () => {
  eq(C.paracetamolIVDose(4),  30,   0, '<5 kg at 7.5 mg/kg:');
  eq(C.paracetamolIVDose(8),  80,   0, '5-10 kg at 10 mg/kg:');
  eq(C.paracetamolIVDose(20), 300,  0, '>10 kg at 15 mg/kg:');
  eq(C.paracetamolIVDose(80), 1000, 0, 'capped at 1000 mg:');
});

/* ============================ paediatric airway ========================== */

test('LMA sizing matches the classic chart across all bands', () => {
  is(C.lmaSize(4).size, '1');    is(C.lmaSize(4).maxCuff, 4);
  is(C.lmaSize(7).size, '1.5');  is(C.lmaSize(15).size, '2');
  is(C.lmaSize(25).size, '2.5'); is(C.lmaSize(40).size, '3');
  is(C.lmaSize(60).size, '4');   is(C.lmaSize(80).size, '5');
});

test('CURRENT: neonatal ETT is oversized and too deep (F5b)', () => {
  const s = C.airwaySizes(0);
  eq(s.ettUncuffed, 4.0, 0, 'neonate should take 3.0-3.5 mm:');
  eq(s.depthLip, 12, 0, 'neonate should sit at 9-10 cm:');
});
pending('F5', 'neonatal ETT should be 3.0-3.5 mm at 9-10 cm', () => {
  const s = C.airwaySizes(0);
  if (s.ettUncuffed > 3.5) throw new Error(`${s.ettUncuffed} mm too large for a neonate`);
  if (s.depthLip > 10)     throw new Error(`${s.depthLip} cm is endobronchial in a neonate`);
});

test('CURRENT: weight-only entry over-estimates age above 20 kg (F5a)', () => {
  eq(C.airwayAgeFallback(10), 1,  0, 'right at 10 kg:');
  eq(C.airwayAgeFallback(30), 11, 0, 'a 30 kg child is ~7.7y, not 11y:');
  eq(C.airwaySizes(C.airwayAgeFallback(30)).ettUncuffed, 7.0, 0, 'gives 7.0 mm; should be ~6.0:');
});
pending('F5', 'weight-only entry should not oversize the tube', () => {
  const ett = C.airwaySizes(C.airwayAgeFallback(30)).ettUncuffed;
  if (ett > 6.5) throw new Error(`30 kg child offered a ${ett} mm tube`);
});

test('ETT formulae are correct within their valid range', () => {
  eq(C.airwaySizes(4).ettUncuffed, 5.0, 0);
  eq(C.airwaySizes(8).ettUncuffed, 6.0, 0);
  eq(C.airwaySizes(8).ettCuffed,   5.5, 0);
});

/* ================================= opioids =============================== */

test('opioid factors that both tools agree on and that match ANZCA', () => {
  eq(10 / C.OPIOID_EQUIV.po_oxycodone, 1.5, 0.02);
  eq(C.OMEDD_FACTORS['Oral oxycodone'], 1.5);
  eq(10 / C.OPIOID_EQUIV.po_hydromorphone, 5);
  eq(C.OMEDD_FACTORS['Oral hydromorphone'], 5);
  eq(10 / C.OPIOID_EQUIV.iv_morphine, 3, 0.05);
  eq(C.OMEDD_FACTORS['IV/SC morphine'], 3);
});

test('CURRENT: the two tools disagree on IV fentanyl and IV oxycodone (F6)', () => {
  eq(10 / C.OPIOID_EQUIV.iv_fentanyl, 0.2, 0.001, 'conversion tab:');
  eq(C.OMEDD_FACTORS['IV/SC fentanyl'], 0.1, 0, 'oMEDD tab:');
  eq(C.omeddTotal([{ drug: 'IV/SC fentanyl', dose: 600 }]), 60, 0);
  eq(C.toOralMorphine('iv_fentanyl', 600), 120, 0);
});
pending('F6', 'both tools should use one factor for IV fentanyl', () => {
  eq(10 / C.OPIOID_EQUIV.iv_fentanyl, C.OMEDD_FACTORS['IV/SC fentanyl'], 0.001);
});

test('CURRENT: tramadol and tapentadol factors (F28/F29, provisional)', () => {
  eq(C.OMEDD_FACTORS['Oral tramadol'], 0.1);
  eq(C.OMEDD_FACTORS['Oral tapentadol'], 0.4);
});
pending('F28/F29', 'ANZCA gives tramadol 0.2 and tapentadol 0.3 — CONFIRM against PS01(PM) App 2 first', () => {
  eq(C.OMEDD_FACTORS['Oral tramadol'], 0.2);
  eq(C.OMEDD_FACTORS['Oral tapentadol'], 0.3);
});

test('CURRENT: methadone is absent from oMEDD and contributes zero (F8)', () => {
  is(C.OMEDD_FACTORS['Oral methadone'], undefined);
  eq(C.omeddTotal([{ drug: 'Oral methadone', dose: 40 }]), 0, 0, 'silently ignored:');
});

test('CURRENT: methadone conversion does not round-trip (F16)', () => {
  const f = C.methadoneToOMEDD(7.5);
  eq(f.omedd, 30, 0);
  eq(C.omeddToMethadone(f.omedd).methadone, 5, 0.01, '7.5 mg returns as 5 mg:');
  eq(C.omeddToMethadone(C.methadoneToOMEDD(50).omedd).methadone, 33.33, 0.01);
});
pending('F16', 'methadone conversion should round-trip', () => {
  eq(C.omeddToMethadone(C.methadoneToOMEDD(7.5).omedd).methadone, 7.5, 0.5);
});

test('the Ripamonti forward direction matches the on-screen table', () => {
  eq(C.omeddToMethadone(60).methadone, 10, 0.01, '60 mg oMEDD -> 10 mg, as displayed:');
  is(C.omeddToMethadone(20).ratio, 4);
  is(C.omeddToMethadone(60).ratio, 6);
  is(C.omeddToMethadone(200).ratio, 8);
  is(C.omeddToMethadone(400).ratio, 12);
});

test('oMEDD risk thresholds fire at 100 and 200', () => {
  is(C.omeddWarning(99), null);
  is(C.omeddWarning(100), 'high');
  is(C.omeddWarning(200), 'very-high');
});

/* ============================ adult drug dosing ========================== */

test('per-kg boluses, capped where a maxDose exists', () => {
  const a = C.adultBolus(5, 5, 'mg/kg', 70, null);
  eq(a.lo, 350, 0); is(a.unit, 'mg');
  const b = C.adultBolus(15, 30, 'mg/kg', 100, 2000);   // TXA
  eq(b.hi, 2000, 0, 'capped at 2 g:');
});

test('genuinely fixed units are not multiplied by weight', () => {
  is(C.adultBolus(1, 5, 'mg (fixed)', 70, null), null);
  is(C.adultBolus(1, 2, 'g/hr', 70, null), null);
});

test('special per-kg units still calculate', () => {
  eq(C.adultBolus(10, 15, 'mL/kg', 70, null).lo, 700, 0);
  eq(C.adultBolus(50, 100, 'units/kg', 70, null).hi, 7000, 0);
});

test('CURRENT: adenosine carries the flow-arrest dose (F2)', () => {
  eq(C.adultBolus(0.3, 0.5, 'mg/kg', 70, null).lo, 21, 0);
  eq(C.adultBolus(0.3, 0.5, 'mg/kg', 70, null).hi, 35, 0);
});
pending('F2', 'adenosine should be the 6 mg / 12 mg SVT dose', () => {
  const d = C.adultBolus(0.3, 0.5, 'mg/kg', 70, null);
  if (d && d.hi > 12) throw new Error(`${d.hi} mg — ANZCOR gives 6 then 12 mg`);
});

test('antibiotic dosing and the cefazolin weight band', () => {
  eq(C.abxDose('30 mg/kg', 80, null, 'cefazolin').mg, 2000, 0, 'capped at 2 g under 100 kg:');
  eq(C.abxDose('30 mg/kg', 110, null, 'cefazolin').mg, 3000, 0, '3 g at or above 100 kg:');
  eq(C.abxDose('30 mg/kg', 60, null, 'cefazolin').mg, 1800, 0, 'uncapped below the ceiling:');
  eq(C.abxDose('5 mg/kg', 100, 320, null).mg, 320, 0, 'gentamicin capped at 320 mg:');
  is(C.abxDose('5 mg/kg', 100, 320, null).capped, true);
  eq(C.abxDose('25 mg/kg', 80, 3000, null).mg, 2000, 0, 'vancomycin uncapped at 80 kg:');
});

/* ================================= report ================================ */

console.log(`\n${pass} passed, ${fail} failed, ${pend} pending (expected to fail — open findings)`);
if (pendUnexpected.length) {
  console.log('\nPending tests that unexpectedly PASSED — a fix may have landed; promote them to test():');
  pendUnexpected.forEach(n => console.log(`  ${n}`));
}
if (fail) { console.log('\nFAIL'); process.exit(1); }
console.log('PASS — current behaviour is pinned; pending tests track the open findings');
