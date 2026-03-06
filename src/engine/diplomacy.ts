/**
 * @module diplomacy
 * @description
 * Evaluates diplomatic tension and automates basic state-level interactions between empires.
 * 
 * **Architecture & State Mutations:**
 * - `evaluateDiplomacy` reads `GameState.empires[id].relations` and mutates them (e.g., tension decay).
 * - `declareWar` forces a state change to `War` and dispatches `GameEvent` notifications.
 */
import { GameState, Empire, GameEvent } from '../types';
import { RNG } from '../utils/rng';

/**
 * Autonomous evaluation of diplomatic treaties and tension.
 */
export function evaluateDiplomacy(state: GameState, empire: Empire, rng: RNG, events: GameEvent[]) {
    if (empire.isPlayer) return;

    if (!empire.relations) empire.relations = {};

    for (const other of Object.values(state.empires)) {
        if (other.id === empire.id) continue;

        if (!empire.relations[other.id]) {
            empire.relations[other.id] = { treaty: 'None', tension: 0 };
        }
        if (!other.relations) other.relations = {};
        if (!other.relations[empire.id]) {
            other.relations[empire.id] = { treaty: 'None', tension: 0 };
        }

        const relation = empire.relations[other.id];

        // Natural tension decay
        if (relation.tension > 0) relation.tension -= 0.1;

        // Tense borders logic (simplified): if other empire has claimed adjacent systems
        // we can increment tension if posture is Aggressive.

        if (empire.aiState?.posture === 'Aggression' && relation.tension > 50 && relation.treaty !== 'War' && relation.treaty !== 'NonAggression') {
            declareWar(empire.id, other.id, state, events);
        }
    }
}

/**
 * @pending AI treaty placeholder
 */
export function declareWar(attackerId: string, defenderId: string, state: GameState, events: GameEvent[]) {
    const attacker = state.empires[attackerId];
    const defender = state.empires[defenderId];
    if (!attacker || !defender) return;

    if (!attacker.relations) attacker.relations = {};
    if (!defender.relations) defender.relations = {};

    attacker.relations[defenderId] = { treaty: 'War', tension: 100 };
    defender.relations[attackerId] = { treaty: 'War', tension: 100 };

    events.push({
        id: `evt_war_${state.turn}`,
        turn: state.turn,
        date: typeof state.date === 'string' ? state.date : state.date.toISOString().split('T')[0],
        type: 'Diplomacy',
        message: `${attacker.name} has declared war on ${defender.name}!`,
        empireId: attackerId,
        important: true
    });
}
