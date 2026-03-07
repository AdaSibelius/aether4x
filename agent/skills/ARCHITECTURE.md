---
name: Architecture
description: Mandatory design contract and system ownership map for Aether4X. Cross-reference this before proposing any code changes or new features.
---

# Aether4X System Architecture

## Overview
Aether4X is a deterministic, tick-based grand strategy simulation built with Next.js, React, and a custom TypeScript simulation engine. The architecture enforces strict unidirectional data flow and separates visual presentation from deep economic and physics simulations.

---

## System Ownership & Responsibilities

A core design tenet of Aether4X is strict separation of concerns. Future developers and agents must adhere to the boundaries defined below to prevent regressions and desyncs.

### 1. The Simulation Engine (`src/engine/`)
**Owner of:** All game logic, economic balancing, physics, RNG, and canonical state mutations.
**Golden Rule:** The Engine is the **only** system allowed to compute mechanics and mutate the `GameState`. UI interactions are merely requests; the Engine resolves them during the tick cycle.

- **`time.ts` (The Conductor):** Orchestrates the simulation loop. It computes the `dt` (time delta), initializes the seeded deterministic `RNG`, and sequentially invokes all subsystem ticks.
- **`colonies.ts` & `economy.ts` (The Foundation):** Processes population dynamics, facility production, planetary extraction, market supply/demand, price elasticity, and cost-of-living wealth sinks.
- **`corporations.ts` & `finances.ts` (The Private Sector):** Simulates independent corporate AI, dynamic company formation, fleet logistics, revenue pooling, and state treasury taxation.
- **`fleets.ts` & `realspace.ts` (Physics):** Manages Newtonian-style transit, fuel consumption, orbit synchronization, and jump point mechanics.
- **`constants.ts` (The Balancer):** Centralized tuning parameters. If an economic output feels wrong, adjust the constants here rather than hardcoding multipliers in logic processing logic.
- **`ai_utils.ts` (AI Ergonomics):** A read-only utility layer that abstracts complex systems (combat power evaluation, stealth visibility, planetary defense vulnerability) into flat heuristics for AI agents to easily evaluate the board state without recalculating physics or parsing component arrays.

### 2. State Management (`src/store/`)
**Owner of:** The serializable object tree (`GameState`) and application views (`UIState`).
**Golden Rule:** State must be updated via explicit, predictable store actions (intents).

- **`gameStore.ts`**: The central Zustand store containing the entire universe snapshot (Empires, Colonies, Ships, Galaxy). It exposes safe updater actions (e.g., `transferFunds`, `updatePolicy`) that act as APIs for the frontend.
- **`uiStore.ts`**: Handles transient, non-simulated frontend state. Examples include the current tab, the actively selected entity on the map, and camera pan/zoom coordinates. This state is ephemeral and intentionally excluded from save files.

### 3. User Interface (`src/components/`, `src/app/`)
**Owner of:** Reading state, rendering DOM/WebGL, and dispatching user intents.
**Golden Rule:** UI components **must never** implement core game rules, calculate secondary simulation effects, or bypass store actions to modify data.

- **Data Fetching:** Components selectively subscribe to narrow slices of the `gameStore` to ensure high-performance rendering.
- **Interactions:** User inputs dispatch intents to the store. For instance, clicking "Extract Aether" doesn't manually increment an inventory; it dispatches an order, and the Engine handles the extraction over time.
- **Key Modules:** `SystemMapBabylon` (BabylonJS viewport), `ColonyManager` (economic dashboards), `Economy` (macro-level corporate reporting).

### 4. Domain Contracts (`src/types/`)
**Owner of:** The structural definition of the universe.
**Golden Rule:** If a property (like a new resource or ship component) needs to exist, its TypeScript interface must be defined here first.

- Central domain files (`colony.ts`, `empire.ts`, `fleet.ts`) ensure absolute type safety between what the engine expects and what the UI renders.

---

## Control Flow Execution

To illustrate how these systems interact without violating ownership, consider the process of a player ordering a new factory:

1. **User Action:** The player clicks "Add Factory to Queue" in `<ColonyManager />`.
2. **Intent Dispatch:** The UI component calls `gameStore.getState().addProductionItem(colonyId, factoryItem)`.
3. **Queue Update:** The `gameStore` action cleanly appends the item to the colony's `productionQueue` array.
4. **Tick Advance:** The user unpauses or manually advances the clock. `time.ts` fires next.
5. **Logic Resolution:** The engine hands the colony to `colonies.ts`, which reads the top of the queue, deducts the necessary `Iron` and `Machinery` costs from the colony inventory, and increments the build progress based on available labor and infrastructure.
6. **State Mutation:** `colonies.ts` writes the modified `Colony` object back to the state draft.
7. **Re-render:** The tick concludes, Zustand emits a state change, and `<ColonyManager />` automatically re-renders with the new progressed queue and updated mineral counts.
