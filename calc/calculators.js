/*
 * calculators.js — pure calculation logic extracted from index.html.
 *
 * Extracted verbatim: this module reproduces the application's CURRENT behaviour
 * exactly, defects included, so that it can be pinned by tests before any fix is
 * applied. Known defects are annotated with their finding ID from
 * CALCULATOR_AUDIT.md. Do not "tidy" an annotated line — the tests assert it.
 *
 * No DOM access. Every function takes values and returns values.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Calc = factory();
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /* ---------------------------------------------------------------- shared */

  function fmtN(n) {
    if (n == null || isNaN(n) || !isFinite(n)) return '-';
    return n >= 100 ? Math.round(n).toString() : n >= 10 ? n.toFixed(1) : n.toFixed(2);
  }

  function roundHalfUp(x) {
    return Math.ceil(x * 2) / 2;   // always rounds up — see F5(c)
  }

  /* ------------------------------------------------------------ body weight */

  // Devine, metric. F19: unguarded below ~152 cm; clamped to 0 rather than refused.
  function devineIBW(heightCm, sex) {
    var htIn = (heightCm - 152.4) / 2.54;
    var base = sex === 'm' ? 50 : 45.5;
    return Math.max(0, base + 2.3 * htIn);
  }

  // Janmahasatian lean body weight.
  function lbw(weightKg, heightCm, sex) {
    var bmi = weightKg / ((heightCm / 100) * (heightCm / 100));
    return sex === 'm'
      ? (9270 * weightKg) / (6680 + 216 * bmi)
      : (9270 * weightKg) / (8780 + 244 * bmi);
  }

  // Adjusted body weight. F14: the two call sites in index.html disagree on the
  // TBW <= IBW branch. `underweightReturnsIBW` reproduces both.
  //   false -> patient-card behaviour (returns TBW)  — correct
  //   true  -> drugs-tab behaviour   (returns IBW)  — can exceed the patient
  function abw(weightKg, heightCm, sex, underweightReturnsIBW) {
    var ibw = devineIBW(heightCm, sex);
    if (weightKg > ibw) return ibw + 0.4 * (weightKg - ibw);
    return underweightReturnsIBW ? ibw : weightKg;
  }

  /* ------------------------------------------------------------------- age */

  // F15: Math.max(0,...) swallows the borrow, so the year is never decremented;
  // a future DOB yields a negative year.
  function ageFromDOB(dobDate, nowDate) {
    var yr = nowDate.getFullYear() - dobDate.getFullYear();
    var mo = nowDate.getMonth() - dobDate.getMonth();
    if (mo < 0) { yr--; mo += 12; }
    if (nowDate.getDate() < dobDate.getDate()) mo = Math.max(0, mo - 1);
    return { years: yr, months: mo };
  }

  // Any months >= 12 roll into years. Both age cards normalise through this, so
  // 17 months entered anywhere becomes 1y 5m everywhere (F24 fixed).
  function normaliseAge(yr, mo) {
    var total = (yr || 0) * 12 + (mo || 0);
    if (!(total >= 0)) total = 0;
    return { years: Math.floor(total / 12), months: total % 12, totalMonths: total };
  }

  function formatPaedAge(yr, mo, totalMonths) {
    if (!(totalMonths > 0)) return '-';
    var n = normaliseAge(yr, mo);
    return n.years > 0 ? n.years + 'y ' + n.months + 'm' : n.months + 'm';
  }

  /* -------------------------------------------------- paediatric weight/APLS */

  // APLS 2011. Verified identical to the published formulae at every month
  // 0-12y (Addendum B.1). APLS is defined only to 12 years, so the function
  // refuses beyond it rather than extrapolating (F1 fixed).
  // F20 remains open: fractional age sends 5-6y to the 6-12y formula.
  var APLS_MAX_MONTHS = 144;   // 12 years

  function aplsWeight(totalMonths) {
    var yr = totalMonths / 12;
    if (!(totalMonths >= 0))          return null;   // negative age (see F15)
    if (totalMonths < 3)              return null;   // below the validated range
    if (totalMonths > APLS_MAX_MONTHS) return null;  // F1: APLS stops at 12 years
    if (totalMonths < 12) return Math.round((totalMonths / 2 + 4) * 10) / 10;
    if (yr <= 5)          return Math.round((2 * (yr + 4)) * 10) / 10;
    return Math.round((3 * yr + 7) * 10) / 10;
  }

  function aplsFormula(totalMonths) {
    var yr = totalMonths / 12;
    if (totalMonths > APLS_MAX_MONTHS) return 'over 12 years - enter actual weight';
    if (totalMonths < 12) return '(age_mo / 2) + 4';
    if (yr <= 5)          return '2 x (age + 4)';
    return '3 x age + 7';
  }

  function paedWeight(yr, mo, actualWt) {
    if (actualWt) return actualWt;
    var totalMonths = (yr || 0) * 12 + (mo || 0);
    if (totalMonths === 0) return null;
    return aplsWeight(totalMonths);
  }

  /* ------------------------------------------------------------ paed dosing */

  // F9: guards the string '4/2/1' but the data carries '4-2-1', which splits into
  // three parts, falls through, and returns a flat {lo:4, hi:4}.
  function parseDoseRange(str) {
    if (!str || str === '4/2/1') return null;
    var p = str.split('-');
    if (p.length === 2) return { lo: parseFloat(p[0]), hi: parseFloat(p[1]) };
    var v = parseFloat(p[0]);
    return isNaN(v) ? null : { lo: v, hi: v };
  }

  function calcDose(str, wt) {
    if (!wt) return null;
    var r = parseDoseRange(str);
    if (!r) return null;
    return { lo: r.lo * wt, hi: r.hi * wt };
  }

  // F3: the cap is applied only when a maxDose FIELD exists. A "Max X" written
  // into the note text alone is never enforced.
  function applyMaxDose(dose, maxDose) {
    if (!dose || maxDose == null) return dose;
    return { lo: Math.min(dose.lo, maxDose), hi: Math.min(dose.hi, maxDose) };
  }

  function paracetamolIVDose(wt) {
    var perKg = wt < 5 ? 7.5 : wt <= 10 ? 10 : 15;
    return Math.min(perKg * wt, 1000);
  }

  /* ------------------------------------------------------------ paed airway */

  // F5(a): inverts the INFANT formula (wt = months/2 + 4) but reads the result as
  // YEARS, so it over-estimates age, and therefore tube size, above ~20 kg.
  function airwayAgeFallback(wt) {
    return Math.max(0, wt / 2 - 4);
  }

  // F5(b): Cole's formulae, extrapolated below their ~1-2y validity floor.
  function airwaySizes(ageYears) {
    return {
      ettUncuffed: roundHalfUp(ageYears / 4 + 4),
      ettCuffed:   roundHalfUp(ageYears / 4 + 3.5),
      depthLip:    roundHalfUp(ageYears / 2 + 12),
      depthNose:   roundHalfUp(ageYears / 2 + 15)
    };
  }

  // Verified correct against the classic LMA chart across all seven bands.
  function lmaSize(wt) {
    if (wt < 5)  return { size: '1',   maxCuff: 4  };
    if (wt < 10) return { size: '1.5', maxCuff: 7  };
    if (wt < 20) return { size: '2',   maxCuff: 10 };
    if (wt < 30) return { size: '2.5', maxCuff: 14 };
    if (wt < 50) return { size: '3',   maxCuff: 20 };
    if (wt < 70) return { size: '4',   maxCuff: 30 };
    return { size: '5', maxCuff: 40 };
  }

  /* ------------------------------------------------------------- LA toxicity */

  var LA_DRUGS = {
    lig:    { name: 'Lignocaine',               mgkg: 3, ceil: 200 },
    ligadr: { name: 'Lignocaine + Adrenaline',  mgkg: 7, ceil: 500 },
    bupi:   { name: 'Bupivacaine',              mgkg: 2, ceil: 150 },
    ropi:   { name: 'Ropivacaine',              mgkg: 3, ceil: 300 }
  };

  // F4 fixed. Two changes from the original:
  //   1. min(IBW, TBW) rather than IBW-wins. Using IBW is the right conservative
  //      choice in obesity, but for a patient lighter than their ideal weight it
  //      RAISED the ceiling — 36-41% above the true limit in the audited cases.
  //   2. Devine is not evaluated below its valid range (152.4 cm). Previously a
  //      100 cm child produced an IBW of 2.5 kg and a lignocaine ceiling of
  //      7.5 mg; now it falls back to actual weight.
  var DEVINE_MIN_HEIGHT_CM = 152.4;

  function laWeightUsed(heightCm, weightKg, sex) {
    var ibw = null;
    if (heightCm && sex && heightCm >= DEVINE_MIN_HEIGHT_CM) {
      ibw = Math.round(((sex === 'm' ? 50 : 45.5) + 0.906 * (heightCm - 152.4)) * 10) / 10;
      if (ibw < 1) ibw = null;
    }
    if (ibw != null && weightKg) return Math.min(ibw, weightKg);
    return weightKg || ibw || null;
  }

  function laMaxDose(drugKey, weightUsed) {
    var d = LA_DRUGS[drugKey];
    if (!d) return null;
    var wtMax = weightUsed ? d.mgkg * weightUsed : null;
    return d.ceil ? (wtMax ? Math.min(wtMax, d.ceil) : d.ceil) : wtMax;
  }

  // Cumulative toxicity fraction. Verified sound.
  function cumulativeToxicFraction(rows, weightUsed) {
    var total = 0;
    var perRow = rows.map(function (r) {
      var mgPerMl = r.concPct * 10;
      var absMax  = laMaxDose(r.key, weightUsed);
      var dose    = r.volMl * mgPerMl;
      var frac    = absMax && r.volMl > 0 ? dose / absMax : 0;
      total += frac;
      return { key: r.key, mgPerMl: mgPerMl, absMax: absMax, dose: dose, frac: frac };
    });
    var remaining = Math.max(0, 1 - total);
    perRow.forEach(function (r) {
      r.safeVolRemainingMl = r.absMax ? remaining * r.absMax / r.mgPerMl : null;
    });
    return { total: total, remaining: remaining, rows: perRow };
  }

  /* ----------------------------------------------------------------- opioids */

  // Amount of each opioid equivalent to 10 mg PO morphine (conversion tab).
  var OPIOID_EQUIV = {
    po_morphine: 10, po_oxycodone: 6.6, po_hydromorphone: 2, po_codeine: 75,
    po_tramadol: 100, po_tapentadol: 25, iv_morphine: 3.3, iv_oxycodone: 3.3,
    iv_fentanyl: 50
  };

  // oMEDD tab factors. F6: these disagree with OPIOID_EQUIV for codeine,
  // IV oxycodone and IV fentanyl. F28/F29 (provisional): tramadol and tapentadol
  // disagree with ANZCA. F7: the on-screen footnote says buprenorphine x 25.
  var OMEDD_FACTORS = {
    'Oral morphine': 1, 'Oral oxycodone': 1.5, 'Oral hydromorphone': 5,
    'Oral codeine': 0.15, 'Oral tramadol': 0.1, 'Oral tapentadol': 0.4,
    'IV/SC morphine': 3, 'IV/SC hydromorphone': 15, 'IV/SC fentanyl': 0.1,
    'IV/SC oxycodone': 2, 'Buprenorphine patch': 2.4, 'Fentanyl patch': 2.4
  };

  function toOralMorphine(opioidKey, dose) {
    var e = OPIOID_EQUIV[opioidKey];
    if (e == null) return null;
    return (dose / e) * 10;
  }

  function fromOralMorphine(opioidKey, poMorphineEquiv) {
    var e = OPIOID_EQUIV[opioidKey];
    if (e == null) return null;
    return (poMorphineEquiv / 10) * e;
  }

  // F16: the two directions band on different quantities, so they are not
  // inverses — 7.5 mg methadone round-trips back to 5 mg.
  function methadoneToOMEDD(methadoneDose) {
    var r = methadoneDose <= 7.5 ? 4 : methadoneDose <= 20 ? 6 : methadoneDose <= 50 ? 8 : 12;
    return { ratio: r, omedd: methadoneDose * r };
  }

  function omeddToMethadone(omedd) {
    var r = omedd < 30 ? 4 : omedd < 90 ? 6 : omedd < 300 ? 8 : 12;
    return { ratio: r, methadone: omedd / r };
  }

  function omeddTotal(entries) {
    return entries.reduce(function (t, e) {
      var f = OMEDD_FACTORS[e.drug];
      return t + (f == null ? 0 : e.dose * f);   // unknown drug contributes 0
    }, 0);
  }

  function omeddWarning(total) {
    if (total >= 200) return 'very-high';
    if (total >= 100) return 'high';
    return null;
  }

  /* ------------------------------------------------------- adult drug dosing */

  function isFixedUnit(unit) {
    return unit.indexOf('fixed') !== -1 || unit === 'g/hr' || unit === 'mL/kg' ||
           unit === 'mcg/kg/hr' || unit === 'units/kg/hr' || unit === 'units/kg';
  }

  function adultBolus(lo, hi, unit, wt, maxDose) {
    if (lo === null || !wt) return null;
    var cap = function (v) { return maxDose != null ? Math.min(v, maxDose) : v; };
    if (!isFixedUnit(unit)) return { lo: cap(lo * wt), hi: cap(hi * wt), unit: unit.replace('/kg', '') };
    if (unit === 'units/kg')    return { lo: cap(lo * wt), hi: cap(hi * wt), unit: 'units' };
    if (unit === 'units/kg/hr') return { lo: lo * wt, hi: hi * wt, unit: 'units/hr' };
    if (unit === 'mL/kg')       return { lo: cap(lo * wt), hi: cap(hi * wt), unit: 'mL' };
    if (unit === 'mcg/kg/hr')   return { lo: lo * wt, hi: hi * wt, unit: 'mcg/hr' };
    return null;   // genuinely fixed — no per-kg calculation
  }

  function abxDose(doseWtStr, wt, maxDose, maxDoseFn) {
    if (!wt || !doseWtStr) return null;
    var m = doseWtStr.match(/([\d.]+)\s*(mg|g|mcg)\/kg/);
    if (!m) return null;
    var rawMg = parseFloat(m[1]) * wt * (m[2] === 'g' ? 1000 : 1);
    var maxMg = maxDoseFn === 'cefazolin' ? (wt >= 100 ? 3000 : 2000)
                                          : (maxDose != null ? maxDose : null);
    var capped = maxMg != null && rawMg > maxMg;
    if (capped) rawMg = maxMg;
    return { mg: rawMg, display: m[2] === 'g' ? rawMg / 1000 : rawMg, unit: m[2], capped: capped };
  }

  return {
    fmtN: fmtN, roundHalfUp: roundHalfUp,
    devineIBW: devineIBW, lbw: lbw, abw: abw,
    ageFromDOB: ageFromDOB, formatPaedAge: formatPaedAge, normaliseAge: normaliseAge,
    aplsWeight: aplsWeight, aplsFormula: aplsFormula, paedWeight: paedWeight,
    parseDoseRange: parseDoseRange, calcDose: calcDose, applyMaxDose: applyMaxDose,
    paracetamolIVDose: paracetamolIVDose,
    airwayAgeFallback: airwayAgeFallback, airwaySizes: airwaySizes, lmaSize: lmaSize,
    LA_DRUGS: LA_DRUGS, laWeightUsed: laWeightUsed, laMaxDose: laMaxDose,
    cumulativeToxicFraction: cumulativeToxicFraction,
    OPIOID_EQUIV: OPIOID_EQUIV, OMEDD_FACTORS: OMEDD_FACTORS,
    toOralMorphine: toOralMorphine, fromOralMorphine: fromOralMorphine,
    methadoneToOMEDD: methadoneToOMEDD, omeddToMethadone: omeddToMethadone,
    omeddTotal: omeddTotal, omeddWarning: omeddWarning,
    isFixedUnit: isFixedUnit, adultBolus: adultBolus, abxDose: abxDose
  };
}));
