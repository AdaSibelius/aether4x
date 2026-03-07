import { RNG } from './rng';

let fallbackCounter = 0;

function createFallbackEntropy(): string {
    const cryptoApi = globalThis.crypto;
    if (cryptoApi?.getRandomValues) {
        const value = new Uint32Array(1);
        cryptoApi.getRandomValues(value);
        return value[0].toString(36);
    }
    fallbackCounter += 1;
    return fallbackCounter.toString(36);
}

/**
 * Standard ID generation for the Aether 4x codebase.
 * If an RNG is provided, the generation is deterministic relative to that RNG.
 */
export function generateId(prefix: string, rng?: RNG): string {
    if (rng) {
        const randomPart = Math.floor(rng.next() * 10000000).toString(36);
        return `${prefix}_${randomPart}`;
    }
    return `${prefix}_${createFallbackEntropy()}`;
}
