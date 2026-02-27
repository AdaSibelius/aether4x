import type { GameEvent, EventType } from '@/types';
import { generateId } from '@/utils/id';

/**
 * Standard factory for creating game events.
 * @intent Centralized event creation to avoid circular dependencies.
 */
export function makeEvent(turn: number, date: Date | string, type: EventType, message: string, opts?: { starId?: string; planetId?: string; important?: boolean }): GameEvent {
    const dateStr = typeof date === 'string' ? date : date.toISOString().split('T')[0];
    return {
        id: generateId('evt'),
        turn,
        date: dateStr,
        type,
        message,
        important: opts?.important ?? false,
        starId: opts?.starId,
        planetId: opts?.planetId,
    };
}
