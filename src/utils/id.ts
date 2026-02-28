import { RNG } from './rng';

/**
 * Standard ID generation for the Aether 4x codebase.
 * If an RNG is provided, the generation is deterministic relative to that RNG.
 */
export function generateId(prefix: string, rng?: RNG): string {
    if (rng) {
        const randomPart = Math.floor(rng.next() * 10000000).toString(36);
        return `${prefix}_${randomPart}`;
    }
    const randomPart = Math.random().toString(36).substring(2, 9);
    const timePart = Date.now().toString(36);
    return `${prefix}_${timePart}_${randomPart}`;
}
