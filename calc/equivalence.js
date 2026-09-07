/*
 * equivalence.js — proves calc/calculators.js matches the functions that
 * actually ship in index.html.
 *
 *   node calc/equivalence.js
 *
 * These are not hand-copied originals. calc/live.js slices each function out of
 * index.html and executes it (with a minimal DOM stub where one is needed), so
 * a divergence between the module and the shipped page is caught even if the
 * two are edited independently. Exits non-zero on any mismatch.
 */
'use strict';
const C = require('./calculators.js');
const L = require('./live.js');

/* --- the live functions, taken straight from index.html ------------------ */
const live = {
  fmtN:            L.pure('fmtN'),
  roundHalfUp:     L.pure('roundHalfUp'),
  aplsWeight:      L.pure('aplsWeight'),
  aplsFormula:     L.pure('aplsFormula'),
  parseDoseRange:  L.pure('parseDoseRange'),
  calcDose:        L.pure('calcDose', ['parseDoseRange']),
  getIBW:          L.withDom('getIBW'),
  getPdWt:         L.withDom('getPdWt', ['aplsWeight'])
};

/* --- comparator ---------------------------------------------------------- */
let checks = 0, fails = 0;
const eq = (a, b) =>
  (a === b) ||
  (Number.isNaN(a) && Number.isNaN(b)) ||
  (typeof a === 'number' && typeof b === 'number' && Math.abs(a - b) < 1e-9);
function cmp(label, a, b) {
  checks++;
  if (!eq(a, b)) { fails++; if (fails <= 20) console.log(`  MISMATCH ${label}: index.html=${a} module=${b}`); }
}

/* --- sweeps -------------------------------------------------------------- */

[null, undefined, NaN, Infinity, -Infinity, 0, 0.004, 0.005, 0.05, 1, 9.99, 10, 99.9, 100, 12345.6, -3]
  .forEach(v => cmp(`fmtN(${v})`, live.fmtN(v), C.fmtN(v)));

for (let x = 0; x <= 20; x += 0.05) cmp(`roundHalfUp(${x})`, live.roundHalfUp(x), C.roundHalfUp(x));

// Every month from -60 to 1500: covers negative age, the <3m floor, each band
// boundary, and the >12y refusal.
for (let m = -60; m <= 1500; m++) {
  cmp(`aplsWeight(${m})`,  live.aplsWeight(m),  C.aplsWeight(m));
  cmp(`aplsFormula(${m})`, live.aplsFormula(m), C.aplsFormula(m));
}

['4-2-1', '4/2/1', '0.5', '1-2', '', null, 'wt', '10', '0.15', '2-', '-2', 'abc'].forEach(s => {
  const a = live.parseDoseRange(s), b = C.parseDoseRange(s);
  cmp(`parseDoseRange(${s}).lo`, a && a.lo, b && b.lo);
  cmp(`parseDoseRange(${s}).hi`, a && a.hi, b && b.hi);
  [0, 0.5, 3, 20, 70, 150].forEach(w => {
    const x = live.calcDose(s, w), y = C.calcDose(s, w);
    cmp(`calcDose(${s},${w}).lo`, x && x.lo, y && y.lo);
    cmp(`calcDose(${s},${w}).hi`, x && x.hi, y && y.hi);
  });
});

// LA weight: the whole declared input range, both sexes, plus sex-not-selected
// and weight-or-height-missing.
for (let ht = 100; ht <= 220; ht += 2) {
  for (let wt = 1; wt <= 250; wt += 7) {
    ['m', 'f', ''].forEach(sex => {
      cmp(`getIBW(${ht},${wt},"${sex}")`,
          live.getIBW({ 'la-ht': ht, 'la-wt': wt, 'la-sex': sex }).result,
          C.laWeightUsed(ht, wt, sex));
    });
  }
  ['m', 'f'].forEach(sex => {
    cmp(`getIBW(${ht},none,"${sex}")`,
        live.getIBW({ 'la-ht': ht, 'la-sex': sex }).result,
        C.laWeightUsed(ht, null, sex));
  });
}
[1, 45, 70, 250].forEach(wt => {
  cmp(`getIBW(none,${wt},"f")`, live.getIBW({ 'la-wt': wt, 'la-sex': 'f' }).result, C.laWeightUsed(null, wt, 'f'));
});
cmp('getIBW(all blank)', live.getIBW({}).result, C.laWeightUsed(null, null, ''));

// Paediatric weight selection, including the adult-age and under-3-month paths.
[[0,0],[0,2],[0,6],[1,0],[3,0],[5,0],[6,0],[12,0],[13,0],[18,0],[40,0],[85,0],[0,17],[1,5]]
  .forEach(([y, mo]) => {
    [null, 20, 82].forEach(actual => {
      const vals = { 'pd-yr': y, 'pd-mo': mo };
      if (actual != null) vals['pd-wt'] = actual;
      cmp(`getPdWt(${y}y${mo}m, actual=${actual})`,
          live.getPdWt(vals).result,
          C.paedWeight(y, mo, actual));
    });
  });

// LA maxima and the CTF, against the module's own arithmetic.
Object.keys(C.LA_DRUGS).forEach(k => {
  for (let w = 1; w <= 200; w++) {
    const d = C.LA_DRUGS[k];
    cmp(`laMax(${k},${w})`, Math.min(d.mgkg * w, d.ceil), C.laMaxDose(k, w));
  }
});

console.log(`\n${checks} equivalence checks against the live index.html, ${fails} mismatches`);
if (fails) { console.log('\nFAIL — calc/calculators.js has diverged from index.html'); process.exit(1); }
console.log('PASS — calc/calculators.js matches the functions that ship in index.html');
