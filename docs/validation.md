# Validation Guide

This project relies on deterministic simulation behavior. Use the steps below to validate baseline quality and replay consistency.

## 1) Install dependencies

```bash
npm install
```

Expected signals:
- **Pass**: install completes with exit code `0`.
- **Fail**: dependency resolution/install error, non-zero exit code.

## 2) Lint check

```bash
npm run lint
```

Expected signals:
- **Pass**: command exits `0` with no lint errors.
- **Fail**: ESLint reports errors and exits non-zero.

## 3) Deterministic scenario regression

Run the registered logistics regression scenario with fixed inputs:

```bash
npx tsx src/scenarios/run.ts LogisticsValidation 3650 12345
```

Expected signals:
- **Pass**:
  - Log output includes `Scenario Logistics Validation PASSED` (or equivalent pass log).
  - Command exits with code `0`.
  - Metric summary JSON is printed.
- **Fail**:
  - Output includes `FAILED` or `CRASHED`.
  - Command exits non-zero.

## 4) Determinism drift check

```bash
npx tsx src/scripts/verify_determinism.ts
```

Expected signals:
- **Pass**:
  - Output includes `SUCCESS: Simulation is deterministic!`.
  - No `drift_1.json`/`drift_2.json` files are created.
- **Fail**:
  - Output includes `FAILURE: Simulation drift detected!`.
  - Drift files are generated for diffing.

## 5) Optional baseline simulation script

```bash
npm run test:sims
```

Expected signals:
- **Pass**: script completes without runtime crash and exits `0`.
- **Fail**: thrown error/assertion failure or non-zero exit code.

---

## Interpreting failures

When validation fails:

1. Capture the full terminal output and failing command.
2. If determinism fails, inspect generated drift files and first differing line output.
3. Re-run with the same seed/tick inputs to confirm reproducibility.
4. Fix root cause before merging.
