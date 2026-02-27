import { Star, JumpPoint } from './celestial';
import { Empire, MiningTender } from './empire';
import { Ship } from './fleet';
import { Colony } from './colony';
import { Vec2, GamePhase, TickLength, GameEvent } from './base';

export interface Galaxy {
    stars: Record<string, Star>;
    jumpPoints: JumpPoint[];
    width: number;
    height: number;
    seed: number;
}

export interface GameStats {
    totalProduced: Record<string, number>;
    totalConsumed: Record<string, number>;
    totalConverted: Record<string, number>; // e.g., Aether to Fuel
}

export interface GameState {
    id: string;
    phase: GamePhase;
    turn: number;
    date: Date;
    seed: number;
    initialSeed: number;
    galaxy: Galaxy;
    empires: Record<string, Empire>;
    ships: Record<string, Ship>;
    colonies: Record<string, Colony>;
    tenders: MiningTender[];
    playerEmpireId: string;
    tickLength: TickLength;
    stats: GameStats;
}
