# Aether4X Architecture Overview

This document outlines the core architecture of the Aether4X simulation engine, state management, and the "Simulation Contract" that ensures determinism and reliability.

## Simulation Lifecycle

The game simulation follows a strictly ordered pipeline triggered by `advanceTick` in `src/engine/time.ts`.

### The Tick Pipeline

1.  **State Preparation**: Clones current state and increments global counters (date/turn).
2.  **Snapshotting**: (Optional) Captures state for history and debug purposes.
3.  **Empire & Institutional Logic**:
    - Research and Development.
    - National events and budget processing.
4.  **Colony Operations**:
    - Resource extraction (Mining).
    - Production and Construction.
    - Population growth and happiness.
5.  **Logistics & Physics**:
    - Aether harvesting (scooping from Gas Giants).
    - Fleet and ship movement.
    - Logistics and resource distribution.
6.  **Event Routing**: Distributes simulation-generated events to the appropriate empire event logs.
7.  **Audit & Integrity**: Validates conservation of mass and state consistency.

## Core Principles

### 1. Determinism (The RNG Contract)
- **Rule**: Never use `Math.random()` or `Date.now()` inside any simulation path (anything called during a tick).
- **Enforcement**: Always use the `RNG` instance provided by the tick orchestrator.
- **IDs**: Use `generateId(prefix, rng)` to ensure entity IDs are consistent across replays.

### 2. Immutability
- The simulation treats the current `GameState` as immutable and returns a `next` state.
- Entity modifications should be performed on clones.

### 3. Type Boundaries
- Avoid `any`. Use concrete interfaces defined in `src/types/`.
- Hard-typed boundaries ensure that refactors don't introduce silent state drift.

## Data Structure

### GameState
The central authority on the world state. Contains:
- `galaxy`: Static/semi-static celestial data.
- `empires`: National data (tech, treasury, fleets).
- `ships`: Detailed ship status.
- `colonies`: Detailed planetary status.

### The Store (Zustand)
- `src/store/gameStore.ts`: Manages the active `GameState`, UI bindings, and user commands.
- **Snapshots**: High-fidelity copies of the `GameState` stored for rollback and debugging.

## Debugging & Auditing
- **AuditService**: Periodically checks for resource "leakage" (Conservation of Mass).
- **Snapshot Diffing**: Allows comparing two points in time to identify drift or unexpected behavior.
