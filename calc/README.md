# `calc/` — extracted calculator logic

Pure calculation logic lifted out of `index.html` so it can be tested. See
`../CALCULATOR_AUDIT.md` for the findings these files refer to by ID.

**27 of the 30 findings are fixed** in both the module and `index.html`
(Addenda C–F of the audit). Only F6, F28 and F29 remain, all held deliberately —
see §F.9 of the report. The six `pending()` tests that hold them fail today by
design.

## Files

| | |
|---|---|
| `calculators.js` | The extracted functions. No DOM access. Each known defect is annotated with its finding ID — don't "tidy" an annotated line, the tests assert it. |
| `live.js` | Slices each function out of `index.html` and makes it callable, with a minimal DOM stub. This is what keeps the harness honest — it executes the code that ships, not a copy of it. |
| `equivalence.js` | Proves `calculators.js` matches those live functions across ~11k swept input points. |
| `data.js` / `data.test.js` | Loads the drug data literals out of `index.html` and asserts on them — F2 and F3 are data defects, so they have to be tested against the real file. Includes the max-dose lint. |
| `calculators.test.js` | Pins current behaviour, and encodes the target behaviour for each open finding as a `pending()` test. |

## Running

No dependencies, no install. Node only.

```sh
./calc/run-all.sh               # everything

node calc/syntax.test.js        # index.html parses; every inline handler resolves
node calc/equivalence.js        # must PASS before you trust anything below
node calc/calculators.test.js   # 52 passing, 4 pending
node calc/data.test.js          # 30 passing, 2 pending
node calc/dom.test.js           # 38 passing  (needs jsdom)
```

`equivalence.js` exits non-zero on any divergence from `index.html`.
`calculators.test.js` exits non-zero only if a **passing** test breaks; pending
tests are expected to fail and do not fail the run.

## The workflow these files exist to support

1. `node calc/equivalence.js` — confirm the baseline still holds.
2. Apply one fix in `calculators.js`.
3. `node calc/calculators.test.js` — the `pending()` test for that finding should
   now pass and appear in the "unexpectedly PASSED" list. **No other test may
   break.** If one does, the fix reached further than intended.
4. Promote that `pending()` to `test()` and delete the current-behaviour
   assertion it replaces.
5. Port the same change into `index.html`, then re-run `equivalence.js` — it
   should pass again, now against the fixed behaviour on both sides.

Step 5 is the one that is easy to skip and must not be: **`index.html` is still
the code that runs.** Until its inline copies are replaced by a `<script src>`
onto this module, the two must be kept in step by hand. `equivalence.js` is what
tells you whether they are — and because it executes the real functions out of
`index.html` rather than a transcription, forgetting step 5 fails the build
rather than passing quietly.

## Why `index.html` still carries its own copies

Replacing the inline functions with a `<script src="calc/calculators.js">` is the
obvious next step and would remove the duplication. It is not done here because
this is a live clinical tool served from GitHub Pages, and swapping its loading
model is a change worth making on its own, against a green baseline, rather than
folded in alongside an audit. The equivalence harness exists precisely so that
step can be taken later and verified.

## Pending tests

Six, holding the three findings that are deliberately unfixed:

| Finding | Why it is held |
|---|---|
| **F6** | The opioid conversion tab and the oMEDD tab disagree by 2× on IV fentanyl. Reconciling means choosing a factor table — a clinical decision, and ANZCA's value matches neither of the app's. |
| **F28 / F29** | Tramadol and tapentadol factors, provisional on search-derived evidence. That is what produced the retracted F27; they need a read of ANZCA PS01(PM) Appendix 2. |

Every other finding's pending test was promoted to `test()` as its fix landed.

F28/F29 are marked **provisional** in the audit — the ANZCA values behind them
could not be read from the primary document from this environment. Confirm
against PS01(PM) Appendix 2 before promoting that pending test.
