# `calc/` — extracted calculator logic

Pure calculation logic lifted out of `index.html` so it can be tested. See
`../CALCULATOR_AUDIT.md` for the findings these files refer to by ID.

**Nothing here has been fixed yet.** The module reproduces the application's
current behaviour exactly, defects included. That is deliberate: it is the
safety net the fixes get applied against.

## Files

| | |
|---|---|
| `calculators.js` | The extracted functions. No DOM access. Each known defect is annotated with its finding ID — don't "tidy" an annotated line, the tests assert it. |
| `equivalence.js` | Proves `calculators.js` is behaviourally identical to `index.html`, by pasting the original inline source and sweeping ~32k input points. |
| `calculators.test.js` | Pins current behaviour, and encodes the target behaviour for each open finding as a `pending()` test. |

## Running

No dependencies, no install. Node only.

```sh
node calc/equivalence.js        # must PASS before you trust anything below
node calc/calculators.test.js   # 35 passing, 16 pending
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
onto this module, the two must be kept in step by hand, and `equivalence.js` is
what tells you whether they are.

## Why `index.html` still carries its own copies

Replacing the inline functions with a `<script src="calc/calculators.js">` is the
obvious next step and would remove the duplication. It is not done here because
this is a live clinical tool served from GitHub Pages, and swapping its loading
model is a change worth making on its own, against a green baseline, rather than
folded in alongside an audit. The equivalence harness exists precisely so that
step can be taken later and verified.

## Pending tests

16, one or more per open finding: F1, F2, F3, F4, F5, F6, F9, F14, F15, F16,
F19, F20, F24, F28/F29. Each fails today by design.

F28/F29 are marked **provisional** in the audit — the ANZCA values behind them
could not be read from the primary document from this environment. Confirm
against PS01(PM) Appendix 2 before promoting that pending test.
