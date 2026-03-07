# Aether4X Agent Walkthrough

Use this file to record deterministic validation scenarios added by feature work.

## Required Entry Format

For each simulation-impacting change, append one entry with:

1. Date (YYYY-MM-DD)
2. Change summary
3. Commands executed
4. Seed/tick inputs
5. Pass/fail result and key output signal

## Example

- Date: 2026-03-07
- Change: Agent preflight hardened (determinism harness + stable scenario gate).
- Commands:
  - `npm run test:scenario MarsIsolation 3650 12345`
  - `npm run test:determinism`
- Inputs: Scenario=`MarsIsolation`, Ticks=`3650`, Seed=`12345`
- Result: Pass.
