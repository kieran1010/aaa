# Calculator Safety Audit — Vantage (`index.html`)

**Audited:** commit `4a1a59d`, single-file application (`index.html`, 4067 lines)
**Date:** 5 September 2026
**Scope:** every interactive calculator plus the static dose content the calculators are checked against
**Status:** **All 30 findings closed** — 29 fixed (Addenda C–G), F27 retracted (Addendum B). No pending tests remain.
**Note:** Addendum G.1 corrects an error of mine — I twice reported ANZCA's parenteral fentanyl factor as 0.3; it is **0.2**.
**Standard applied:** ANZCA / APLS, with ANZCOR for resuscitation and AAGBI where ANZCA is silent
**Addendum A** resolves the clinical values against ANZCA. **Addendum B retracts F27** and cross-checks the paediatric formulae against UK, Australian and US sources. Read both before acting on any clinical value.

---

## 1. Method

Every calculator was read line-by-line, its logic extracted and re-executed outside the
page to confirm the numbers it actually produces, then screened on five axes:

1. **Input handling** — out-of-range, out-of-domain, blank, zero, negative, and
   unconventional-but-plausible entries (e.g. "17 months" rather than "1 year 5 months")
2. **Units** — per-kg vs absolute, mg vs mcg, concentration vs dose, mL vs mg
3. **Calculation** — the arithmetic itself
4. **Dosing** — the drug values against normal ANZ/UK practice
5. **Consistency** — internal (does the app agree with itself?) and external
   (does it agree with the guideline it cites?)

Every numerical claim below was reproduced by running the app's own code. Worked
examples are in §9.

### Calculators in scope

| # | Calculator | Location |
|---|---|---|
| 1 | Global patient card (age from DOB, TBW/IBW/LBW/ABW) | `calcAgeFromDOB`, `globalPatientUpdate` |
| 2 | LA maximum dose / cumulative toxicity fraction | `getIBW`, `calcLA` |
| 3 | Paediatric weight estimate (APLS) | `aplsWeight`, `calcPdAge` |
| 4 | Paediatric drug doses (PaeDose) | `PD_CATS`, `calcPaed` |
| 5 | Paediatric airway sizing | `renderAirway` |
| 6 | Adult drug dosing table | `DRUG_CATS`, `ddFmtRange`, `renderDrugTable` |
| 7 | Antibiotic dosing table | `ABX_DATA`, `renderAbxTable` |
| 8 | Body weights (drugs tab — duplicate of #1) | `calcBodyWeights` |
| 9 | Opioid conversion | `OPIOIDS`, `calcOpioid` |
| 10 | oMEDD | `OMEDD_DRUGS`, `calcOmedd` |
| 11 | Anticoagulant / neuraxial timing (lookup) | `ANTICOAG_DATA` |
| 12 | Consent document generator | `updateConsent` |

---

## 2. Severity key

| | Meaning |
|---|---|
| **C1 — Critical** | Can produce a dose that would seriously harm a patient, reachable by ordinary use |
| **C2 — High** | Wrong output, or a stated safety limit that is not enforced |
| **C3 — Moderate** | Internally inconsistent, or deviates from the cited guideline |
| **C4 — Low** | Display, wording, or robustness issue with no direct dosing consequence |

---

## 3. Summary of findings

| ID | Severity | Calculator | Finding |
|---|---|---|---|
| **F1** | ~~C1~~ **FIXED** | Paed weight | `aplsWeight()` had no upper age bound — 40 y → 127 kg, 85 y → 262 kg, labelled "adult". Now returns null outside 3 months–12 years. *(Addendum C)* |
| **F2** | ~~C1~~ **FIXED** | Adult drugs | Adenosine carried the 0.3–0.5 mg/kg neurovascular flow-arrest dose. Now the fixed 6 mg → 12 mg SVT dose. *(Addendum C)* |
| **F3** | ~~C1~~ **FIXED** | Paed drugs | 14 drugs stated "Max X" in prose that was never enforced. All 14 now carry a `maxDose` field, and a lint test fails if a new one appears. *(Addendum C)* |
| **F4** | ~~C1~~ **FIXED** | LA max dose | IBW always overrode actual weight, raising the ceiling 36–41 % in underweight adults. Now `min(IBW, TBW)`, and Devine is not evaluated below 152.4 cm. *(Addendum C)* |
| **F5** | ~~C2~~ **FIXED** | Paed airway | Weight-banded sizing under 1 y (term neonate 3.5 mm at 9.5 cm, was 4.0 mm at 12 cm); weight→age inversion corrected; refused above 12 y. *(Addendum E)* |
| **F6** | ~~C2~~ **FIXED** | Opioids | Both tools now derive from one ANZCA PS01(PM) App 2 table; neither stores its own factors. *(Addendum G)* |
| **F7** | ~~C2~~ **FIXED** | oMEDD | Footnote now lists the factors the code actually uses. *(Addendum E)* |
| **F8** | ~~C2~~ **FIXED** | oMEDD | The tab now states that methadone is excluded and why, instead of silently scoring it zero. *(Addendum E)* |
| **F9** | ~~C2~~ **FIXED** | Paed drugs | 4-2-1 is now Holliday-Segar — 85 mL/hr for a 45 kg child, was 180. *(Addendum E)* |
| **F10** | ~~C2~~ **FIXED** | Adult drugs | Aminophylline 10 → 5 mg/kg, matching the app's own Bronchospasm page. *(Addendum E)* |
| **F11** | ~~C2~~ **FIXED** | Paed drugs | Sugammadex block depths were reversed; now moderate 2 / deep 4 / rescue 16 mg/kg. *(Addendum E)* |
| **F12** | ~~C2~~ **FIXED** | Paed drugs | IM adrenaline now lists 1:1000 first. *(Addendum C)* |
| **F13** | ~~C2~~ **FIXED** | All | Real input validation — clamps on blur, flags while typing. The min/max attributes were inert. *(Addendum E)* |
| **F14** | ~~C3~~ **FIXED** | Body weights | One shared implementation; ABW can no longer exceed the patient. *(Addendum F)* |
| **F15** | ~~C3~~ **FIXED** | Global | DOB borrow corrected; future dates refused and flagged. *(Addendum F)* |
| **F16** | ~~C3~~ **FIXED** | Opioids | Methadone conversion round-trips exactly; the forward table is unchanged. *(Addendum F)* |
| **F17** | ~~C3~~ **FIXED** | Adult drugs | Salbutamol, esmolol, ephedrine and metoprolol reconciled with the emergency pages. *(Addendum E)* |
| **F18** | ~~C3~~ **FIXED** | Adult drugs | Atropine maximum 6 → 3 mg (ANZCOR 11.9), in both the table and the Bradycardia page. *(Addendum E)* |
| **F19** | ~~C3~~ **FIXED** | Body weights | Devine declines below 152.4 cm instead of clamping to 0. *(Addendum F)* |
| **F20** | ~~C3~~ **FIXED** | Paed weight | Band chosen by completed years — a 5.5-year-old is 19 kg, was 23.5. *(Addendum F)* |
| **F21** | ~~C3~~ **FIXED** | Adult drugs | Propofol infusion range now matches its own note (50–150 mcg/kg/min). *(Addendum E)* |
| **F22** | ~~C3~~ **FIXED** | Regional | The max-dose caveat is now on every block, pointing at the LA calculator. *(Addendum F)* |
| **F23** | ~~C3~~ **FIXED** | Emergency | Dantrolene and Intralipid follow the entered weight. *(Addendum F)* |
| **F24** | ~~C4~~ **FIXED** | Paed | Age now normalises on entry — 17 months resolves to 1y 5m in the fields and the display, on both cards. *(Addendum D)* |
| **F25** | ~~C4~~ **FIXED** | Consent | Date inputs parsed as local, not UTC. *(Addendum F)* |
| **F26** | ~~C4~~ **FIXED** | Paed drugs | IM ketamine now offers 100/50 mg/mL — 1 mL, not 10 mL. *(Addendum F)* |
| **F30** | ~~C2~~ **FIXED** | Global ↔ paed | **New.** Typing a weight silently wiped an age entered on the paediatric tab, changing the recommended ETT size. Age sync is now two-way and non-destructive. *(Addendum D)* |
| ~~**F27**~~ | — | Paed weight | ~~Superseded APLS formulae~~ — **WITHDRAWN, see Addendum B.** The app's formulae are current APLS and match at every month 0–12 y. The finding was based on the Best Guess formulae misread as an APLS update. |
| **F28** | ~~C2~~ **FIXED** | Opioids | Tramadol 0.1 → **0.2**, confirmed against the primary table. *(Addendum G)* |
| **F29** | ~~C3~~ **FIXED** | Opioids | Tapentadol 0.4 → **0.3**, confirmed against the primary table. *(Addendum G)* |

---

## 4. Critical findings in detail

### F1 — Adult ages produce a paediatric weight estimate (C1)

`index.html:2158`

```js
function aplsWeight(totalMonths) {
  const yr = totalMonths / 12;
  if (totalMonths < 3)  return null;
  if (totalMonths < 12) return Math.round((totalMonths / 2 + 4) * 10) / 10;
  if (yr <= 5)          return Math.round((2 * (yr + 4)) * 10) / 10;
  return Math.round((3 * yr + 7) * 10) / 10; // covers all ages
}
```

The final branch has no upper bound, and the comment asserting it "covers all ages"
is wrong — `3 × age + 7` is the APLS 6–12 year formula only.

The companion function `aplsFormula` *does* know this: above 12 years it returns the
label `'adult'`. So the UI displays the word **"adult"** next to a weight that was
nonetheless computed with the paediatric formula, and `getPdWt()` then feeds that
weight to every drug in the table.

| Age entered | Weight shown | Formula label shown |
|---|---|---|
| 13 y | 46 kg | adult |
| 18 y | 61 kg | adult |
| 40 y | **127 kg** | adult |
| 85 y | **262 kg** | adult |

At 40 years with no weight entered, the paediatric table then offers:

- Propofol 3 mg/kg → **381 mg**
- Ketamine IM 5 mg/kg → **635 mg**
- Suxamethonium IV 2 mg/kg → **254 mg** (its note claims "Max 150 mg")
- Adrenaline arrest 0.01 mg/kg → **1.27 mg** (its note claims "Max 1 mg")

The global patient card accepts ages up to 120 years (`g-yr max="120"`) and
propagates them straight into `pd-yr`, so this is reachable without the user ever
opening the paediatric tab deliberately.

**Also:** ages under 3 months return `null`, so neonates get no estimate at all —
the fail-safe direction, but it leaves the commonest high-risk group unsupported.

---

### F2 — Adenosine at 0.3–0.5 mg/kg in the antiarrhythmic table (C1)

`index.html:2678`

```js
{ name:'Adenosine', bolusLo:0.3, bolusHi:0.5, bolusUnit:'mg/kg',
  notes:'Rapid IV push' }
```

| Weight | Table calculates | ANZCOR SVT dose |
|---|---|---|
| 50 kg | 15–25 mg | 6 mg → 12 mg |
| 70 kg | **21–35 mg** | 6 mg → 12 mg |
| 100 kg | **30–50 mg** | 6 mg → 12 mg |

This value appears to have been imported from the app's own **Aneurysm Rupture (OR)**
page, which correctly cites *"Adenosine 0.3–0.6 mg/kg for transient flow arrest"* —
a specialist neurovascular technique for deliberately inducing transient asystole.
Presented in a general antiarrhythmic table annotated only "Rapid IV push", it reads
as a routine SVT dose.

The app contradicts itself: the **Tachycardia** page correctly says *"Adenosine 6 mg
rapid IV bolus + saline flush; no response: 12 mg"*. The paediatric table also gets
it right at 0.1 mg/kg.

---

### F3 — Stated maximum doses are not enforced (C1)

`index.html:2405`

```js
const rawDose = calcDose(drug.doseStr, wt);
if (rawDose && drug.maxDose != null) {
  dose = { lo: Math.min(rawDose.lo, drug.maxDose), ... };
} else {
  dose = rawDose;          // <- no cap
}
```

The cap is applied only when a `maxDose` **field** exists. Fourteen drugs state a
maximum in their free-text `note` — which is what the clinician reads — but have no
`maxDose` field, so the calculated dose sails past it:

| Drug | Note claims | Actually capped? |
|---|---|---|
| Midazolam (oral premed) | Max 15 mg | **No** |
| Suxamethonium (IV) | Max 150 mg | **No** |
| Atropine (reversal) | Min 0.1 mg; max 0.5 mg | **No** |
| Atropine (emergency) | Min 0.1 mg, max 0.5 mg | **No** |
| Glycopyrrolate | Max 0.4 mg | **No** |
| Neostigmine | Max 5 mg | **No** |
| Ketorolac | Max 15 mg | **No** |
| Parecoxib | Max 40 mg | **No** |
| Cyclizine | Max 50 mg | **No** |
| Dexamethasone | Max 8 mg | **No** |
| Ondansetron | Max 4 mg | **No** |
| Adenosine | max 6 mg 1st dose | **No** |
| Adrenaline (IM) | Max 0.5 mg | **No** |
| Adrenaline (arrest) | Max 1 mg | **No** |

Correctly capped: clonidine, oral ketamine, fentanyl, IV/oral morphine, ibuprofen,
both paracetamol rows, tramadol, amiodarone.

A 45 kg adolescent is therefore offered ondansetron 6.75 mg (max 4), dexamethasone
4.5 mg (max 8 — fine), neostigmine 2.25 mg (fine), but adrenaline 0.45 mg IM
(within max) — and a 60 kg 15-year-old gets adrenaline **0.6 mg IM** against a
stated 0.5 mg ceiling. Combined with **F1**, an adult age silently entered on this
tab removes every remaining brake.

The minimum doses (atropine "Min 0.1 mg") are equally unenforced, in the opposite
direction: a 3 kg neonate is offered 60 mcg, below the dose at which paradoxical
bradycardia is a concern.

---

### F4 — LA calculator uses IBW in preference to actual weight (C1)

`index.html:2000`

```js
const used = calc ?? wt;   // IBW if height+sex given, else actual weight
```

Using IBW is the right conservative choice for an **obese** patient. But the code
applies it unconditionally, so for a patient lighter than their ideal weight it
raises the ceiling instead of lowering it:

| Patient | Weight used | Lignocaine max | True (3 mg/kg) | Error |
|---|---|---|---|---|
| 170 cm, 45 kg, frail elderly ♀ | 61.4 kg | 184 mg | 135 mg | **+36 %** |
| 175 cm, 50 kg, cachectic ♂ | 70.5 kg | 200 mg | 150 mg | **+41 %** |
| 160 cm, 90 kg, obese ♀ | 52.4 kg | 157 mg | 200 mg | conservative ✓ |
| 180 cm, 80 kg | 75 kg | 200 mg | 200 mg | ✓ |

Bupivacaine shows the same pattern (123 mg vs a true 90 mg for the 45 kg patient) —
and low body weight, frailty and low albumin are precisely the risk factors for LAST.

**The correct rule is `min(IBW, TBW)`.**

Two secondary problems in the same function:

- **Below Devine's valid range**, the formula is applied anyway. A 100 cm, 16 kg
  child gives an IBW of **2.5 kg** and a lignocaine ceiling of **7.5 mg**. Guarded
  only by `if (calc < 1) calc = null`. This errs safe, but silently produces a
  meaningless number rather than declining to answer.
- **Ropivacaine's absolute ceiling is set to 300 mg** (`index.html:1988`). The
  commonly quoted single-dose maximum is 3 mg/kg to a ceiling of 200–225 mg. Worth
  confirming against your intended reference.

---

## 5. Cross-calculator consistency

The app contains two opioid tools and two body-weight tools. Neither pair agrees.

### F6 — Opioid conversion vs oMEDD

Both express doses as oral morphine equivalents, so their factors should be identical.

| Drug | Conversion tab (implied factor) | oMEDD tab | |
|---|---|---|---|
| Oral morphine | 1.000 | 1 | ✓ |
| Oral oxycodone | 1.515 | 1.5 | ✓ |
| Oral hydromorphone | 5.000 | 5 | ✓ |
| Oral codeine | 0.133 | 0.15 | minor |
| Oral tramadol | 0.100 | 0.1 | both 50 % low vs ANZCA 0.2 — see Addendum A |
| Oral tapentadol | 0.400 | 0.4 | both 33 % high vs ANZCA 0.3 — see Addendum A |
| IV/SC morphine | 3.030 | 3 | ✓ |
| **IV/SC oxycodone** | **3.030** | **2** | **−34 %** |
| **IV/SC fentanyl** | **0.200** | **0.1** | **2×** |

A patient on 600 mcg/day of IV fentanyl is scored at **60 mg oMEDD** on one tab and
**120 mg** on the other. The 100 mg/day risk warning fires on one and not the other.

For external comparison, the factor in common ANZ use for parenteral fentanyl is
**0.3** (100 mcg IV fentanyl ≈ 10 mg IV morphine ≈ 30 mg oral morphine). Both of the
app's values sit below that, so both **under**-state oMEDD — which under-recognises
high-risk patients and, when converting *to* fentanyl, over-states the fentanyl dose.
Recommend adopting one factor table, citing its source, and using it in both tools.

### F7 — oMEDD footnote contradicts oMEDD code

The visible footnote (`index.html:1721`) reads:

> Buprenorphine patch (mcg/hr) **× 25** • Fentanyl patch (mcg/hr) × 2.4

The code (`index.html:3189`) uses `factor: 2.4` for buprenorphine — a **10-fold**
discrepancy between what the clinician is told and what is computed. The footnote
also omits IV/SC oxycodone and oral tapentadol, both of which are in the dropdown.

Separately, buprenorphine and fentanyl patches carrying an *identical* factor of 2.4
looks like a copy-paste. Buprenorphine is a partial agonist with a non-linear
relationship to morphine; this warrants an explicit source.

### F8 — Methadone silently missing from oMEDD

`calcOmedd` contains a branch for `raw === 'methadone'`, but option values are built
as `factor|unit` where factor is always numeric — so the branch is **unreachable**,
and there is no methadone entry in `OMEDD_DRUGS` at all. A patient on methadone plus
oxycodone returns an oMEDD that omits the methadone entirely.

### F16 — Methadone conversion does not round-trip

The forward direction (oMEDD → methadone) bands on the **morphine** dose and matches
the displayed Ripamonti table. The reverse (methadone → oMEDD) bands on the
**methadone** dose using different cut-points, so the two are not inverses:

| Enter | → oMEDD | → back to methadone | Drift |
|---|---|---|---|
| 7.5 mg | 30 mg | 5.0 mg | −33 % |
| 15 mg | 90 mg | 11.3 mg | −25 % |
| 20 mg | 120 mg | 15.0 mg | −25 % |
| 50 mg | 400 mg | 33.3 mg | −33 % |

The reference column also hard-codes "2.5 mg" as the methadone equivalent of 10 mg
morphine (a 4:1 ratio), which only holds at low oMEDD and conflicts with the
computed value in the adjacent cell.

The cross-tolerance warning and Ripamonti citation on this tab are good and should be
kept. The **oMEDD tab has no equivalent warning** and should get one.

### F14 — The two body-weight calculators disagree

`globalPatientUpdate` (patient card) and `calcBodyWeights` (drugs tab) implement the
same four formulae, but diverge in the `TBW ≤ IBW` branch:

```js
// patient card, index.html:1953
var abwM = wt > ibwMnum ? rnd(ibwMnum + 0.4*(wt-ibwMnum)) : rnd(wt);   // -> TBW
// drugs tab, index.html:2951
var abwM = wt > ibwMnum ? rnd(ibwMnum + 0.4*(wt-ibwMnum)) : ibwM;      // -> IBW
```

| Patient | Patient card ABW | Drugs tab ABW |
|---|---|---|
| 45 kg, 170 cm ♀ | 45 kg | **61 kg** |
| 50 kg, 175 cm ♂ | 50 kg | **70 kg** |
| 55 kg, 180 cm ♂ | 55 kg | **75 kg** |
| 90 kg, 160 cm ♀ | 67 kg | 67 kg ✓ |

The drugs-tab version returns an "adjusted body weight" **larger than the patient**,
which is the dangerous direction for any drug dosed on ABW. The patient-card version
is correct. This is a duplicated-logic problem: the two should be one shared function.

### F19 — Devine below its valid range

Both calculators clamp with `Math.max(0, ...)` rather than declining:

| Height | IBW ♂ | IBW ♀ |
|---|---|---|
| 100 cm | 2.6 kg | **0.0 kg** |
| 110 cm | 11.6 kg | 7.1 kg |
| 120 cm | 20.7 kg | 16.2 kg |
| 152.4 cm | 50.0 kg | 45.5 kg |

The height inputs accept 100 cm, so these are reachable. An IBW of 0 kg then makes
ABW = 0.4 × TBW.

### F17 — Adult table vs the app's own emergency algorithms

| Drug | Adult drug table (at 70 kg) | Emergency algorithm page |
|---|---|---|
| Adenosine | 21–35 mg | 6 mg → 12 mg *(Tachycardia)* |
| Aminophylline | **700 mg** (10 mg/kg) | 400 mg over 15 min *(Bronchospasm)* |
| Salbutamol IV | **700 mcg** (10 mcg/kg) | 250 mcg slow push *(Bronchospasm)* |
| Esmolol | 70–140 mg (1–2 mg/kg) | 10 mg boluses titrated *(Hypertension)* |
| Ephedrine | 17.5 mg (0.25 mg/kg) | 9 mg boluses *(Hypotension, Bradycardia)* |
| Metoprolol max | 5 mg | 15 mg *(Tachycardia, Hypertension)* |
| Sugammadex | "Deep: 16 mg/kg; moderate: 4" *(paed)* | 4 mg/kg PTC>2, 2 mg/kg T2 *(Failure to Wake)* |
| Mannitol | — | 0.25–1 g/kg *(IR)* vs 0.25–2 g/kg *(ICP)* |

In each row the **emergency page is the more defensible value** and the drug table
is the outlier. Aminophylline at 10 mg/kg is roughly double the usual 5 mg/kg
loading dose; salbutamol at 10 mcg/kg is ~2.8× the usual 250 mcg adult bolus;
esmolol's 2 mg/kg upper bound is above the usual 0.5–1 mg/kg load.

---

## 6. Input handling

**F13 — there is no input validation in the application.** `min`, `max` and `step`
attributes are present on every numeric field, but they only take effect on form
submission or an explicit `checkValidity()` call, and the app has neither — every
value is read straight through `parseFloat`/`parseInt` in an `oninput` handler.
Confirmed: no occurrence of `checkValidity`, `reportValidity`, `validity` or
`setCustomValidity` anywhere in the file.

| Input | Declared range | Actually enforced | Consequence of exceeding it |
|---|---|---|---|
| `g-yr` age (years) | 0–120 | **No** | feeds `pd-yr` → **F1** |
| `g-mo` age (months) | 0–11 | **No** | see below |
| `pd-yr` | 0–18 | **No** | **F1** |
| `pd-mo` | 0–11 | **No** | see below |
| `pd-wt` | 0.5–150 | **No** | no neonatal guard |
| `g-wt`, `dd-wt`, `la-wt` | 1–250 | **No** | unbounded doses |
| `g-ht`, `dd-ht`, `la-ht` | 100–220 | **No** | **F19** |
| `oc-dose` (opioid) | ≥0 | **No** | unbounded conversions |
| `omedd-dose-*` | ≥0 | **No** | unbounded totals |

### The "17 months" case (F24)

Entering **17** in the months field with years blank is handled **correctly
arithmetically** — `totalMonths = 17`, which lands in the 1–5 year branch and gives
10.8 kg (APLS for ~1.4 y). The failure is in presentation:

`index.html:2186`
```js
totalMonths > 0 ? (yr > 0 ? yr + 'y ' : '') + mo + 'm' : '-'
```

The display is assembled from the raw fields rather than from `totalMonths`, so:

| Entered | Displayed | Should read |
|---|---|---|
| 0 y, 17 m | `17m` | `1y 5m` |
| 1 y, 17 m | `1y 17m` | `2y 5m` |
| 0 y, 0 m | `-` | `-` |

The weight is right; the age readback is not. In a paediatric resus context a
clinician cross-checking "does that age look right for this child?" gets a string
that doesn't obviously correspond to the age they meant. Normalising with
`Math.floor(totalMonths/12)` and `totalMonths % 12` fixes it.

### F15 — Age from DOB

`index.html:1874`
```js
if (now.getDate() < d.getDate()) mo = Math.max(0, mo - 1);
```

The `Math.max(0, …)` clamp swallows the borrow instead of decrementing the year:

| DOB | Today | App says | Correct |
|---|---|---|---|
| 2020-03-15 | 2026-03-10 | 6 y 0 m | 5 y 11 m |
| 2025-06-20 | 2026-06-10 | 1 y 0 m | 0 y 11 m |
| 2030-01-01 | 2026-09-05 | **−4 y 8 m** | (should be rejected) |

The second row matters: it moves the child across the 12-month APLS boundary
(9.5 kg → 10 kg). A future DOB is accepted and produces a negative age, which then
falls into `aplsWeight`'s `totalMonths < 3` branch and returns `null` — so it fails
safe by accident rather than by design.

`new Date(dob)` also parses a `<input type="date">` value as **UTC midnight** and
compares it against a local `new Date()`. In NZ (UTC+12/13) this is harmless; west
of UTC it shifts the date by a day. The same pattern in `formatDOB`/`formatDate`
(`index.html:3732`) can print a **consent document with a DOB one day early** for
any user in a negative-offset timezone (**F25**).

---

## 7. Paediatric airway calculator (F5)

`index.html:2350`

```js
var age = yr + mo / 12;
if (!age && wt) age = Math.max(0, wt / 2 - 4);
```

**Two separate problems.**

**(a) Age inferred from weight is wrong above ~20 kg.** The fallback inverts the
*infant* formula (`wt = months/2 + 4`) but treats the result as **years**:

| Weight only | App infers | APLS-consistent age | App ETT | Appropriate ETT |
|---|---|---|---|---|
| 5 kg | 0.0 y | ~0.2 y | 4.0 mm | 3.5 mm |
| 10 kg | 1.0 y | ~1.0 y | 4.5 mm | 4.5 mm ✓ |
| 20 kg | 6.0 y | ~4.3 y | 5.5 mm | 5.5 mm ✓ |
| 30 kg | 11.0 y | ~7.7 y | **7.0 mm** | 6.0 mm |
| 40 kg | 16.0 y | ~11.0 y | **8.0 mm** | 7.0 mm |
| 50 kg | 21.0 y | ~14.3 y | **9.5 mm** | 8.0 mm |

Oversized by 1–1.5 mm in school-age children, with the corresponding depth error
(22.5 cm at the lip for a 50 kg child).

**(b) The formulae are extrapolated below their valid range.** `age/4 + 4` and
`age/2 + 12` are Cole's formulae, valid from roughly 1–2 years:

| Age | App ETT | App lip depth | Appropriate |
|---|---|---|---|
| Term neonate | 4.0 mm | 12 cm | 3.0–3.5 mm, ~9–10 cm |
| 3 months | 4.5 mm | 12.5 cm | 3.5 mm, ~10 cm |
| 6 months | 4.5 mm | 12.5 cm | 3.5–4.0 mm, ~10–11 cm |

An ETT 1 mm oversized in a neonate risks subglottic injury; 12 cm at the lip in a
neonate is frankly endobronchial. Neonates and infants need the weight-based rules
(depth ≈ weight + 6 cm) rather than Cole's.

**(c) `roundHalfUp` always rounds up** (`Math.ceil(x*2)/2`), biasing every borderline
size upward — the same direction as the errors above.

**What is correct:** LMA sizing and cuff volumes match the classic LMA chart across
all seven bands; Guedel, face mask and blade selections are reasonable; the cuffed
formula `age/4 + 3.5` is standard.

There is also **no upper bound** — combined with **F1**, entering an adult age on
this tab returns an ETT of `40/4 + 4 = 14 mm`.

---

## 8. Remaining findings

### Paediatric drug table

- **F9 — 4-2-1 maintenance is wrong.** `parseDoseRange` guards against the string
  `'4/2/1'`, but the data uses `'4-2-1'`. Splitting on `-` yields three parts, falls
  through, and returns `{lo: 4, hi: 4}` — a flat 4 mL/kg/hr:

  | Weight | App shows | True 4-2-1 |
  |---|---|---|
  | 10 kg | 40 | 40 ✓ |
  | 20 kg | **80** | 60 |
  | 30 kg | **120** | 70 |
  | 45 kg | **180** | 85 |

  It also renders with **no unit** (the row's `unit` is `''`), so the output is a
  bare number in a column headed "Calc. dose".

- **F11 — Sugammadex note is reversed.** "Deep: 16 mg/kg; moderate: 4 mg/kg" should
  be *moderate 2, deep 4, immediate rescue 16*. The app's own Failure to Wake page
  states it correctly.

- **F12 — IM adrenaline defaults to 1:10 000.** The anaphylaxis row lists
  `1:10000` first and `1:1000` second, so a 20 kg child's 0.2 mg IM dose is presented
  as **2 mL of 1:10 000**. IM adrenaline should be given as 1:1000; list it first, or
  restrict this row to it.

- **F26 — IM ketamine at 10 mg/mL.** 5 mg/kg for a 20 kg child computes to **10 mL
  IM**. IM ketamine needs 50 or 100 mg/mL.

- **Ephedrine** is listed as route `im` with a 3 mg/mL concentration — 3 mg/mL is an
  IV dilution. Route or concentration is wrong.

- **Clinical values to re-check against your reference:** tramadol (contraindicated
  <12 y per FDA/EMA), parecoxib (not licensed in children), cyclizine 1 mg/kg
  (age-banded dosing is usual: 25 mg for 6–12 y), oral paracetamol load capped at
  1500 mg (above the usual 1 g adult single dose), hydrocortisone 2 mg/kg for
  anaphylaxis (4 mg/kg is more usual).

- **What is correct:** every concentration-to-volume conversion checked out
  (atropine 600 mcg/mL from 0.6 mg/mL, neostigmine 2500 mcg/mL from 2.5 mg/mL,
  glycopyrrolate 200 mcg/mL, salbutamol 500 mcg/mL, amiodarone, adenosine,
  ondansetron, dexamethasone, cyclizine, sux, roc, vec, propofol, morphine). The
  paracetamol IV weight-banded special case (7.5 / 10 / 15 mg/kg, capped at 1000 mg)
  is implemented correctly. Atropine appears twice in different units (mcg/kg and
  mg/kg) but the two are numerically identical.

### F20 — Discontinuity at 5.0 years

`aplsWeight` switches formula at `yr <= 5` using **fractional** age, so a child
one month past their fifth birthday jumps from 18 kg to 22.3 kg (+24 %). Using
fractional age smooths the curve *within* each band, which is defensible, but the
band boundary needs to move to `< 6` (APLS applies `3 × age + 7` from 6 years) or
the two branches need blending.

### Adult drug table

- **F18 — Atropine maximum stated as 6 mg**, both in the table
  ("Min 0.6 mg … Max 6 mg") and on the Bradycardia page ("repeat to max 6 mg").
  ANZCOR/ALS caps bradycardia treatment at 3 mg. Internally consistent, externally
  out of step.
- **F21 — Propofol contradicts itself**: infusion range 25–75 mcg/kg/min, note says
  "TIVA: typically 50–150 mcg/kg/min".
- **Isoprenaline 0.05–0.5 mcg/kg/min** (3.5–35 mcg/min at 70 kg) is well above the
  usual 1–10 mcg/min. The Bradycardia page's recipe (1 mg in 50 mL at 0–60 mL/hr =
  up to 20 mcg/min) is consistent with the table but equally high.
- **Fibrinogen concentrate 70 mg/kg** (4.9 g at 70 kg) is the congenital-deficiency
  dose; 25–50 mg/kg is usual in acquired hypofibrinogenaemia.
- **Digoxin and gentamicin** should be dosed on IBW/lean weight; gentamicin's note
  says "Use IBW if obese" but the calculation uses entered TBW with no adjustment,
  and the tab's own IBW display is not wired to it.
- **PCC "Max 3000 units"** is in the note only, with no `maxDose` field — same
  pattern as **F3**.
- Infusion columns are deliberately passed `wt = null`
  (`renderDrugTable`, `index.html:2823`) so they are never weight-calculated. That's a
  reasonable choice, but it makes the `mcg/kg/hr` and `units/kg/hr` branches of
  `ddFmtRange` dead code and means bolus and infusion columns behave differently
  without explanation.
- Cefazolin's fixed dose (`2-3 g`) is hidden whenever `doseWt` is present, because
  `displayDose = d.doseWt ? d.doseWt : d.dose`.
- **What is correct:** the mg/mL concentrations, the cefazolin weight-banded cap
  (2 g / 3 g at 100 kg), and the antibiotic maxima (ceftriaxone 4 g, gentamicin
  320 mg, vancomycin 3 g, clindamycin 900 mg, meropenem 2 g, metronidazole 500 mg,
  fluconazole 400 mg, cefuroxime 1.5 g) all check out.

### Emergency algorithms (reviewed as dose content, not as calculators)

Generally accurate and well-referenced. Verified correct:

- Magnesium **10 mmol = 5 mL of 49.3 %** — arithmetically exact (493 mg/mL × 5 mL =
  2465 mg ÷ 246.5 g/mol = 10 mmol), and consistent across all three pages that
  mention it.
- High-dose insulin euglycaemia therapy: 70 u bolus ≈ 1 u/kg, then 100 u in 50 mL at
  35 mL/hr = 1 u/kg/hr — standard.
- Dantrolene 2.5 mg/kg → 175 mg → 9 vials at 20 mg/vial; max 10 mg/kg.
- Intralipid 1.5 mL/kg bolus, 15 mL/kg/hr infusion, max 12 mL/kg; adrenaline
  ≤1 mcg/kg; avoid vasopressin — matches AAGBI.
- ANZAAG anaphylaxis grading and the 10–20 / 100–200 mcg / 1 mg adrenaline ladder.
- Phenytoin 20 mg/kg at ≤50 mg/min; flumazenil 0.2 mg to 1 mg; naloxone 100 mcg.

Points to address:

- **F23** — Dantrolene and Intralipid show **hard-coded "70 kg adult"** worked
  examples (`index.html:1030, 1038, 1103`). The app has a global patient weight; the
  two most time-critical weight-based doses in it should use it.
- **Labetalol is filed under "Alpha-blocker"** on the Hypertension page, alongside
  phentolamine. It is a combined α/β-blocker with a ~1:7 α:β ratio. The same panel
  correctly warns "always give alpha-blocker before beta-blocker" for
  phaeochromocytoma — where relying on labetalol as *the* alpha-blocker is exactly
  the error that warning exists to prevent.
- The Intralipid panel says "Continue until haemodynamically stable" beside "Max
  dose: 12 mL/kg"; after three boluses the infusion can only run ~30 minutes before
  the cumulative maximum is reached. Worth stating. The 2023 AAGBI option to double
  the infusion rate to 30 mL/kg/hr is not mentioned.
- Mannitol is 0.25–1 g/kg on one page and 0.25–2 g/kg on another.

### Regional anaesthesia (F22)

Block LA volumes are static strings with **no weight input and no link to the LA
maximum-dose calculator**. Volumes are reasonable for an average adult but:

- **Fascia iliaca "30–40 mL"** carries no max-dose caveat. 40 mL of 0.5 %
  bupivacaine is 200 mg, above the 150 mg ceiling the app's own LA calculator
  enforces.
- The "Do not exceed max dose" caveat appears on ESP, rectus sheath, PECS and ankle
  blocks but not on interscalene, supraclavicular, costoclavicular, axillary,
  femoral, adductor canal, popliteal or fascia iliaca.
- Thoracic paravertebral "15–20 mL **per level**" invites multiplication without a
  cumulative check.
- No paediatric adjustment anywhere in this section.

The descriptive content (sonoanatomy, technique, risks, phrenic palsy rates,
pneumothorax risk) is accurate and well-written.

### Anticoagulants and POCUS

- The neuraxial timing table is consistent with AAGBI 2013 on every row checked
  (LMWH 12/24 h, UFH 4 h, clopidogrel 7 d, warfarin INR <1.4, CrCl-banded
  dabigatran). It carries **no citation or version date** — worth adding, since this
  is the kind of table that is revised.
- Gastric POCUS uses the Perlas 3-point grading correctly with the 1.5 mL/kg
  threshold, and is properly attributed. No calculator, no defects found.

---

## 9. Suggested order of work

**Before anything else — do not fix in place without tests.** These calculators
have no test coverage. I'd suggest extracting the pure functions
(`aplsWeight`, `getIBW`, `calcDose`, `parseDoseRange`, the opioid factor tables,
`renderAirway`'s sizing logic) into a small module with a table-driven test file, so
each fix below can be pinned by a case. Every worked example in this report is a
ready-made test case.

**Tier 1 — before further clinical use**

1. **F1** Bound `aplsWeight` at 12 years; return `null` above it and show "use actual
   weight". Clamp `pd-yr`/`pd-mo` on input.
2. **F2** Change adenosine in the antiarrhythmic table to 6 mg → 12 mg fixed; move the
   0.3–0.6 mg/kg flow-arrest dose to the neuro page only, with its indication.
3. **F3** Move every "Max X" out of `note` into a real `maxDose` field; add a lint
   check that fails if a note matches `/max/i` and no `maxDose` exists.
4. **F4** Change `calc ?? wt` to `Math.min(calc, wt)`; refuse to compute IBW below
   152 cm and fall back to actual weight.

**Tier 2 — before the next release**

5. **F5** Bound the airway calculator to 1–12 years; use weight-based rules for
   neonates/infants; fix the weight→age inversion or drop it.
6. **F6/F7/F8** Single shared opioid factor table with a cited source; add methadone
   to oMEDD; fix the buprenorphine footnote; add the cross-tolerance warning to the
   oMEDD tab.
7. **F9** Implement 4-2-1 properly and give the row a unit.
8. **F10/F11/F12/F17/F18** Reconcile the adult table against the emergency pages,
   taking the emergency-page value in each case.
9. **F13** Real validation on every numeric input.

**Tier 3 — consistency and polish**

10. **F14/F19** Merge the two body-weight calculators into one function; guard Devine.
11. **F15/F24/F25** Fix the DOB borrow, normalise the age display, parse dates as local.
12. **F16/F20/F21/F22/F23** Round-trip methadone, move the 5-year boundary, reconcile
    propofol, add weight-awareness to regional and to dantrolene/Intralipid.

---

## 10. What was checked and found correct

Recorded so that a future audit doesn't repeat the work:

- Devine, Janmahasatian and adjusted-body-weight formulae are all transcribed
  correctly (the defects are in their guards and in the `TBW ≤ IBW` branch).
- LA cumulative-toxicity-fraction logic — additive fractions, `min(mg/kg × wt, ceiling)`,
  and the "safe volume remaining" calculation — is sound, and the on-screen
  explanation of it is accurate. Lignocaine 3/200, lignocaine+adrenaline 7/500 and
  bupivacaine 2/150 all match standard limits.
- Every paediatric concentration→volume conversion.
- The paracetamol IV weight-banded rule.
- LMA sizes and cuff volumes across all seven weight bands.
- Antibiotic maximum doses and the cefazolin weight-banded cap.
- Magnesium 49.3 % arithmetic, on all three pages that use it.
- Dantrolene vial arithmetic; Intralipid regimen; HIET regimen; ANZAAG adrenaline
  ladder; ALS energy levels.
- Anticoagulant/neuraxial intervals against AAGBI 2013.
- Perlas gastric grading.
- Opioid factors for oral morphine, oxycodone, hydromorphone, tapentadol, tramadol
  and IV morphine agree between both tools and with common practice.

---

*Prepared as a code and content audit. Clinical dose values flagged here should be
confirmed against your institution's formulary and the current ANZCA / ANZCOR / APLS
/ AAGBI source documents before any change is made.*

---

# Addendum A — Verdicts against ANZCA / APLS

**Added 5 September 2026.** The governing standard for this application is now set as
**ANZCA / APLS**, with **ANZCOR** for resuscitation and **AAGBI** where ANZCA is
silent (LA systemic toxicity, neuraxial anticoagulation). This addendum resolves the
clinical values that §8 left as "confirm against your reference", and adds three
findings that only became visible once a standard was fixed.

**Verification method and its limits.** ANZCA's own domain and several secondary
hosts are blocked by this environment's network egress policy, so the primary PDFs
(PS01(PM) Appendix 2; the APLS manual) could **not** be fetched and read directly.
The values below were established from search-engine extraction of those documents,
corroborated across two or more independent queries where possible. That is good
enough to *flag* a discrepancy and to rank it; it is **not** good enough to be the
sole authority for a code change. **Every value in this addendum should be read off
the primary document before it is written into the application.** Items I could not
establish at all are listed in §A.4 rather than guessed.

## A.1 Correction to this report

Two statements in §5 and §8 of the original report were wrong against the standard
now nominated, and both were mine — asserted from memory rather than checked:

- I recorded oral **tapentadol × 0.4** as "consistent with ANZCA". ANZCA PS01(PM)
  Appendix 2 gives **0.3**. The app is 33 % high, in both opioid tools.
- I treated oral **tramadol × 0.1** as an acceptable variant ("some references use
  10:1"). ANZCA gives **0.2**. The app is **50 % low**, in both opioid tools.

Both are now carried as findings F28 and F29 below.

## A.2 New findings

### F27 — Paediatric weight uses superseded APLS formulae (C2) — ⚠️ WITHDRAWN

> **This finding is retracted. See Addendum B.1.** The app's formulae ARE current
> APLS and match at every month from 0 to 12 years. The formulae I attributed to
> APLS here are the Best Guess formulae, a different method. The section below is
> left in place for the audit trail; do not act on it.

`index.html:2158`. The app implements the **pre-update** APLS formulae for the two
younger bands. Current APLS uses a dedicated infant formula and the revised 1–5 year
formula; only the 6–12 year (Luscombe & Owens) band matches.

| Band | App | Current APLS | Effect |
|---|---|---|---|
| < 12 months | `(months / 2) + 4` | `(months + 9) / 2` | **0.5 kg low** throughout |
| 1–5 years | `2 × (age + 4)` | `2 × (age + 5)` | **2 kg low** throughout |
| 6–12 years | `3 × age + 7` | `3 × age + 7` | correct |

| Age | App | APLS | Shortfall |
|---|---|---|---|
| 6 months | 7.0 kg | 7.5 kg | −7 % |
| 1 year | 10 kg | 12 kg | **−17 %** |
| 3 years | 14 kg | 16 kg | **−13 %** |
| 5 years | 18 kg | 20 kg | −10 % |

**Direction of harm is not uniform.** For drug dosing this under-estimates, which is
the safe direction. For everything titrated *up* to a physiological endpoint it is
the unsafe direction. At 3 years:

| | App (14 kg) | APLS (16 kg) |
|---|---|---|
| Fluid bolus 10 mL/kg | 140 mL | 160 mL |
| Defibrillation 4 J/kg | **56 J** | **64 J** |
| Arrest adrenaline 10 mcg/kg | 140 mcg | 160 mcg |

A 13 % shortfall in defibrillation energy and resuscitation fluid in a
three-year-old is the finding that matters here, not the propofol.

This also partly explains **F20**: with the correct `2 × (age + 5)`, the step at the
band boundary falls from 18 → 22.3 kg (a 24 % jump across one month) to 20 → 25 kg
(a 25 % rise spread across a whole year, which is how APLS intends it to be read).
Fixing F27 and F20 together means switching to integer-year bands rather than
fractional-age interpolation.

### F28 — Tramadol factor is half the ANZCA value (C2)

Both opioid tools use **0.1**; ANZCA PS01(PM) Appendix 2 gives **0.2**. A patient on
400 mg/day of tramadol is scored at 40 mg oMEDD instead of 80 mg — under-stating
exposure and, at the margin, failing to trigger the app's own ≥100 mg/day warning.

### F29 — Tapentadol factor is a third above the ANZCA value (C3)

Both tools use **0.4**; ANZCA gives **0.3**.

## A.3 Revised verdicts on existing findings

### F6 / F7 — the opioid factor tables, scored against ANZCA

| Drug | oMEDD tab | Conversion tab | **ANZCA** | Verdict |
|---|---|---|---|---|
| Oral morphine | 1 | 1 | 1 | ✓ |
| Oral oxycodone | 1.5 | 1.515 | 1.5 | ✓ |
| Oral hydromorphone | 5 | 5 | 5 | ✓ |
| Oral codeine | 0.15 | 0.133 | **0.13** | conversion tab ✓; oMEDD tab 15 % high |
| Oral tramadol | 0.1 | 0.1 | **0.2** | **both 50 % low** (F28) |
| Oral tapentadol | 0.4 | 0.4 | **0.3** | **both 33 % high** (F29) |
| IV/SC morphine | 3 | 3.03 | 3 | ✓ |
| **IV/SC fentanyl** (per mcg) | **0.1** | **0.2** | **0.3** | **oMEDD tab 3× low; conversion tab 1.5× low** |
| Fentanyl patch (per mcg/hr) | 2.4 | — | **3** | 20 % low |
| Buprenorphine patch (per mcg/hr) | 2.4 | — | **2** | 20 % high — and the on-screen footnote says **25**, which is 12.5× the ANZCA value |

This sharpens **F6**. The two tools disagreeing with each other was the headline;
against ANZCA, **neither** is right for parenteral fentanyl — 0.3 is the reference
value and the app offers 0.1 on one tab and 0.2 on the other.

Worked case, a patient on a 75 mcg/hr fentanyl patch plus tramadol 200 mg/day:

- App oMEDD tab: **200 mg/day**
- ANZCA factors: **265 mg/day**

Both cross the ≥200 mg/day "significant overdose risk" threshold here, but only just,
and a slightly smaller patch dose separates them.

**Two ANZCA caveats the app does not carry**, both of which should appear on the
oMEDD tab (the conversion tab already has the cross-tolerance warning):

- ANZCA states that calculating an "equivalent" dose of a replacement opioid **may
  lead to overdosage** and that caution is required when these tables are used to
  guide switching.
- ANZCA **excludes** methadone, transmucosal/lozenge fentanyl and neuraxial opioids
  from the calculator because their pharmacokinetics are complex and variable. This
  reframes **F8**: methadone's absence from the oMEDD list is *consistent with*
  ANZCA. The defect is that the app is silent about the omission — it should say
  methadone is excluded and why, rather than returning a total that quietly ignores
  it. The unreachable `raw === 'methadone'` branch should be deleted, not wired up.

### F18 — confirmed

ANZCOR Guideline 11.9 gives adult atropine 500–600 mcg repeated every 3–5 min **to a
total of 3 mg**. The app's "Max 6 mg", in both the antiarrhythmic table and the
Bradycardia page, is double the ANZCOR ceiling. **Finding stands, now with a named
source.**

### F1, F2, F3, F4, F5, F9, F13 — unchanged

None of these depend on which standard is chosen. F1 (unbounded APLS above 12 years),
F2 (adenosine flow-arrest dose in the antiarrhythmic table), F3 (unenforced maxima),
F4 (IBW overriding actual weight), F5 (ETT sizing), F9 (4-2-1) and F13 (no input
validation) are code defects on any reading. They remain the priority.

Note that **F1 and F27 interact**: fixing F27 alone, without bounding the function at
12 years, would make the adult-age output *larger*, not smaller. F1 must be fixed
first or at the same time.

## A.4 Still unresolved

These could not be established to a standard I would act on, and are listed so they
are not silently dropped:

| Item | Status |
|---|---|
| ANZCA factor for **parenteral oxycodone** | Not established. The app's two tools disagree (2 vs 3.03); one source describes an IV oxycodone : IV morphine ratio of 2:3, but I could not confirm how ANZCA renders it. **Read off PS01(PM) Appendix 2.** |
| **APLS paediatric atropine** maximum single dose | App states 0.5 mg; some sources give 0.6 mg. Not confirmed. |
| **Aminophylline** loading dose (F10) | The app's own Bronchospasm page (400 mg ≈ 5.7 mg/kg) is consistent with the conventional 5 mg/kg; the drug table's 10 mg/kg is the outlier. Direction is clear; the exact ANZ-endorsed figure is not confirmed. |
| **Ropivacaine** ceiling (F4, secondary) | App uses 300 mg. Not confirmed against an ANZCA/AAGBI source. |
| **Paediatric tramadol and parecoxib** licensing status | Flagged in §8; not verified. |
| **Buprenorphine patch** — partial agonist, non-linear | Even with ANZCA's factor of 2, this conversion warrants its own caveat. |

## A.5 Effect on the recommended order of work

§9 Tier 1 is unchanged — **F1, F2, F3, F4** remain the four to fix first, and none of
them turned on the choice of standard.

**F27 joins Tier 1**, because it is a resuscitation-parameter error (defibrillation
energy, fluid bolus) rather than a drug-dosing one, and because it must be sequenced
with F1.

Tier 2 item 6 becomes concrete: build **one** opioid factor table from ANZCA
PS01(PM) Appendix 2, use it in both tools, print the ANZCA source and version on
screen, carry the cross-tolerance and switching warnings on both tabs, and state
explicitly that methadone and transmucosal fentanyl are excluded by ANZCA rather
than omitting them silently.

## A.6 Sources

- [FPM Opioid Calculator — ANZCA](https://www.anzca.edu.au/safety-and-advocacy/opioid-calculator)
- [PS01(PM) Appendix 2 (2025 update) — Opioid Dose Equivalence Calculation Table (PDF)](https://www.anzca.edu.au/getContentAsset/fbd6254a-05be-48eb-a50f-a6e85d89d4db/80feb437-d24d-46b8-a858-4a2a28b9b970/PS01(PM)-(Appendix)_-Opioid-Dose-Equivalence-Calculation-Table.PDF?language=en) — *primary source; could not be fetched from this environment*
- [PS01(PM) Appendix (2021) — mirrored copy (PDF)](https://esaic.org/wp-content/uploads/2023/12/ps01pm-appendix-2021-opioid-dose-equivalence-calculation-table.pdf)
- [ANZCOR Guideline 11.9 — Managing Acute Dysrhythmias](https://www.anzcor.org/home/adult-advanced-life-support/guideline-11-9-managing-acute-dysrhythmias)
- [ANZCOR Guideline 12.3 — Management of other arrhythmias in infants and children](https://www.anzcor.org/home/paediatric-advanced-life-support/guideline-12-2-paediatric-advanced-life-support-pals-2)
- [Weight estimation — Don't Forget the Bubbles](https://dontforgetthebubbles.com/weight-estimation/)
- [Comparison of actual to estimated weights in Australian children, using the original and updated APLS, Luscombe and Owens, Best Guess formulae and the Broselow tape — ScienceDirect](https://www.sciencedirect.com/science/article/pii/S0300957213008873)
- [Weight estimation in paediatrics: a comparison of the APLS formula and 'Weight = 3(age)+7' — PubMed](https://pubmed.ncbi.nlm.nih.gov/20659877/)
- [Wellington ICU Drug Manual — Opioid Dose Equivalence](https://drug.wellingtonicu.com/appendices/appendix6/)

---

# Addendum B — F27 retracted; APLS cross-checked against UK, Australian and US sources

**Added 7 September 2026**, after re-checking the paediatric weight formulae against
UK APLS, Australian APLS and US practice as requested.

## B.1 F27 is withdrawn — it was wrong

**The application's paediatric weight formulae are correct.** They are the current
APLS formulae, unchanged since the 2011 revision, and they match at **every month
from 0 to 12 years** — maximum difference 0.0000 kg.

| Band | App implements | APLS 2011 | |
|---|---|---|---|
| 1–12 months | `(months / 2) + 4` | `(0.5 × months) + 4` | identical |
| 1–5 years | `2 × (age + 4)` | `(2 × age) + 8` | identical (same expression) |
| 6–12 years | `3 × age + 7` | `(3 × age) + 7` | identical |

**What I got wrong.** In Addendum A I reported that current APLS used
`(months + 9) / 2` and `2 × (age + 5)`, and raised F27 as a C2 finding on that
basis. Those are the **Best Guess** formulae (Tinning & Acworth, Australian ED data
2001–2004) — a *different, competing* age-based method, not an APLS update. The
search summary I relied on presented the two side by side and I read them as one
lineage without confirming against a source that named both. The claimed "2 kg low
across the whole 1–5 year band", and the downstream claim of a **13 % shortfall in
defibrillation energy and fluid bolus**, were therefore false. Nothing in the
application needs changing on this account.

This is the failure mode the report's own §A caveat was written to guard against,
and it got past that guard. Two process changes follow, both applied below:

- A finding is not recorded unless a source is identified that **names the standard
  it is attributing the value to**. "Formula X is current" from a comparative paper
  is not sufficient; comparative papers list competing formulae adjacently.
- Where a value could not be read from the primary document, the finding is
  recorded as **provisional** and excluded from the fix tiers until confirmed.

**F27 is struck from the findings list.** F28 and F29 (the tramadol and tapentadol
opioid factors) are unaffected — they came from a source explicitly identified as
ANZCA PS01(PM) Appendix 2 — but under the rule above they are now marked
**provisional** pending a read of the primary PDF, which this environment cannot
fetch.

## B.2 UK vs Australian vs US — the comparison requested

### Age-based weight estimation

| Method | < 1 year | 1–5 years | 6–12 years |
|---|---|---|---|
| **APLS 2011** (UK and Australian — same formulae) | `0.5 × months + 4` | `2 × age + 8` | `3 × age + 7` |
| **Best Guess** (Tinning & Acworth, AU) | `(months + 9) / 2` | `(age + 5) × 2` | `age × 4` *(5–14 y)* |
| **US / AHA PALS** | — no age-based formula — | | |

**UK and Australian APLS do not differ.** Both teach the same three formulae; the
6–12 year band is the Luscombe & Owens formula, adopted into APLS at the 2011
revision. The app is aligned with both.

**Best Guess runs consistently heavier** above one year — 12 kg vs 10 kg at 1 year,
16 vs 14 at 3 years, 20 vs 18 at 5 years. Several comparative studies report Best
Guess and Luscombe & Owens outperforming the older APLS formula in developed
populations, with APLS tending to under-estimate. That is a live argument in the
literature, not a defect in the app; the app follows the taught standard.

**The US does not use an age-based formula at all.** AHA PALS is built around
**length-based tape** estimation (Broselow), with age-based formulae used only for
ETT size. Comparative data favour the tapes: one comparison found the Broselow tape
had markedly tighter limits of agreement (SD 3.8 kg) than the APLS age rule
(SD 5.5 kg), and a recent multicentre validation put PAWPER at 89.4 % and Broselow
at 82.7 % within 20 % of actual weight against **58.8 % for the APLS formula**.

**Implication for the app — a framing issue, not a bug.** Age-based estimation is
the weakest of the available methods, and the app presents its output as a single
unqualified number ("APLS estimate"). Worth considering: a note that an age-based
estimate carries roughly ±20 % error and that actual weight or a length-based tape
should be preferred whenever either is available. That is a content decision for
you, not something I would change unasked.

### F20 survives, and is now better characterised

APLS defines no formula for **5–6 years** — the bands are 1–5 and 6–12. The app
fills the gap by evaluating fractional age against the 6–12 year formula from 5.01
years onward, which extrapolates the older-child formula downward:

| Age | App | APLS 1–5 y formula | Best Guess |
|---|---|---|---|
| 5.0 y | 18.0 kg | 18.0 kg | 20.0 kg |
| 5.5 y | **23.5 kg** | 19.0 kg | 22.0 kg |
| 5.9 y | **24.8 kg** | 19.8 kg | 23.7 kg |
| 6.0 y | 25.0 kg | — | 24.0 kg |

A 5½-year-old is estimated at 23.5 kg where the adjacent APLS band would give 19 kg
— a **24 % over-estimate**, and over-estimation is the unsafe direction for drug
dosing. **F20 stands**, now as a genuine over-estimate in a defined age window
rather than a cosmetic discontinuity. The honest fix is to make the gap visible
rather than silently interpolate across it.

### ETT sizing — no UK/US divergence, and F5 is confirmed

`age/4 + 4` uncuffed and `age/4 + 3.5` cuffed (Cole's) are common to APLS and PALS;
the app matches both. The confirmed problems are at the edges of the range, exactly
as F5 described:

- A **term neonate** takes a **3.0 mm** tube at **9–10 cm** at the lip. The app's
  formulae return **4.0 mm at 12 cm**. Cole's is not valid below about 1–2 years.
- Depth constants vary by source — `age/2 + 12` (app) and `age/2 + 13` both appear;
  `3 × tube size` is a widely used cross-check and would be a useful second line in
  the output.

**F5 stands, unchanged.**

## B.3 Net effect on the findings list

| | |
|---|---|
| **Withdrawn** | F27 |
| **Confirmed by this round** | F5 (ETT at the extremes), F20 (5–6 y over-estimate, re-characterised), F18 (ANZCOR atropine 3 mg) |
| **Downgraded to provisional** | F28, F29, and the revised F6/F7 opioid factors — sourced but not read from the primary document |
| **Unaffected** | F1, F2, F3, F4, F9, F13 and the remainder — code defects that do not depend on any external standard |

**The fix priority is unchanged: F1, F2, F3, F4.** All four are defects in the code's
own logic, independent of which guideline applies, and none of them moved in either
addendum.

## B.4 Sources

- [Weight estimation — Don't Forget the Bubbles](https://dontforgetthebubbles.com/weight-estimation/)
- [APLS weight estimation — don't do it (well, almost never), St Emlyn's](https://www.stemlynsblog.org/apls-estimation-formulas-do-not-safely-predict-weight-in-uk-children-st-emlyns/)
- [A comparison of actual to estimated weights in Australian children … original and updated APLS, Luscombe and Owens, Best Guess formulae and the Broselow tape — Resuscitation](https://www.resuscitationjournal.com/article/S0300-9572(13)00887-3/fulltext)
- [Weight estimation in paediatrics: a comparison of the APLS formula and 'Weight = 3(age)+7' — PubMed](https://pubmed.ncbi.nlm.nih.gov/20659877/)
- [Make your Best Guess: an updated method for paediatric weight estimation in emergencies (Tinning & Acworth)](https://www.researchgate.net/publication/5826170_Make_your_Best_Guess_An_updated_method_for_paediatric_weight_estimation_in_emergencies)
- [Multicentre validation of paediatric weight estimation methods — length-based, habitus-adjusted and age-based](https://pmc.ncbi.nlm.nih.gov/articles/PMC13536096/)
- [Pediatric Weight Estimation — Annals of Emergency Medicine](https://www.annemergmed.com/article/S0196-0644(13)00104-2/fulltext)
- [Endotracheal Tube — StatPearls, NCBI Bookshelf](https://www.ncbi.nlm.nih.gov/books/NBK539747/)
- [Pediatric intubation — PALS](https://www.tomwademd.net/pediatric-airway-management-pediatric-advanced-life-support-course/)

---

# Addendum C — Fixes applied

**7 September 2026.** Tier 1 is done: **F1, F2, F3, F4** — plus **F12**, which fell
out of the F3 work. Everything else remains open and untouched.

Each fix went through the loop in `calc/README.md`: apply in the module → confirm
the finding's pending test flips and **nothing else breaks** → promote the test →
port into `index.html` → re-run the equivalence harness.

## C.1 What changed

### F1 — `aplsWeight()` bounded to the APLS range

APLS is defined from 3 months to 12 years, so the function now returns `null`
outside that range instead of extrapolating. `aplsFormula()` no longer returns the
misleading label `'adult'`; above 12 years it returns
`'over 12 years - enter actual weight'`, and the paediatric panel says why no doses
are shown rather than falling back to a generic prompt.

| Age entered | Before | After |
|---|---|---|
| 12 y | 43 kg | 43 kg — unchanged |
| 13 y | 46 kg | *refused* |
| 40 y | **127 kg** | *refused* |
| 85 y | **262 kg** | *refused* |
| negative (from a future DOB) | fell through | *refused* |

Verified in a real DOM: 40 years with no weight now shows *"Age is over 12 years —
APLS weight estimation does not apply. Enter an actual weight."* A 3-year-old
still returns 14 kg, unchanged.

### F2 — Adenosine

Replaced the per-kg entry with the fixed ANZCOR dose, and the note now names the
dose it is **not**:

```
bolusLo: 6, bolusHi: 12, bolusUnit: 'mg (fixed)', conc: '3 mg/mL',
notes: 'SVT: 6 mg rapid IV push into a large proximal vein + saline flush,
        then 12 mg, then 12 mg. NOT the 0.3-0.6 mg/kg neurosurgical
        flow-arrest dose - see Aneurysm Rupture (OR)'
```

At 70 kg the table showed **21–35 mg**; it now shows **6–12 mg**, matching the
app's own Tachycardia page. The flow-arrest dose stays on the neuro page, where it
has its indication.

### F3 — The 14 unenforced maxima

Every "Max X" written in prose now has a matching `maxDose` field. Units follow
the row's own dose unit — mcg where the dose is mcg/kg, mg where it is mg/kg:

| Drug | `maxDose` | Where it bites |
|---|---|---|
| Midazolam (oral) | 15 mg | 40 kg → was 20 mg |
| Suxamethonium (IV) | 150 mg | 100 kg → was 200 mg |
| Atropine (reversal) | 500 mcg | 40 kg → was 800 mcg |
| Atropine (emergency) | 0.5 mg | 40 kg → was 0.8 mg |
| Glycopyrrolate | 400 mcg | 60 kg |
| Neostigmine | 5000 mcg | 120 kg |
| Ketorolac | 15 mg | 30 kg |
| Parecoxib | 40 mg | 80 kg |
| Cyclizine | 50 mg | 60 kg → was 60 mg |
| Dexamethasone | 8 mg | 80 kg |
| Ondansetron | 4 mg | 45 kg → was 6.75 mg |
| Adenosine (paed) | 6 mg | 60 kg |
| Adrenaline (IM) | 0.5 mg | 60 kg → was 0.6 mg |
| Adrenaline (arrest) | 1 mg | 150 kg |

**The lint matters more than the fourteen edits.** `calc/data.test.js` scans the
shipped `index.html` for any note matching `max(imum)? N (mg|mcg|g|units)` and
fails if that row has no `maxDose`. A fifteenth drug added with a prose-only
maximum now breaks the suite. IV paracetamol is explicitly exempt — its 1000 mg
cap is applied by the `paracetamolIV` branch, not a field.

### F4 — LA weight is `min(IBW, TBW)`

Two changes: the lower of IBW and actual weight is used, and Devine is not
evaluated below 152.4 cm.

| Patient | Before | After |
|---|---|---|
| 170 cm, 45 kg ♀ | 61.4 kg → lignocaine 184 mg | **45 kg → 135 mg** |
| 175 cm, 50 kg ♂ | 70.5 kg → lignocaine 200 mg | **50 kg → 150 mg** |
| 160 cm, 90 kg ♀ | 52.4 kg → 157 mg | 52.4 kg — unchanged, still conservative |
| 100 cm, 16 kg | 2.5 kg → lignocaine **7.5 mg** | **16 kg → 48 mg** |

The box is relabelled from "IBW used" to "Weight used" and gains a caption saying
which was taken — *"IBW (lower than actual)"*, *"Actual (lower than IBW)"*, or
*"Actual — IBW not valid under 152 cm"* — so the choice is visible rather than
implied.

### F12 — IM adrenaline lists 1:1000 first

Fell out of the F3 edit to the same row. A 60 kg patient's anaphylaxis dose now
renders as **0.50 mg (capped) = 0.50 mL of 1:1000**, where it previously read
0.6 mg and offered 1:10 000 first — 6 mL for an intramuscular injection.

## C.2 How this was verified

| | |
|---|---|
| **Equivalence** | 11,263 checks, 0 mismatches |
| **Logic tests** | 38 passed, 0 failed, 14 pending |
| **Data tests** | 16 passed, 0 failed, 3 pending |
| **Syntax** | the 2,336-line inline script passes `node --check` |
| **End-to-end** | the page boots in jsdom with no script errors; all five fixes confirmed through the rendered DOM |

**The equivalence harness no longer compares against a hand copy.** `calc/live.js`
slices each function out of `index.html` and executes it against a minimal DOM
stub, so the module is checked against the code that actually ships. A hand-copied
"original" only proves the copy matches; this does not have that hole.

Run everything with `./calc/run-all.sh`.

## C.3 What is deliberately still open

Tier 2 and 3 of §9, unchanged: **F5** (ETT sizing at the extremes), **F6/F7/F8**
(the opioid tables), **F9** (4-2-1), **F10/F11/F17/F18** (adult table vs the
emergency pages), **F13** (input validation), **F14/F15/F16/F19/F20/F24** and the
rest. 17 pending tests across the two suites track them; each fails today by
design and names its finding.

**F28/F29 remain provisional and were deliberately not applied.** Changing an
opioid conversion factor on search-derived evidence is exactly the move that
produced the retracted F27. Those need a read of ANZCA PS01(PM) Appendix 2 first.

---

# Addendum D — Age handling

**7 September 2026.** Fixes **F24**, and a data-loss bug the original audit missed
and is recorded here as **F30**.

## D.1 F30 — entering a weight silently wiped the age (new, was C2)

`globalPatientUpdate()` propagated age to the paediatric tab unconditionally:

```js
var pdYr=document.getElementById('pd-yr'); if(pdYr) pdYr.value=yr;   // yr = parseInt('')||0
```

`globalPatientUpdate()` runs on **any** change to weight, height or sex. When the
home card's age fields were empty — which they are whenever the user typed the age
on the paediatric tab instead — `yr` and `mo` evaluated to `0`, and those zeroes
were written straight over the age the user had just entered.

The trigger is the ordinary workflow. `backpopulateWeight()` fires on `pd-wt`,
calls `globalPatientUpdate()`, and wipes the age:

| Step | Home | Paediatric |
|---|---|---|
| enter 3y 6m on the paediatric tab | `—` | `3y 6m` |
| type a weight in the box beside it | `—` | **`0y 0m`** |

**Why it was easy to miss.** Doses stayed correct, because `getPdWt()` prefers an
entered actual weight over the APLS estimate. The damage was on the **airway** tab,
which reads `pd-yr`/`pd-mo` directly: with the age zeroed it fell through to the
`wt/2 - 4` fallback (F5a) and silently returned different tube sizes. Entering a
weight — an action that should only ever refine the estimate — changed the
recommended ETT.

This is the class of defect that unit tests do not catch: every function was
behaving as written. It needed a test that drives the actual page, which is why
`calc/dom.test.js` now exists.

## D.2 Age is now synced both ways and always normalised

Age propagation is out of `globalPatientUpdate()` entirely and owned by a single
`syncAge(origin)`. Either card may be typed into; whichever is edited, the value is
normalised and written to both.

- **Both directions.** Previously home → paediatric only. Typing an age on the
  paediatric tab left the home card blank.
- **Normalised on entry (F24).** Any months ≥ 12 roll into years, in the *fields*
  as well as the display, so the two cards can never disagree.
- **Non-destructive.** Weight, height, sex and DOB no longer touch the age fields.
  A re-entrancy guard prevents the two cards ping-ponging, and each field is
  written only when the value actually differs, so the caret is not reset while
  typing.

| Entered | Fields become | Display reads |
|---|---|---|
| 17 months | 1y 5m | `1y 5m` |
| 12 months | 1y 0m | `1y 0m` |
| 23 months | 1y 11m | `1y 11m` |
| 1y + 17m | 2y 5m | `2y 5m` |
| 30 months (home card) | 2y 6m | `2y 6m` |
| 11 months | 0y 11m | `11m` |

The stray `max="11"` was also dropped from both months inputs — it never enforced
anything (F13), and now that 17 resolves to 1y 5m the constraint is meaningless.

## D.3 New test suite: `calc/dom.test.js`

The other suites test logic and data. This one tests **wiring** — which handler
fires, what it writes where, and what the user ends up seeing. 16 tests, covering
the age sync in both directions, normalisation from either card, clearing,
DOB-driven population, the airway-stability regression from F30, and each of the
Tier 1 fixes as rendered.

It needs jsdom, which this repo does not depend on (it ships as one static HTML
file). The test **skips cleanly** when jsdom is absent, so `run-all.sh` stays
dependency-free:

```sh
npm install --no-save jsdom && node calc/dom.test.js
```

`calc/syntax.test.js` was added at the same time: it parses the inline script and
checks that every `oninput`/`onclick`/`onchange` handler resolves to a defined
function — 49 of them. A botched edit to a 2,300-line inline script otherwise
fails silently in the browser.

## D.4 Verification

| | |
|---|---|
| Syntax | 2,382 lines parse; all 49 inline handlers resolve |
| Equivalence | 11,263 checks, 0 mismatches |
| Logic tests | 41 passed, 0 failed, 13 pending |
| Data tests | 16 passed, 0 failed, 3 pending |
| DOM tests | 16 passed, 0 failed |

---

# Addendum E — Tier 2

**7 September 2026.** F5, F7, F8, F9, F10, F11, F13, F17, F18 and F21 fixed.

## E.1 Airway sizing (F5)

Cole's formulae were being extrapolated past both ends of their range.

**Under 1 year** is now a weight-banded lookup with depth = weight + 6 cm:

| Weight | Uncuffed | Cuffed | Was |
|---|---|---|---|
| <1 kg | 2.5 | — | 4.0 mm at 12 cm |
| 1–2 kg | 3.0 | — | 4.0 mm at 12 cm |
| 2–3 kg | 3.0 | 3.0 | 4.0 mm at 12 cm |
| >3 kg (term) | 3.5 | 3.0 | 4.0 mm at 12 cm |

A term 3.5 kg neonate now gets **3.5 mm at 9.5 cm** instead of 4.0 mm at 12 cm.
12 cm at the lip in a neonate is frankly endobronchial.

**The weight → age fallback** inverted the *infant* formula and read the result as
years. Each APLS band is now inverted on its own terms:

| Weight | Was read as | Now | ETT was → now |
|---|---|---|---|
| 20 kg | 6.0 y | 4.3 y | 5.5 → 5.5 mm |
| 30 kg | 11.0 y | 7.7 y | **7.0 → 6.0 mm** |
| 40 kg | 16.0 y | 11.0 y | **8.0 → 7.0 mm** |
| 50 kg | 21.0 y | *refused* | 9.5 mm → refused |

Sizing is also refused above 12 years, where it previously extrapolated to a
**14 mm** tube, and the output now states its basis — sized by age, sized by
weight, or age estimated from weight.

The infant band table is marked **CLINICAL VALUES — confirm against your
institution's own guideline** in the source. Cole's itself is unchanged above 1
year.

**Caught while testing this:** `ageKnown` was `(yr > 0 || mo > 0)`, so a term
neonate entered as 0y 0m counted as *no age at all* and fell through to the
estimate-from-weight path, which then refused it. Zero is a valid age; the test
is now whether the field was filled in.

## E.2 Maintenance fluid (F9)

Holliday-Segar, properly: 4 mL/kg/hr for the first 10 kg, 2 for the next 10, 1
beyond. The row shows "4-2-1 rule" and a whole mL/hr rate.

| Weight | Was | Now |
|---|---|---|
| 10 kg | 40 | 40 |
| 20 kg | **80** | 60 |
| 30 kg | **120** | 70 |
| 45 kg | **180** | 85 |

## E.3 The adult table now agrees with the app's own emergency pages

In every one of these the emergency algorithm was the better-sourced side, so the
table was brought to it — not the reverse.

| Drug | Table was (70 kg) | Now | Emergency page says |
|---|---|---|---|
| Atropine max | 6 mg | **3 mg** | 3 mg *(ANZCOR 11.9)* |
| Aminophylline | 700 mg (10 mg/kg) | **350 mg** (5 mg/kg, cap 500) | 400 mg over 15 min |
| Salbutamol IV | 700 mcg (10 mcg/kg) | **250 mcg** (4 mcg/kg, cap 250) | 250 mcg slow push |
| Esmolol load | 70–140 mg (1–2 mg/kg) | **35–70 mg** (0.5–1 mg/kg) | 10 mg boluses |
| Ephedrine | 17.5 mg (0.25 mg/kg) | **3–9 mg** titrated | 9 mg boluses |
| Metoprolol | 1–5 mg | **2.5–15 mg** | 2.5 mg boluses, max 15 mg |
| Propofol infusion | 25–75 mcg/kg/min | **50–150** | its own note said 50–150 |

Aminophylline and salbutamol also gained maintenance infusion rates, which they
previously lacked entirely.

**F11 — the sugammadex note had the block depths reversed.** It read "Deep: 16
mg/kg; moderate: 4 mg/kg"; it now reads moderate (T2 present) 2 mg/kg, deep
(PTC 1–2) 4 mg/kg, immediate rescue 16 mg/kg — matching the app's own Failure to
Wake page.

## E.4 oMEDD (F7, F8)

- **The footnote now lists the factors the code actually uses.** It said
  buprenorphine patch **× 25** where the code used 2.4, and omitted IV/SC
  oxycodone and tapentadol entirely.
- **The tab now says methadone is excluded**, in a highlighted panel, with the
  reason (ANZCA excludes methadone, transmucosal fentanyl and neuraxial opioids
  because their pharmacokinetics are complex and variable) and where to go
  instead. Previously a patient on methadone silently scored zero for it.
- The **cross-tolerance warning** that the Opioid Conversion tab already carried
  is now on the oMEDD tab too.

The **factors themselves are unchanged** — F6, F28 and F29 remain open, see E.6.

## E.5 Input validation (F13)

The `min`/`max` attributes were decorative: they bind only on form submission or
an explicit `checkValidity()` call, and this page has neither. A weight of 9000
or an age of 400 went straight through `parseFloat` and was dosed on.

Guards now clamp on **change** (blur or Enter), never on **input** — clamping
mid-keystroke would rewrite "1" to "10" while someone types "15". While typing,
an out-of-range value is flagged with a red border and a tooltip but left alone.
Clamping re-fires the dependent calculations, so the displayed doses follow the
clamped value.

Attached to all 16 bounded numeric inputs. The months fields lost their inert
`max="11"` and gained real bounds, since 17 months is now a legitimate entry that
resolves to 1y 5m.

## E.6 Still open after Tier 2

**F6 needs your decision.** The two opioid tools disagree by 2× on IV fentanyl
(0.1 vs 0.2 per mcg) and 34 % on IV oxycodone. Making them agree means choosing
which table to adopt, and ANZCA's value for parenteral fentanyl (0.3) matches
neither. That is a clinical call, not a refactor.

**F28/F29 remain provisional and unapplied** — tramadol and tapentadol factors.
They rest on search-derived evidence, which is what produced the retracted F27,
and need a read of ANZCA PS01(PM) Appendix 2.

Also open: F14 (the two body-weight calculators diverge when TBW < IBW), F15
(DOB borrow), F16 (methadone round-trip), F19 (Devine below range in the
body-weight boxes — the LA path is fixed, these two displays are not), F20 (5–6 y
over-estimate), F22 (regional volumes have no weight input), F23 (dantrolene and
Intralipid hard-code 70 kg), F25 (UTC date parsing), F26 (IM ketamine
concentration).

## E.7 Verification

| | |
|---|---|
| Syntax | 2,526 lines parse; all 49 inline handlers resolve |
| Equivalence | 12,065 checks against the live `index.html`, 0 mismatches |
| Logic | 47 passed, 0 failed, 10 pending |
| Data | 26 passed, 0 failed, 2 pending |
| DOM | 28 passed, 0 failed |

The data suite now cross-checks the adult table against the emergency-page text
directly, so this class of drift fails the build rather than being rediscovered.

---

# Addendum F — Tier 3

**7 September 2026.** F14, F15, F16, F19, F20, F22, F23, F25 and F26 fixed. Only
F6, F28 and F29 remain, and all three are held deliberately (F.9).

## F.1 One body-weight implementation (F14, F19)

The patient card and the drugs tab each had their own copy of Devine,
Janmahasatian and adjusted body weight, and they disagreed. Both now call one set
of shared functions.

**The drugs-tab copy returned IBW when TBW ≤ IBW**, producing an "adjusted body
weight" *larger than the patient* — the dangerous direction for anything dosed on
ABW:

| Patient | Patient card | Drugs tab (was) | Both now |
|---|---|---|---|
| 45 kg, 170 cm ♀ | 45 kg | **61 kg** | 45 kg |
| 50 kg, 175 cm ♂ | 50 kg | **70 kg** | 50 kg |
| 55 kg, 180 cm ♂ | 55 kg | **75 kg** | 55 kg |

A property test now asserts ABW never exceeds TBW across 40–200 kg at three
heights.

**Devine declines below 152.4 cm** rather than clamping to zero. A 140 cm patient
previously showed an IBW of 34/29 kg and a 100 cm child 2.6/0 kg; both displays
now read "—" with *Devine not valid <152 cm*. Lean body weight is still shown,
since Janmahasatian has no such floor.

## F.2 Age from date of birth (F15, F25)

`Math.max(0, mo - 1)` swallowed the day-of-month borrow instead of decrementing
the year, so the day before a birthday read as the full year — which could push a
child across the 12-month APLS band:

| DOB | On | Was | Now |
|---|---|---|---|
| 2020-03-15 | 2026-03-10 | 6y 0m | **5y 11m** |
| 2025-06-20 | 2026-06-10 | 1y 0m | **0y 11m** |
| 2030-01-01 | 2026-09-05 | **−4y 8m** | refused and flagged |

Date inputs are also parsed as **local** dates now (**F25**). `new Date('2000-05-15')`
is UTC midnight, which renders as the previous day anywhere west of UTC — a
consent document could carry a DOB one day early.

A property test walks a DOB forward a week at a time for ~40 years and asserts the
age never goes backwards and months stay in 0–11.

## F.3 The 5–6 year gap (F20)

APLS defines 1–5 and 6–12 with nothing between. Selecting on `yr <= 5` sent every
child from 5.01 years to the 6–12 formula:

| Age | Was | Now |
|---|---|---|
| 5.0 y | 18 kg | 18 kg |
| 5.5 y | **23.5 kg** | 19 kg |
| 5.9 y | **24.8 kg** | 19.8 kg |
| 6.0 y | 25 kg | 25 kg |

The band is now chosen by **completed years**, with fractional age still used
inside a band so the curve stays smooth. A test asserts monotonicity across every
month from 3 to 144.

## F.4 Methadone round-trips exactly (F16)

Ripamonti bands the ratio on the **oMEDD**, so converting *from* methadone has to
solve for the band. The old code banded on the methadone dose using different
cut-points, so the two directions were not inverses.

The reverse now tries the ratios in ascending order and takes the first
self-consistent one:

| Methadone | Was | Now | Round-trip |
|---|---|---|---|
| 7.5 mg | 30 mg oMEDD → back to 5 mg *(−33 %)* | 45 mg | **exact** |
| 15 mg | 90 → 11.3 mg *(−25 %)* | 120 mg | **exact** |
| 20 mg | 120 → 15 mg *(−25 %)* | 160 mg | **exact** |
| 50 mg | 400 → 33.3 mg *(−33 %)* | 600 mg | **exact** |

The forward direction is unchanged and still matches the displayed Ripamonti
table exactly (60 mg oMEDD → 10 mg methadone). Note the reverse now returns a
**higher** oMEDD than before — the conservative direction when assessing risk.

## F.5 Regional block volumes (F22)

The "do not exceed max dose" caveat was on some blocks and not others — notably
absent from fascia iliaca, whose 30–40 mL of 0.5 % bupivacaine is 200 mg against a
150 mg ceiling. It is now appended to **every** block that does not already carry
one, pointing at the LA Toxicity calculator.

This does not make the regional tab weight-aware; the volumes are still static
text. That remains a design limitation rather than a defect.

## F.6 Dantrolene and Intralipid follow the patient (F23)

Both showed a hard-coded 70 kg worked example while the app already knew the
weight. At 100 kg:

| | Was | Now |
|---|---|---|
| Dantrolene 2.5 mg/kg | ~175 mg = 9 vials | **250 mg = 13 vials** |
| Intralipid bolus 1.5 mL/kg | ~100 ml | **150 ml** |
| Intralipid infusion 15 mL/kg/hr | ~1000 ml/hr | **1500 ml/hr**, max total 1200 ml |

The infusion line now also states the **12 mL/kg cumulative maximum** in millilitres,
which previously appeared only as a per-kg figure elsewhere on the panel. With no
weight entered, both fall back to the 70 kg example.

## F.7 IM ketamine (F26)

5 mg/kg at 10 mg/mL is **10 mL intramuscularly** for a 20 kg child. The row now
offers 100 mg/mL and 50 mg/mL, giving 1 mL.

## F.8 Verification

| | |
|---|---|
| Syntax | 2,619 lines parse; all 49 inline handlers resolve |
| Equivalence | 12,065 checks against the live `index.html`, 0 mismatches |
| Logic | 52 passed, 0 failed, 4 pending |
| Data | 30 passed, 0 failed, 2 pending |
| DOM | 38 passed, 0 failed |

## F.9 What is left, and why

**Three findings remain, all held on purpose.**

- **F6** — the opioid conversion tab and the oMEDD tab disagree by 2× on IV
  fentanyl (0.1 vs 0.2 per mcg) and 34 % on IV oxycodone. Reconciling them means
  choosing which factor table to adopt, and ANZCA's value for parenteral fentanyl
  (0.3) matches neither. That is a clinical decision.
- **F28 / F29** — tramadol and tapentadol factors. Provisional on search-derived
  evidence, which is what produced the retracted F27. They need a read of ANZCA
  PS01(PM) Appendix 2, which this environment cannot fetch.

Six pending tests across the two suites hold all three. Each fails today by
design and names its finding, so whichever way you decide, the target behaviour is
already written down.

---

# Addendum G — The ANZCA table, read from the primary source

**7 September 2026.** The user supplied **ANZCA FPM PS01(PM) Appendix 2, Opioid
Dose Equivalence Calculation Table, October 2025**. F6, F28 and F29 are now
resolved against it, and one of my own claims is corrected.

## G.1 Correction: parenteral fentanyl is 0.2, not 0.3

**I reported the ANZCA factor for parenteral fentanyl as 0.3, in Addendum A and
again when asked directly. The published value is 0.2.**

That means the **Opioid Conversion tab was correct all along** — its 50 mcg ≡ 10 mg
PO morphine is exactly 0.2 — and only the oMEDD tab (0.1) was wrong. My advice
that "neither tool is right" was itself wrong; one of them was right.

The 0.3 came from a search summary paraphrasing "fentanyl (IV, PO, IM) conversion
factor 300", which is a mg-basis figure from a different table, not ANZCA's
mcg-basis 0.2. This is the same failure mode as the retracted F27 — a number
lifted from a secondary description of a primary document — and it is the reason
F28/F29 were held rather than applied. That caution was correct even though the
specific claim behind it was not.

## G.2 The table as published

| Route | Drug | Unit | Factor |
|---|---|---|---|
| Oral | Morphine | mg/day | 1 |
| Oral | Oxycodone | mg/day | 1.5 |
| Oral | Hydromorphone | mg/day | 5 |
| Oral | Codeine | mg/day | 0.13 |
| Oral | Dextropropoxyphene | mg/day | 0.1 |
| Oral | Tramadol | mg/day | 0.2 |
| Oral | Tapentadol | mg/day | 0.3 |
| Sublingual | Buprenorphine | mg/day | 40 |
| Rectal | Oxycodone | mg/day | 1.5 |
| Transdermal | Buprenorphine | mcg/hr | 2 |
| Transdermal | Fentanyl | mcg/hr | 3 |
| Parenteral | Morphine | mg/day | 3 |
| Parenteral | Oxycodone | mg/day | 3 |
| Parenteral | Hydromorphone | mg/day | 15 |
| Parenteral | Codeine | mg/day | 0.25 |
| Parenteral | Pethidine | mg/day | 0.4 |
| Parenteral | Fentanyl | mcg/day | **0.2** |
| Parenteral | Sufentanil | mcg/day | 2 |

## G.3 What the app had, scored against it

| Preparation | ANZCA | Conversion tab | oMEDD tab |
|---|---|---|---|
| Oral morphine | 1 | ✓ | ✓ |
| Oral oxycodone | 1.5 | ✓ *(1.515)* | ✓ |
| Oral hydromorphone | 5 | ✓ | ✓ |
| Oral codeine | 0.13 | ✓ *(0.133)* | **0.15, +15 %** |
| Oral tramadol | 0.2 | **0.1, −50 %** | **0.1, −50 %** |
| Oral tapentadol | 0.3 | **0.4, +33 %** | **0.4, +33 %** |
| Parenteral morphine | 3 | ✓ | ✓ |
| Parenteral oxycodone | 3 | ✓ *(3.03)* | **2, −33 %** |
| Parenteral hydromorphone | 15 | *absent* | ✓ |
| **Parenteral fentanyl** | **0.2** | **✓** | **0.1, −50 %** |
| Transdermal fentanyl | 3 | *absent* | **2.4, −20 %** |
| Transdermal buprenorphine | 2 | *absent* | **2.4, +20 %** |

Six preparations were missing from both tools entirely: oral dextropropoxyphene,
sublingual buprenorphine, rectal oxycodone, parenteral codeine, parenteral
pethidine and parenteral sufentanil.

## G.4 The fix — one table, both tools derived from it

`ANZCA_OPIOIDS` is now the single source. The conversion tab's "equivalent to
10 mg PO morphine" column is computed as `10 / factor`; the oMEDD dropdown is
built from the same array. **Neither tool stores a factor of its own**, so they
cannot drift apart again — a test asserts exactly that, and another asserts the
table matches the published values entry by entry.

All 18 preparations are now offered. Methadone remains deliberately absent, as
ANZCA excludes it along with transmucosal fentanyl and neuraxial opioids; the
Ripamonti method on the conversion tab still handles it, with the exclusion
stated on screen (F8).

**Also added: the take-home naloxone prompt.** The source document states that at
a calculated oMEDD **≥ 40 mg/day**, take-home naloxone and patient education are
recommended. The oMEDD tab now says so. The app's existing 100 and 200 mg/day
warnings are retained above it.

The on-screen factor list is now **generated from the table** rather than written
by hand — which is what let it drift to "buprenorphine patch × 25" against a coded
2.4 in the first place — and carries the source and date.

## G.5 What this changes clinically

| Patient | Was | Now |
|---|---|---|
| 600 mcg/day parenteral fentanyl | 60 mg *(oMEDD tab)* | **120 mg** |
| 75 mcg/hr fentanyl patch | 180 mg | **225 mg** |
| 400 mg/day tramadol | 40 mg | **80 mg** |
| Oxycodone 40 mg/day *(ANZCA's own worked example)* | 60 mg | 60 mg ✓ |

Every change except tapentadol raises the calculated oMEDD, so the ≥40, ≥100 and
≥200 mg/day prompts now fire earlier — which is the direction that matters for
recognising a high-risk patient.

## G.6 F3 completed at the same time

The adult lint still had two rows: **PCC** claimed "Max 3000 units" with no
`maxDose` (50 units/kg at 90 kg is 4500), now capped. **Protamine**'s ceiling is
not weight-based, so its note was reworded to say the dose is calculated from the
heparin actually given rather than leaving a prose maximum the lint reads as
unenforced.

## G.7 Verification

| | |
|---|---|
| Syntax | 2,677 lines parse; all 49 inline handlers resolve |
| Equivalence | 12,065 checks, 0 mismatches |
| Logic | 56 passed, 0 failed, **0 pending** |
| Data | 36 passed, 0 failed, **0 pending** |
| DOM | 42 passed, 0 failed |

**All 30 findings are now closed** — 29 fixed, F27 retracted. There are no pending
tests left.

---

# Addendum H — index.html rewired onto the module

**8 September 2026.** The last structural item from §C.2 and the merge notes.

## H.1 What changed

`index.html` carried its own copy of every calculation, kept in step with
`calc/calculators.js` by hand and policed by an equivalence harness. It now
**loads** the module:

```html
<script src="calc/calculators.js"></script>
```

and brings the shared names into scope as the first statement of its inline
script. **15 functions and 11 constants** were deleted from `index.html`, which
drops from 2,680 to 2,551 lines. There is now one definition of each.

Three module functions were renamed to `index.html`'s clearer names —
`lbw` → `janmahasatianLBW`, `abw` → `adjustedBW`,
`airwayAgeFallback` → `airwayAgeFromWeight`.

## H.2 The equivalence harness is retired, and replaced

`calc/live.js` and `calc/equivalence.js` are deleted. They existed to prove two
copies agreed across ~12,000 swept inputs; with one copy there is nothing to
compare. What needs guarding now is different, so
**`calc/no-duplication.test.js`** asserts that:

- `index.html` loads the module, and does so *before* the inline script
- it redefines none of the module's functions or constants
- every name in the `const { … } = Calc;` list is actually exported
- every module name the page uses appears in that list

**The last two are not ceremony.** A name destructured but not exported is
`undefined` at runtime, not an error — the page loads and the calculation
quietly misbehaves. The guard caught exactly that during this change:
`DEVINE_MIN_HEIGHT_CM`, `APLS_MAX_MONTHS`, `MAINTENANCE_KEY`,
`COLE_MIN_AGE_YEARS` and `AIRWAY_MAX_AGE_YEARS` were destructured before the
module exported them, which would have broken `getIBW`, `calcPaed` and
`renderAirway` in the browser while every other test still passed.

## H.3 Trade-off

The page is no longer a single self-contained file. Both files are served from
the same origin by GitHub Pages, so normal use is unaffected; saving the page
locally now needs `calc/calculators.js` beside it. The app already loads its
images over the network, so it was not self-contained to begin with.

## H.4 Verification

| | |
|---|---|
| Syntax | 2,551 lines parse; all 49 inline handlers resolve |
| No duplication | 6 passed, 0 failed |
| Logic | 56 passed, 0 failed, 0 pending |
| Data | 36 passed, 0 failed, 0 pending |
| DOM | 43 passed, 0 failed |

The DOM suite gained a test that loads the page the way a browser does —
`resources: 'usable'`, real `<script src>` — and checks that `window.Calc` is
defined and the paediatric weight computes from it. Its other tests inline the
module in place of the tag to stay synchronous.
