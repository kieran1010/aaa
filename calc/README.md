# `calc/` — extracted calculator logic

Pure calculation logic lifted out of `index.html` so it can be tested. See
`../CALCULATOR_AUDIT.md` for the findings these files refer to by ID.

**All 30 findings are closed** — 29 fixed, F27 retracted (Addenda B–G of the
audit). `index.html` loads this module rather than duplicating it, so there is
one definition of every calculation.

## Files

| | |
|---|---|
| `calculators.js` | The extracted functions. No DOM access. Each known defect is annotated with its finding ID — don't "tidy" an annotated line, the tests assert it. |
| `no-duplication.test.js` | Asserts `index.html` **loads** the module and redefines none of it, and that the `= Calc` destructuring list matches the module's exports. |
| `data.js` / `data.test.js` | Loads the drug data literals out of `index.html` and asserts on them — F2 and F3 are data defects, so they have to be tested against the real file. Includes the max-dose lint. |
| `calculators.test.js` | Pins current behaviour, and encodes the target behaviour for each open finding as a `pending()` test. |

## Running

No dependencies, no install. Node only.

```sh
./calc/run-all.sh               # everything

node calc/syntax.test.js          # index.html parses; every inline handler resolves
node calc/no-duplication.test.js  # index.html loads the module, does not redefine it
node calc/calculators.test.js     # 56 passing
node calc/data.test.js            # 36 passing
node calc/dom.test.js             # 53 passing  (needs jsdom)
```

`equivalence.js` exits non-zero on any divergence from `index.html`.
`calculators.test.js` exits non-zero only if a **passing** test breaks; pending
tests are expected to fail and do not fail the run.

## The workflow these files exist to support

`index.html` now **loads** `calculators.js`; it no longer carries its own copy.
So a fix is made once:

1. `./calc/run-all.sh` — confirm the baseline is green.
2. Change `calculators.js`.
3. Re-run. `calculators.test.js` covers the logic, `data.test.js` the drug data
   in `index.html`, `dom.test.js` the wiring as rendered.

If you add a name to the module and want the page to use it, add it to the
`const { ... } = Calc;` destructuring at the top of the inline script.
`no-duplication.test.js` fails if that list and the module's exports disagree —
which is worth having, because a missing name is silently `undefined` at runtime
rather than an error. It caught exactly that during the rewiring: five constants
were destructured that the module did not yet export.

## Pending tests

None. All 30 findings are closed — 29 fixed, F27 retracted — and every pending
test was promoted to `test()` as its fix landed.

## The one clinical value that is mine, not a guideline's

`INFANT_ETT` in `calculators.js` — tube sizes by weight under 1 year, and the
depth rule of weight + 6 cm. It replaced Cole's formulae extrapolated below
their valid range, which offered a term neonate 4.0 mm sited at 12 cm. It is
marked `CLINICAL VALUES` in the source and should be checked against your own
guideline.

F28/F29 are marked **provisional** in the audit — the ANZCA values behind them
could not be read from the primary document from this environment. Confirm
against PS01(PM) Appendix 2 before promoting that pending test.
