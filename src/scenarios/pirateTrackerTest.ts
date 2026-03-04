import { setupNewGame } from '../engine/setup';
import { tickFleets } from '../engine/fleets';
import { RNG } from '../utils/rng';

const state = setupNewGame('Player', 42);
const pirateEmpire = state.empires['empire_pirates'];
const pirateFleet = pirateEmpire.fleets[0];
const playerEmpire = state.empires[state.playerEmpireId];

const rng = new RNG(12345);

const targetId = pirateFleet.orders[0]?.targetFleetId;
const targetFleet = playerEmpire.fleets.find(f => f.id === targetId)!;

console.log('--- Initial State ---');
console.log('Target Hull:', state.ships[targetFleet.shipIds[0]]?.hullPoints);

let tickCount = 0;
while (targetFleet.shipIds.length > 0 && tickCount < 100) {
    tickFleets(state, 86400, rng);
    tickCount++;

    if (tickCount > 40 && tickCount < 50) {
        const dist = Math.hypot(
            pirateFleet.position.x - targetFleet.position.x,
            pirateFleet.position.y - targetFleet.position.y
        );
        console.log(`Tick ${tickCount}, Dist: ${dist.toFixed(4)}, Tgt Hull: ${state.ships[targetFleet.shipIds[0]]?.hullPoints}`);
    }
}
console.log(`Finished after ${tickCount} ticks`);
