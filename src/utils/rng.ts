/**
 * Seeded PCG-style RNG for deterministic game generation.
 */
export class RNG {
    private seed: number;

    constructor(seed: number) {
        this.seed = seed;
    }

    /**
     * returns 0 to 1
     */
    next(): number {
        this.seed = (this.seed * 1664525 + 1013904223) % 4294967296;
        return this.seed / 4294967296;
    }

    between(min: number, max: number): number {
        return min + this.next() * (max - min);
    }

    intBetween(min: number, max: number): number {
        return Math.floor(this.between(min, max + 1));
    }

    pick<T>(arr: T[]): T {
        return arr[Math.floor(this.next() * arr.length)];
    }

    chance(probability: number): boolean {
        return this.next() < probability;
    }
}
