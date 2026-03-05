---
name: Nebula 4X Combat Engine Guide
description: Documentation on how the fleet pursuit, engagement, and combat resolution mechanics work in Nebula 4X, specifically highlighting bugs to avoid when designing AI factions.
---

# Nebula 4X Combat Engine Guide (For AI Agents)

This document explains the mechanics of the Nebula 4X fleet combat engine. It is written specifically for AI agents to understand how fleet pursuit, engagement, and combat resolution function, highlighting several critical architectural fixes that were necessary to make NPC AI (like Pirates) behave correctly.

If you are modifying fleet behavior or debugging why a fleet is "not attacking," "flying away," or "following at a distance," look closely at the **Key Mechanics & Fixes** below.

---

## 1. Fleet Speeds & Engine Mismatches

**The Problem**: A pursuing fleet MUST be mathematically faster than its target to catch it. If both fleets are moving, a slower pursuing fleet will inherently never reach a faster target.
**The Fix**: In the `setup.ts` initial design configuration, the Pirate faction (NPCs) originally used basic 19th-century steam engines (`engine_furnace_sm`), capping their speed at 0.012 AU/day. The player's civilian freighters used medium engines capping at 0.028 AU/day. The pirates were literally being outrun. We upgraded the NPC Pirate designs to use Steampunk `Ambergris Drives` (0.03 AU/day) so they could hunt effectively.
**Takeaway**: When designing hostile NPC factions, ensure their nominal sub-light speed is greater than the standard civilian fleeing speed, or they will become irrelevant.

---

## 2. The Interception Prediction Horizon

**The Problem**: To catch a moving target (a fleet or an orbiting planet), a ship calculates an intercept path (`calculateFleetInterceptPosition`) using the target's current speed and trajectory. Initially, the engine solved for the *exact* future collision point. Because ships in this universe move very slowly (taking months to cross an AU), the calculated intercept point was hundreds of days in the future. If targeting an orbiting planet (like Earth), the prediction would place the intercept point on the complete opposite side of the solar system, causing the attacking fleet to fly *away* from the planet's current position to meet it a year later.
**The Fix**: In `fleets.ts`, the `timeToInterceptDays` variable is strictly clamped to a maximum of **14 Days**. 
**Takeaway**: By capping the prediction horizon, fleets now execute organic pursuit curves. They aim slightly ahead of the target (where it will be in two weeks), constantly adjusting their heading as the target moves, rather than trying to perfectly predict distant orbital mechanics.

---

## 3. Fuel Starvation & NPC Logistics

**The Problem**: Fleets consume fuel (Phlogiston) as they move. When a fleet runs out of fuel, its speed drops to 10% of maximum (e.g., from 0.024 AU/day to 0.0024 AU/day). An NPC Pirate fleet spawned at the start of the game with 500 fuel capacity ran out of fuel exactly 84 days into the simulation. A civilian freighter they were chasing simply drove away at full speed, leaving the pirates permanently stranded in deep space, "following at a distance" at a crawl.
**The Fix**: Non-player hazard factions (like `empire_pirates`) are strictly exempted from fuel drainage and the out-of-fuel speed penalty in `getFleetSpeed` and `handleFleetMovement`.
**Takeaway**: For persistent NPC hazards that exist purely to challenge the player, abstract away their logistics. Do not force them to adhere to fuel economies unless you are simultaneously building complex AI logic for them to return to base to refuel.

---

## 4. Engagement Range Buffering

**The Problem**: A fleet's `processAttackOrder` calculates a destination to move towards the target. Initially, it was told to stop moving exactly when `distance <= maxRange` (e.g., 0.3 AU). Because fleets update sequentially in `tickFleets`, if the Pirate moved to exactly 0.3 AU and stopped, and then the fleeing target moved slightly away in the same tick (to 0.301 AU), the physical combat resolution phase (which runs *after* all movement) would see the Pirate out of range. The weapons would not fire, and the fleets would "stutter" at the edge of maximum range indefinitely.
**The Fix**: The `followDist` in `processAttackOrder` is mathematically set to **80% of `maxRange`** (`(order.engagementRange ?? maxRange) * 0.8`).
**Takeaway**: Always build a spatial buffer into engagement distances. Forcing the pursuing fleet to close deeply into weapon range (80%) guarantees that minor positional shifts by the target during the tick loop will not immediately pull them out of firing range.

---

## 5. Target State Persistence (The Visual Fix)

**The Problem**: When a fleet destroys its primary target, `processAttackOrder` automatically searches for the next closest enemy (`nextTarget`). Initially, it updated the `order.targetFleetId` in the order queue, but then immediately `return;`'d. Because the engine clears the visual `combatTargetFleetId` when a ship dies, this created a 1-tick delay (1 in-game day) where the pirate appeared to have no target, and the red combat laser line drawn by BabylonJS disappeared, confusing the player.
**The Fix**: When jumping to the next target, we update the local `targetFleet` variable instead of returning, allowing the rest of the tick (range calculations, engagement flag setting) to execute seamlessly on the new target in the *exact same tick*.
**Takeaway**: Ensure that state machine transitions (like target switching) completely update all localized scoped variables in the engine loop so the tick resolves comprehensively, preventing 1-frame visual or mechanical glitches. Furthermore, AI agents should note that weapons have long cool-downs (e.g., *Aetheric Discharge Emitters* fire once every 12 hours). If a ship looks like it "isn't attacking," but the target line is drawn, it is merely waiting for its weapon ROF cooldown.


---

## 6. Colony Bombardment & Planetary Assault

**The System**: The engine supports orbital strikes on colonies using the `Bombardment` ShipComponentType. When a fleet has the `Bombard` order, it calls `resolveOrbitalBombardment` every tick, reducing the colony's `groundDefenses`. Once defenses hit 0, the invasion can proceed or the colony suffers collateral damage.
**Takeaway for AI**: Do not rely on weapon DPS to take a planet. Regular weapons (`Weapon` type) only damage ships. You MUST equip ships with specific `Bombardment` weapons (like the Kinetic Mass Driver) to reduce planetary defenses. Use the `getVulnerableColonies` helper in `ai_utils.ts` to evaluate soft targets.

---

## 7. Aetheric Signatures, Stealth, and Active Scanning

**The System**: Fleets are no longer universally visible. The `detection.ts` system calculates a fleet's `signature` based on its total Hull Size and Power Draw. `StealthHull` components deeply reduce this signature. To see a stealth fleet, the viewing fleet must have sufficient `sensorRange` and `sensorResolution` relative to the distance and the target's signature. Activating a fleet's `isActiveScanning` toggle doubles resolution but increases its own signature by 50%.
**Takeaway for AI**: Fleets cannot attack what they cannot see. `processAttackOrder` strictly checks `fleet.detectedByEmpireIds`. AI logic must query `getDetectedHostileFleets(empireId, starId, state)` from `ai_utils.ts` to build their "known board state."

---

## 8. AI Ergonomics & Combat Power

**The System**: Complex calculations for win probability, detectability, and system value have been abstracted into `src/engine/ai_utils.ts`. 
**Takeaway for AI**: Do not parse the `ShipComponent` arrays manually to figure out who wins a fight. Use `calculateFleetCombatPower(fleet, state)` to get a flat numerical value of a fleet's strength, and `estimateBattleOutcome(fleetA, fleetB, state)` to run a heuristic before committing to an attack.
