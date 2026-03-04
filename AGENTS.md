# Agent Interaction Protocol

Welcome to the Nebula 4X codebase! If you are an autonomous AI Agent assigned to build or debug features, you MUST read this document and any applicable skills before making architectural or logic changes.

## 1. Core Architecture
All agents must review `agent/skills/ARCHITECTURE.md` before making any changes. This document outlines the absolute boundaries between the simulation engine (`src/engine`), the state store (`src/store`), and the React UI layer (`src/components`). **Do not violate these boundaries.**

## 2. Specialized Skills
We maintain a repository of knowledge files in `agent/skills/` to help you understand specific subsystems. Read the relevant skills to avoid re-discovering known bugs:
- **UI Design & BabylonJS**: See `agent/skills/babylonjs_react.md` and the `agent/skills/UI_Design_Reference/` folder for 3D interface constraints.
- **Combat Engine Mechanics**: See `agent/skills/combat_engine/SKILL.md` for crucial details about fleet pursuit logic, intersection plotting horizons, fuel starvation caveats for NPC hazard factions, target state persistence, and engagement buffering. 

## 3. Simulation Determinism
As noted in the `README.md`, the simulation MUST remain 100% deterministic so multiplayer clients can stay in sync from a shared seed. 
- Use the seeded `RNG` instance passed through engine functions.
- NEVER use `Math.random()`, `Date.now()`, or other ambient entropy.
- Update `walkthrough.md` with new test scenarios and validate using the simulation harness before proposing changes.
