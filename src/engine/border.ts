import { GameState, GameEvent } from '../types';
import { RNG } from '../utils/rng';

const TICKS_TO_CLAIM = 30 * 86400; // 30 days of continuous presence

/**
 * Evaluates control and sovereignty over star systems.
 */
export function tickBorders(state: GameState, dt: number, rng: RNG): GameEvent[] {
    void rng;
    const events: GameEvent[] = [];

    for (const star of Object.values(state.galaxy.stars)) {
        const presence = new Set<string>();

        for (const p of star.planets) {
            const colonies = Object.values(state.colonies).filter(c => c.planetId === p.id);
            for (const c of colonies) presence.add(c.empireId);
        }

        for (const e of Object.values(state.empires)) {
            if (e.fleets.some(f => f.currentStarId === star.id && !f.isCivilian)) {
                presence.add(e.id);
            }
        }

        if (!star.claimProgress) star.claimProgress = [];

        for (const empireId of presence) {
            if (star.claimedByEmpireId === empireId) continue;

            let prog = star.claimProgress.find(p => p.empireId === empireId);
            if (!prog) {
                prog = { empireId, ticks: 0 };
                star.claimProgress.push(prog);
            }
            prog.ticks += dt;

            if (prog.ticks >= TICKS_TO_CLAIM && !star.claimedByEmpireId) {
                star.claimedByEmpireId = empireId;
                events.push({
                    id: `evt_claim_${star.id}_${state.turn}`,
                    turn: state.turn,
                    date: typeof state.date === 'string' ? state.date : state.date.toISOString().split('T')[0],
                    type: 'Diplomacy',
                    message: `${state.empires[empireId].name} has formally claimed the ${star.name} system.`,
                    empireId,
                    important: true
                });
            }
        }
    }

    return events;
}

export function getSystemController(starId: string, state: GameState): string | undefined {
    return state.galaxy.stars[starId]?.claimedByEmpireId;
}
