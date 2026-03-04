# Aether4X

Aether4X is a deterministic 4X simulation prototype built on Next.js for UI + TypeScript simulation systems for repeatable, auditable game-state evolution.

## Architecture map

For the full architectural walkthrough, see [`docs/architecture.md`](docs/architecture.md).

High-level map:

- **UI layer (`src/app`, `src/components`)**: Renders simulation state and user controls.
- **State layer (`src/store`)**: Zustand-backed runtime state and UI orchestration.
- **Simulation engine (`src/engine`)**: Tick orchestration plus economy, logistics, colonies, fleets, research, and event routing.
- **Domain types (`src/types`)**: Shared contracts for game entities and simulation data.
- **Scenario + script harnesses (`src/scenarios`, `src/scripts`)**: Determinism checks and regression-style simulation probes.
- **Docs (`docs`)**: Simulation contract and validation expectations.
- **AI Skills (`agent/skills`)**: Specialized documentation, constraints, and mechanics references exclusively for autonomous AI agents.

## Deterministic simulation rules

Deterministic behavior is non-negotiable for simulation code paths.

1. **No ambient entropy inside the tick path**: Do not use `Math.random()` or `Date.now()` in simulation logic.
2. **Use seeded RNG wiring only**: Pass the provided seeded RNG through simulation functions.
3. **Deterministic IDs**: Use project helpers that depend on the simulation RNG.
4. **Immutable tick progression**: Treat prior state as read-only and return a new next state.
5. **Stable replay expectation**: Same seed + same tick count must produce byte-for-byte equivalent state snapshots.

## Key scripts

- `npm run dev` — start the Next.js app locally.
- `npm run build` — production build.
- `npm run start` — run production server.
- `npm run lint` — static lint checks.
- `npm run test:sims` — run the current simulation scenario harness (`ExpansionTest.ts`).
- `npx tsx src/scenarios/run.ts LogisticsValidation 3650 12345` — run a registered deterministic scenario.
- `npx tsx src/scripts/verify_determinism.ts` — explicit determinism drift check.

## Validation expectations

Validation is successful when:

- Lint passes with no new warnings/errors.
- Scenario runs finish with a pass signal and exit code `0`.
- Determinism checks print success and produce no drift artifacts.

See [`docs/validation.md`](docs/validation.md) for exact commands and pass/fail signals.

## AI agent contribution checklist

Before opening a PR, AI agents should confirm:

- [ ] Read and followed applicable `AGENTS.md` instructions.
- [ ] Updated documentation when behavior or workflows changed.
- [ ] Kept simulation changes deterministic (seeded RNG only).
- [ ] Ran lint + relevant deterministic/scenario checks.
- [ ] Verified command outputs match documented pass/fail signals.
- [ ] Included focused commit messages and PR summary.
