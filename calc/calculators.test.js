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

test('FIXED F1: APLS refuses ages above 12 years', () => {
  is(C.aplsWeight(144), 43, 'still answers at exactly 12 years:');
  is(C.aplsWeight(145), null, 'one month past 12 years:');
  is(C.aplsWeight(13 * 12), null);
  is(C.aplsWeight(40 * 12), null, 'was 127 kg:');
  is(C.aplsWeight(85 * 12), null, 'was 262 kg:');
  is(C.aplsFormula(40 * 12), 'over 12 years - enter actual weight',
     'and the label no longer says "adult" beside a paediatric weight:');
});

test('FIXED F1: an adult age no longer produces paediatric doses', () => {
  is(C.paedWeight(40, 0, null), null, 'no weight, so no doses are offered:');
  is(C.paedWeight(40, 0, 82), 82, 'an entered actual weight is still honoured:');
});

test('FIXED F1: a negative age is refused', () => {
  is(C.aplsWeight(-56), null);
});

test('CURRENT: 5-6 year olds get the 6-12y formula (F20)', () => {
  eq(C.aplsWeight(66), 23.5, '5.5 years:');
});
pending('F20', '5-6y should not be over-estimated by the 6-12y formula', () => {
  const w = C.aplsWeight(66);
  if (w > 21) throw new Error(`5.5y estimated at ${w} kg; APLS 1-5y band gives 19 kg`);
});

test('FIXED F24: the age display normalises months into years', () => {
  is(C.formatPaedAge(0, 17, 17), '1y 5m', 'was "17m":');
  is(C.formatPaedAge(1, 17, 29), '2y 5m', 'was "1y 17m":');
  is(C.formatPaedAge(1, 5, 17), '1y 5m', 'unchanged when entered normally:');
  is(C.formatPaedAge(0, 7, 7), '7m', 'under a year stays in months:');
  is(C.formatPaedAge(4, 0, 48), '4y 0m');
  is(C.formatPaedAge(0, 0, 0), '-', 'nothing entered:');
});

test('normaliseAge rolls months into years', () => {
  const n = (y, m) => { const r = C.normaliseAge(y, m); return `${r.years}y${r.months}m`; };
  is(n(0, 17), '1y5m');
  is(n(0, 12), '1y0m');
  is(n(0, 11), '0y11m');
  is(n(0, 23), '1y11m');
  is(n(0, 24), '2y0m');
  is(n(1, 17), '2y5m', 'existing years are carried:');
  is(n(2, 30), '4y6m');
  is(n(3, 0),  '3y0m', 'already normalised is left alone:');
  is(n(0, 0),  '0y0m');
});

test('normaliseAge is total-months preserving', () => {
  for (let t = 0; t <= 300; t++) {
    const r = C.normaliseAge(0, t);
    if (r.years * 12 + r.months !== t) throw new Error(`lost months at ${t}`);
    if (r.months > 11 || r.months < 0) throw new Error(`months out of range at ${t}`);
  }
});

test('normaliseAge clamps a negative age to zero', () => {
  is(C.normaliseAge(-4, 0).totalMonths, 0);
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

test('FIXED F4: LA weight is min(IBW, TBW)', () => {
  eq(C.laWeightUsed(170, 45, 'f'), 45, 0.1, 'frail 45 kg woman, was 61.4:');
  eq(C.laWeightUsed(175, 50, 'm'), 50, 0.1, 'cachectic 50 kg man, was 70.5:');
  eq(C.laMaxDose('lig', C.laWeightUsed(170, 45, 'f')), 135, 0.1, 'was 184 mg:');
  eq(C.laMaxDose('bupi', C.laWeightUsed(170, 45, 'f')), 90, 0.1, 'was 123 mg:');
});

test('FIXED F4: Devine is not evaluated below its valid range', () => {
  eq(C.laWeightUsed(100, 16, 'm'), 16, 0.1, '100 cm child now uses actual weight, was 2.5 kg:');
  eq(C.laMaxDose('lig', C.laWeightUsed(100, 16, 'm')), 48, 0.1, 'was 7.5 mg:');
  eq(C.laWeightUsed(140, 35, 'f'), 35, 0.1, '140 cm patient:');
});

test('IBW is still conservative in obesity, as intended', () => {
  eq(C.laWeightUsed(160, 90, 'f'), 52.4, 0.1, 'IBW still wins when it is the lower of the two:');
  eq(C.laWeightUsed(180, 80, 'm'), 75, 0.1);
  eq(C.laMaxDose('lig', C.laWeightUsed(160, 90, 'f')), 157.2, 0.1);
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

test('FIXED F9: 4-2-1 is the Holliday-Segar rule', () => {
  eq(C.maintenanceFluid(5),  20, 0, '4 mL/kg for the first 10 kg:');
  eq(C.maintenanceFluid(10), 40, 0, 'band boundary:');
  eq(C.maintenanceFluid(15), 50, 0, '+2 mL/kg for the second 10 kg:');
  eq(C.maintenanceFluid(20), 60, 0, 'band boundary, was 80:');
  eq(C.maintenanceFluid(30), 70, 0, '+1 mL/kg thereafter, was 120:');
  eq(C.maintenanceFluid(45), 85, 0, 'was 180:');
  eq(C.maintenanceFluid(70), 110, 0);
  is(C.maintenanceFluid(0), null);
});

test('FIXED F9: the maintenance row routes through Holliday-Segar', () => {
  eq(C.calcDose('4-2-1', 20).lo, 60, 0);
  eq(C.calcDose('4-2-1', 45).lo, 85, 0);
  is(C.parseDoseRange('4-2-1'), null, 'no longer falls through to a flat rate:');
});

test('maintenance is continuous across both band boundaries', () => {
  const e = 1e-9;
  eq(C.maintenanceFluid(10 - e), C.maintenanceFluid(10), 1e-6);
  eq(C.maintenanceFluid(20 - e), C.maintenanceFluid(20), 1e-6);
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

test('FIXED F5: a term neonate gets an appropriate tube at an appropriate depth', () => {
  const s = C.airwaySizes(0, 3.5);
  eq(s.ettUncuffed, 3.5, 0, 'was 4.0 mm:');
  eq(s.ettCuffed,   3.0, 0);
  eq(s.depthLip,    9.5, 0, 'weight + 6; was 12 cm, which is endobronchial:');
  is(s.infant, true);
});

test('FIXED F5: infant tube size bands', () => {
  eq(C.airwaySizes(0, 0.8).ettUncuffed, 2.5, 0, '<1 kg:');
  eq(C.airwaySizes(0, 1.5).ettUncuffed, 3.0, 0, '1-2 kg:');
  eq(C.airwaySizes(0, 2.5).ettUncuffed, 3.0, 0, '2-3 kg:');
  eq(C.airwaySizes(0, 4.0).ettUncuffed, 3.5, 0, 'term:');
  is(C.airwaySizes(0, 1.5).ettCuffed, null, 'no cuffed tube offered under 2 kg:');
});

test('FIXED F5: under 1 year, a weight is required rather than assumed', () => {
  is(C.airwaySizes(0.5).needsWeight, true);
  is(C.airwaySizes(0.5).ettUncuffed, undefined);
});

test('FIXED F5: weight-only entry no longer oversizes the tube', () => {
  eq(C.airwayAgeFallback(10), 1,   0.01, '10 kg is 1 year:');
  eq(C.airwayAgeFallback(30), 7.67, 0.01, 'a 30 kg child is ~7.7y, was read as 11y:');
  eq(C.airwaySizes(C.airwayAgeFallback(30)).ettUncuffed, 6.0, 0, 'was 7.0 mm:');
  eq(C.airwayAgeFallback(40), 11, 0.01, '40 kg is an 11-year-old by APLS (3x11+7):');
  eq(C.airwaySizes(C.airwayAgeFallback(40)).ettUncuffed, 7.0, 0, 'was 8.0 mm when 40 kg was read as 16y:');
});

test('FIXED F5: weights outside the APLS bands are refused, not guessed', () => {
  is(C.airwayAgeFallback(3),  null, 'below the infant formula floor:');
  is(C.airwayAgeFallback(50), null, 'above the 12-year band:');
  is(C.airwayAgeFallback(0),  null);
});

test('FIXED F5: airway sizing is refused above 12 years', () => {
  is(C.airwaySizes(13), null, 'was a 14 mm tube at 40 years:');
  is(C.airwaySizes(40), null);
});

test('Cole\'s formulae still correct within their valid range', () => {
  eq(C.airwaySizes(4).ettUncuffed, 5.0, 0);
  eq(C.airwaySizes(8).ettUncuffed, 6.0, 0);
  eq(C.airwaySizes(8).ettCuffed,   5.5, 0);
  eq(C.airwaySizes(8).depthLip,   16.0, 0);
  eq(C.airwaySizes(1).ettUncuffed, 4.5, 0, 'Cole applies from 1 year:');
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
