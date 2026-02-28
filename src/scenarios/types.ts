import type { GameState } from '@/types';

export interface DriftDetail {
    path: string;
    expected: unknown; // more specific than any
    actual: unknown;
    message?: string;
}

export interface DriftReport {
    hasDrift: boolean;
    firstDifference?: DriftDetail;
    totalDifferences: number;
    allDrifts?: DriftDetail[];
}

export interface ScenarioResult {
    success: boolean;
    message: string;
    metrics: Record<string, number | string | boolean>;
    driftReport?: DriftReport;
}

export interface Scenario {
    name: string;
    description: string;
    setup: (seed: number) => GameState;
    run: (state: GameState, ticks: number) => Promise<ScenarioResult>;
}
