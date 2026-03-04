import { Vec2 } from './base';

export type HullClass = 'Fighter' | 'Corvette' | 'Destroyer' | 'Cruiser' | 'Battlecruiser' | 'Battleship' | 'Dreadnought' | 'Carrier' | 'ColonyShip' | 'Freighter' | 'Survey';

export interface ShipComponent {
    id: string;
    name: string;
    type: 'Engine' | 'Weapon' | 'Armor' | 'Shield' | 'Sensor' | 'FuelTank' | 'Cargo' | 'ColonizationModule' | 'SurveyModule' | 'Reactor';
    size: number;
    powerDraw: number;
    stats: Record<string, number>;
    requiredTech?: string;
}

export interface ShipDesign {
    id: string;
    name: string;
    hullClass: HullClass;
    role?: string;
    components: ShipComponent[];
    maxHullPoints: number;
    speed: number;
    fuelCapacity: number;
    sensorRange: number;
    weaponSystems: ShipComponent[];
    powerSupply: number;
    powerDraw: number;
    mineralCost: Record<string, number>;
    bpCost: number;
}

export interface CargoItem {
    res: string; // 'Iron', 'Copper', 'Civilians', etc.
    amount: number;
    originId: string;
    targetId: string;
    ownerId?: string; // Company ID
}

export interface Ship {
    id: string;
    name: string;
    designId: string;
    empireId: string;
    hullPoints: number;
    maxHullPoints: number;
    /** Current shield points, recharged over time. Max is from ShipDesign. */
    shieldPoints: number;
    fuel: number;
    experience: number;
    cargo: Record<string, number>; // Summary amounts for quick access
    inventory: CargoItem[]; // Detailed tracking
    sourceCompanyId?: string;
    /** Cooldown per weapon, keyed by component id. Counts down to 0 before weapon can fire again. */
    weaponCooldowns?: Record<string, number>;
}

export interface Fleet {
    id: string;
    name: string;
    empireId: string;
    shipIds: string[];
    admiralId?: string;
    currentStarId: string;
    position: Vec2;
    orbitingPlanetId?: string;
    destination?: {
        x: number;
        y: number;
        targetStarId?: string;
        targetPlanetId?: string;
        etaSeconds: number;
    };
    orders: ShipOrder[];
    isCivilian?: boolean;
    civilianType?: 'freighter' | 'transport';
    cargoLabel?: string;
    ownerCompanyId?: string;
    /** IDs of empires that currently have this fleet on their sensors. Updated each tick by detection.ts. */
    detectedByEmpireIds?: string[];
    /** Cached Aetheric Flux signature. Updated each tick. Higher = easier to detect. */
    signature?: number;
    /** The fleet this fleet is currently engaging. Set by Attack order. */
    combatTargetFleetId?: string;
}

export type ShipOrderType = 'MoveTo' | 'Jump' | 'Survey' | 'Attack' | 'Mine' | 'Patrol' | 'Transport' | 'Migrate';

/** Combat engagement preferences. */
export type EngagementStance = 'Aggressive' | 'Defensive' | 'Standoff';
export interface ShipOrder {
    id: string;
    type: ShipOrderType;
    targetStarId?: string;
    targetPlanetId?: string;
    targetFleetId?: string;
    targetPosition?: Vec2;
    cargoAction?: 'Load' | 'Unload';
    resourceName?: string;
    amount?: number;
    originId?: string;
    targetId?: string;
    /** For Attack orders: preferred range to maintain (AU). Defaults to max weapon range. */
    engagementRange?: number;
    /** For Attack orders: determines how aggressively the fleet pursues. */
    stance?: EngagementStance;
}
