export type Vec2 = { x: number; y: number };

export type GamePhase = 'MainMenu' | 'Playing' | 'Victory' | 'Defeat';

export type TickLength =
    | 5          // 5 seconds
    | 60         // 1 minute
    | 3_600      // 1 hour
    | 86_400     // 1 day
    | 432_000    // 5 days
    | 2_592_000; // 30 days

export type EventType =
    | 'ResearchComplete'
    | 'ColonyFounded'
    | 'ShipBuilt'
    | 'ContactMade'
    | 'CombatResult'
    | 'CombatEngagement'
    | 'ShipDestroyed'
    | 'MineralsFound'
    | 'JumpPointFound'
    | 'SystemExplored'
    | 'PopulationMilestone'
    | 'ProductionIdle'
    | 'CivilianExpansion'
    | 'CompanyFounded'
    | 'OfficerSpawned'
    | 'OfficerRetired'
    | 'TenderBid'
    | 'TenderResolved'
    | 'ProductionComplete';

export interface GameEvent {
    id: string;
    turn: number;
    date: string;
    type: EventType;
    message: string;
    starId?: string;
    planetId?: string;
    empireId?: string;
    fleetId?: string;
    targetFleetId?: string;
    important: boolean;
}

export type AtmosphereType = 'None' | 'Thin' | 'Breathable' | 'Dense' | 'Toxic' | 'Corrosive';

export interface AtmosphericGas {
    name: string;
    percentage: number; // 0.0 to 1.0
}
