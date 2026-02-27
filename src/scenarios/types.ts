import type { GameState } from '@/types';

export interface ScenarioResult {
    success: boolean;
    message: string;
    metrics: Record<string, any>;
    driftReport?: any;
}

export interface Scenario {
    name: string;
    description: string;
    setup: (seed: number) => GameState;
    run: (state: GameState, ticks: number) => Promise<ScenarioResult>;
}
