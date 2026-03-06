import type { GameEvent, EventType } from '../types';
import { generateId } from '../utils/id';
import { RNG } from '../utils/rng';

/**
 * Standard factory for creating game events.
 * @intent Centralized event creation to avoid circular dependencies.
 */
export function makeEvent(
    turn: number,
    date: Date | string,
    type: EventType,
    message: string,
    rng: RNG,
    opts?: {
        starId?: string;
        planetId?: string;
        colonyId?: string;
        empireId?: string;
        fleetId?: string;
        targetFleetId?: string;
        important?: boolean;
    }
): GameEvent {
    const dateStr = typeof date === 'string' ? date : date.toISOString().split('T')[0];
    return {
        id: generateId('evt', rng),
        turn,
        date: dateStr,
        type,
        message,
        important: opts?.important ?? false,
        starId: opts?.starId,
        planetId: opts?.planetId,
        colonyId: opts?.colonyId,
        empireId: opts?.empireId,
        fleetId: opts?.fleetId,
        targetFleetId: opts?.targetFleetId,
    };
}
