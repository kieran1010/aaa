/*
 * equivalence.js — proves calc/calculators.js reproduces index.html exactly.
 *
 * Re-implements each function by pasting the original inline source from
 * index.html, then sweeps a wide input space and asserts the extracted module
 * agrees on every point. Run this BEFORE trusting any fix built on the module.
 *
 *   node calc/equivalence.js
 */
'use strict';
const C = require('./calculators.js');

/* --- originals, pasted verbatim from index.html ------------------------- */

function o_fmtN(n) {
  if (n == null || isNaN(n) || !isFinite(n)) return '-';
  return n >= 100 ? Math.round(n).toString() : n >= 10 ? n.toFixed(1) : n.toFixed(2);
}
function o_roundHalfUp(x) { return Math.ceil(x * 2) / 2; }
function o_aplsWeight(totalMonths) {
  const yr = totalMonths / 12;
  if (totalMonths < 3)  return null;
  if (totalMonths < 12) return Math.round((totalMonths / 2 + 4) * 10) / 10;
  if (yr <= 5)          return Math.round((2 * (yr + 4)) * 10) / 10;
  return Math.round((3 * yr + 7) * 10) / 10;
}
function o_aplsFormula(totalMonths) {
  const yr = totalMonths / 12;
  if (totalMonths < 12) return '(age_mo / 2) + 4';
  if (yr <= 5)          return '2 x (age + 4)';
  if (yr <= 12)         return '3 x age + 7';
  return 'adult';
}
function o_parseDoseRange(str) {
  if (!str || str === '4/2/1') return null;
  const p = str.split('-');
  if (p.length === 2) return { lo: parseFloat(p[0]), hi: parseFloat(p[1]) };
  const v = parseFloat(p[0]);
  return isNaN(v) ? null : { lo: v, hi: v };
}
function o_calcDose(str, wt) {
  if (!wt) return null;
  const r = o_parseDoseRange(str);
  if (!r) return null;
  return { lo: r.lo * wt, hi: r.hi * wt };
}
function o_getIBW(ht, wt, sex) {                       // LA tab
  let calc = null;
  if (ht && sex) {
    calc = Math.round(((sex === 'm' ? 50 : 45.5) + 0.906 * (ht - 152.4)) * 10) / 10;
    if (calc < 1) calc = null;
  }
  return calc ?? wt;
}
function o_devine(ht, sex) {                            // patient card / drugs tab
  const htIn = (ht - 152.4) / 2.54;
  return Math.max(0, (sex === 'm' ? 50 : 45.5) + 2.3 * htIn);
}
function o_abwCard(wt, ht, sex) {                       // globalPatientUpdate
  const i = o_devine(ht, sex);
  return wt > i ? i + 0.4 * (wt - i) : wt;
}
function o_abwDrugs(wt, ht, sex) {                      // calcBodyWeights
  const i = o_devine(ht, sex);
  return wt > i ? i + 0.4 * (wt - i) : i;
}
function o_lbw(wt, ht, sex) {
  const bmi = wt / ((ht / 100) * (ht / 100));
  return sex === 'm' ? (9270 * wt) / (6680 + 216 * bmi) : (9270 * wt) / (8780 + 244 * bmi);
}
function o_ageFromDOB(d, now) {
  let yr = now.getFullYear() - d.getFullYear();
  let mo = now.getMonth() - d.getMonth();
  if (mo < 0) { yr--; mo += 12; }
  if (now.getDate() < d.getDate()) mo = Math.max(0, mo - 1);
  return { years: yr, months: mo };
}
function o_paracetamolIV(wt) {
  const dosePerKg = wt < 5 ? 7.5 : wt <= 10 ? 10 : 15;
  return Math.min(dosePerKg * wt, 1000);
}
function o_airwayAge(wt) { return Math.max(0, wt / 2 - 4); }
function o_isFixed(unit) {
  return unit.includes('fixed') || unit === 'g/hr' || unit === 'mL/kg' ||
         unit === 'mcg/kg/hr' || unit === 'units/kg/hr' || unit === 'units/kg';
}
const O_LA = { lig:{mgkg:3,ceil:200}, ligadr:{mgkg:7,ceil:500}, bupi:{mgkg:2,ceil:150}, ropi:{mgkg:3,ceil:300} };
function o_laMax(key, ibw) {
  const d = O_LA[key];
  const wtMax = ibw ? d.mgkg * ibw : null;
  return d.ceil ? (wtMax ? Math.min(wtMax, d.ceil) : d.ceil) : wtMax;
}
function o_abx(doseWt, wt, maxDose, maxDoseFn) {
  const m = doseWt.match(/([\d.]+)\s*(mg|g|mcg)\/kg/);
  if (!m) return null;
  let rawMg = parseFloat(m[1]) * wt * (m[2] === 'g' ? 1000 : 1);
  let maxMg = maxDoseFn === 'cefazolin' ? (wt >= 100 ? 3000 : 2000) : (maxDose != null ? maxDose : null);
  let capped = false;
  if (maxMg != null && rawMg > maxMg) { rawMg = maxMg; capped = true; }
  return { mg: rawMg, capped };
}

/* --- sweep --------------------------------------------------------------- */

let checks = 0, fails = 0;
const eq = (a, b) =>
  (a === b) ||
  (Number.isNaN(a) && Number.isNaN(b)) ||           // NaN is a legitimate shared result
  (typeof a === 'number' && typeof b === 'number' && Math.abs(a - b) < 1e-9);
function cmp(label, a, b) {
  checks++;
  if (!eq(a, b)) { fails++; if (fails <= 20) console.log(`  MISMATCH ${label}: original=${a} module=${b}`); }
}

// fmtN across magnitudes and edge values
[null, undefined, NaN, Infinity, -Infinity, 0, 0.004, 0.005, 0.05, 1, 9.99, 10, 99.9, 100, 12345.6, -3]
  .forEach(v => cmp(`fmtN(${v})`, o_fmtN(v), C.fmtN(v)));

// roundHalfUp
for (let x = 0; x <= 20; x += 0.05) cmp(`roundHalfUp(${x})`, o_roundHalfUp(x), C.roundHalfUp(x));

// APLS across every month 0..1500 (covers the unbounded adult branch)
for (let m = 0; m <= 1500; m++) {
  cmp(`aplsWeight(${m})`, o_aplsWeight(m), C.aplsWeight(m));
  cmp(`aplsFormula(${m})`, o_aplsFormula(m), C.aplsFormula(m));
}

// dose parsing, including the 4-2-1 defect and malformed input
['4-2-1', '4/2/1', '0.5', '1-2', '', null, 'wt', '10', '0.15', '2-', '-2', 'abc']
  .forEach(s => {
    const a = o_parseDoseRange(s), b = C.parseDoseRange(s);
    cmp(`parseDoseRange(${s}).lo`, a && a.lo, b && b.lo);
    cmp(`parseDoseRange(${s}).hi`, a && a.hi, b && b.hi);
    [0, 0.5, 3, 20, 70, 150].forEach(w => {
      const x = o_calcDose(s, w), y = C.calcDose(s, w);
      cmp(`calcDose(${s},${w}).lo`, x && x.lo, y && y.lo);
    });
  });

// body weights across the full input range, both sexes, both ABW variants
for (let ht = 100; ht <= 220; ht += 2) {
  for (let wt = 1; wt <= 250; wt += 7) {
    ['m', 'f'].forEach(sex => {
      cmp(`devine(${ht},${sex})`, o_devine(ht, sex), C.devineIBW(ht, sex));
      cmp(`lbw(${wt},${ht},${sex})`, o_lbw(wt, ht, sex), C.lbw(wt, ht, sex));
      cmp(`abwCard(${wt},${ht},${sex})`, o_abwCard(wt, ht, sex), C.abw(wt, ht, sex, false));
      cmp(`abwDrugs(${wt},${ht},${sex})`, o_abwDrugs(wt, ht, sex), C.abw(wt, ht, sex, true));
      cmp(`laWeight(${ht},${wt},${sex})`, o_getIBW(ht, wt, sex), C.laWeightUsed(ht, wt, sex));
    });
    cmp(`laWeight(${ht},${wt},'')`, o_getIBW(ht, wt, ''), C.laWeightUsed(ht, wt, ''));
  }
}

// LA maxima
Object.keys(O_LA).forEach(k => {
  for (let w = 1; w <= 200; w += 1) cmp(`laMax(${k},${w})`, o_laMax(k, w), C.laMaxDose(k, w));
  cmp(`laMax(${k},null)`, o_laMax(k, null), C.laMaxDose(k, null));
});

// paracetamol IV bands and the 1000 mg cap
for (let w = 0.5; w <= 120; w += 0.5) cmp(`paracetamolIV(${w})`, o_paracetamolIV(w), C.paracetamolIVDose(w));

// airway
for (let w = 0.5; w <= 150; w += 0.5) cmp(`airwayAge(${w})`, o_airwayAge(w), C.airwayAgeFallback(w));
for (let a = 0; a <= 20; a += 0.05) {
  const s = C.airwaySizes(a);
  cmp(`ettUC(${a})`, o_roundHalfUp(a / 4 + 4), s.ettUncuffed);
  cmp(`ettC(${a})`,  o_roundHalfUp(a / 4 + 3.5), s.ettCuffed);
  cmp(`lip(${a})`,   o_roundHalfUp(a / 2 + 12), s.depthLip);
  cmp(`nose(${a})`,  o_roundHalfUp(a / 2 + 15), s.depthNose);
}

// age from DOB over a dense date grid
for (let y = 2018; y <= 2026; y++) {
  for (let mth = 0; mth < 12; mth += 3) {
    for (const day of [1, 10, 15, 28]) {
      const dob = new Date(y, mth, day);
      const now = new Date(2026, 8, 5);
      const a = o_ageFromDOB(dob, now), b = C.ageFromDOB(dob, now);
      cmp(`age(${y}-${mth}-${day}).y`, a.years, b.years);
      cmp(`age(${y}-${mth}-${day}).m`, a.months, b.months);
    }
  }
}

// unit classification and antibiotic dosing
['mg/kg','mcg/kg','mg (fixed)','units(fixed)','g/hr','mL/kg','mcg/kg/hr','units/kg/hr',
 'units/kg','mcg/kg/min','mg/kg/hr','mmol/kg',''].forEach(u => cmp(`isFixed(${u})`, o_isFixed(u), C.isFixedUnit(u)));

[['30 mg/kg', null, 'cefazolin'], ['50 mg/kg', 4000, null], ['25 mg/kg', 3000, null],
 ['5 mg/kg', 320, null], ['7.5 mg/kg', 500, null], ['10 mg/kg', 900, null]]
  .forEach(([s, max, fn]) => {
    for (let w = 1; w <= 250; w += 3) {
      const a = o_abx(s, w, max, fn), b = C.abxDose(s, w, max, fn);
      cmp(`abx(${s},${w}).mg`, a.mg, b.mg);
      cmp(`abx(${s},${w}).capped`, a.capped, b.capped);
    }
  });

console.log(`\n${checks} equivalence checks, ${fails} mismatches`);
if (fails) { console.log('\nFAIL — the module does NOT reproduce index.html'); process.exit(1); }
console.log('PASS — calc/calculators.js is behaviourally identical to index.html');
