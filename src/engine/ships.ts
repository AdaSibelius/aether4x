import type { ShipComponent, ShipDesign, HullClass } from '../types';

// ─── Hull Classes ────────────────────────────────────────────────────────────

export const HULL_SPECS: Record<HullClass, { maxSize: number; buildCostBase: number; description: string }> = {
    Fighter: { maxSize: 250, buildCostBase: 80, description: 'Small, fast interceptors.' },
    Corvette: { maxSize: 500, buildCostBase: 200, description: 'Light patrol and escort vessels.' },
    Destroyer: { maxSize: 1000, buildCostBase: 500, description: 'Core fleet combat ship.' },
    Cruiser: { maxSize: 2500, buildCostBase: 1500, description: 'Heavy multi-role warship.' },
    Battlecruiser: { maxSize: 5000, buildCostBase: 4000, description: 'Fast heavy combat platform.' },
    Battleship: { maxSize: 8000, buildCostBase: 8000, description: 'Heavy line-of-battle ship.' },
    Dreadnought: { maxSize: 15000, buildCostBase: 20000, description: 'Flagship capital ship.' },
    Carrier: { maxSize: 10000, buildCostBase: 12000, description: 'Fighter carrier vessel.' },
    ColonyShip: { maxSize: 3000, buildCostBase: 2000, description: 'Colonization vessel.' },
    Freighter: { maxSize: 4000, buildCostBase: 1000, description: 'Civilian cargo transport.' },
    Survey: { maxSize: 800, buildCostBase: 400, description: 'Scientific survey ship.' },
};

// ─── Component Library ────────────────────────────────────────────────────────

export const COMPONENT_LIBRARY: ShipComponent[] = [
    // Aetheric Hearths (Reactors) - Standardized: size is bulk, output is power
    { id: 'reactor_coal_boiler', name: 'Bessemer Steam-Jacketed Boiler', type: 'Reactor', size: 150, powerDraw: 0, stats: { powerOutput: 100 } },
    { id: 'reactor_dynamo', name: 'Inductive Aetheric Dynamo', type: 'Reactor', size: 100, powerDraw: 0, stats: { powerOutput: 300 }, requiredTech: 'aetheric_dynamo' },
    { id: 'reactor_fission', name: 'Mechanical-Governor Fission Hearth', type: 'Reactor', size: 250, powerDraw: 0, stats: { powerOutput: 800 }, requiredTech: 'clockwork_fission' },
    { id: 'reactor_resonance', name: 'Ambergris Resonator Core', type: 'Reactor', size: 200, powerDraw: 0, stats: { powerOutput: 2500 }, requiredTech: 'resonance_mechanics' },

    // Engines
    { id: 'engine_furnace_sm', name: 'Aetheric Furnace Engine (Sm)', type: 'Engine', size: 100, powerDraw: 50, stats: { thrust: 120, fuelPerTick: 2 } },
    { id: 'engine_furnace_md', name: 'Aetheric Furnace Engine (Md)', type: 'Engine', size: 200, powerDraw: 100, stats: { thrust: 280, fuelPerTick: 4 } },
    { id: 'engine_atomic_piston', name: 'Piston-Driven Atomic Furnace', type: 'Engine', size: 300, powerDraw: 400, stats: { thrust: 1000, fuelPerTick: 8 }, requiredTech: 'volatility_management' },
    { id: 'engine_antimatter', name: 'Catalyzed Ambergris Detonation Drive', type: 'Engine', size: 400, powerDraw: 1200, stats: { thrust: 4500, fuelPerTick: 20 }, requiredTech: 'antimatter_forge' },
    { id: 'engine_ambergris_sm', name: 'Ambergris Resonance Drive (Sm)', type: 'Engine', size: 120, powerDraw: 80, stats: { thrust: 300, fuelPerTick: 1.5 }, requiredTech: 'ambergris_drives' },
    { id: 'engine_ambergris_md', name: 'Ambergris Resonance Drive (Md)', type: 'Engine', size: 250, powerDraw: 160, stats: { thrust: 700, fuelPerTick: 3 }, requiredTech: 'ambergris_drives' },

    // Fuel Tanks
    { id: 'tank_phlogiston_sm', name: 'Phlogiston Tank (Sm)', type: 'FuelTank', size: 80, powerDraw: 0, stats: { capacity: 500 } },
    { id: 'tank_phlogiston_md', name: 'Phlogiston Tank (Md)', type: 'FuelTank', size: 200, powerDraw: 0, stats: { capacity: 2000 } },
    { id: 'tank_phlogiston_lg', name: 'Phlogiston Tank (Lg)', type: 'FuelTank', size: 400, powerDraw: 0, stats: { capacity: 6000 } },

    // Weapons
    { id: 'emitter_aetheric_sm', name: 'Aetheric Discharge Emitter (Class 1)', type: 'Weapon', size: 80, powerDraw: 80, stats: { damage: 8, range: 5, rof: 2 }, requiredTech: 'aetheric_discharge' },
    { id: 'emitter_aetheric_md', name: 'Aetheric Discharge Emitter (Class 3)', type: 'Weapon', size: 180, powerDraw: 180, stats: { damage: 20, range: 8, rof: 1.5 }, requiredTech: 'aetheric_discharge' },
    { id: 'battery_magnetic_sm', name: 'Magnetic Accelerator Battery I', type: 'Weapon', size: 100, powerDraw: 60, stats: { damage: 12, range: 10, rof: 1 }, requiredTech: 'analytical_ballistics' },
    { id: 'battery_magnetic_md', name: 'Magnetic Accelerator Battery II', type: 'Weapon', size: 220, powerDraw: 130, stats: { damage: 30, range: 15, rof: 0.8 }, requiredTech: 'analytical_ballistics' },
    { id: 'tube_clockwork_sm', name: 'Clockwork Torpedo Tube (4-cell)', type: 'Weapon', size: 100, powerDraw: 20, stats: { damage: 40, range: 30, rof: 0.3 }, requiredTech: 'guided_munitions' },
    { id: 'tube_clockwork_md', name: 'Clockwork Torpedo Tube (12-cell)', type: 'Weapon', size: 240, powerDraw: 40, stats: { damage: 120, range: 35, rof: 0.25 }, requiredTech: 'guided_munitions' },
    { id: 'cannon_rotary_pd', name: 'Rotary Defense Cannon', type: 'Weapon', size: 60, powerDraw: 40, stats: { damage: 5, range: 1, rof: 10, pdRating: 80 }, requiredTech: 'point_defense' },

    // Armor
    { id: 'plating_bessemer', name: 'Bessemer Steel Plating', type: 'Armor', size: 100, powerDraw: 0, stats: { hullBonus: 80, armorRating: 10 } },
    { id: 'hull_ironclad', name: 'Treated Ironclad Hull', type: 'Armor', size: 200, powerDraw: 0, stats: { hullBonus: 200, armorRating: 25 } },
    { id: 'carapace_titanium', name: 'Titanium-Laced Carapace', type: 'Armor', size: 250, powerDraw: 0, stats: { hullBonus: 350, armorRating: 45 } },

    // Shields
    { id: 'grid_magnetic', name: 'Magnetic Deflection Grid', type: 'Shield', size: 150, powerDraw: 120, stats: { shieldPoints: 100, recharge: 5 }, requiredTech: 'aetheric_shields' },
    { id: 'shield_tesla_coil', name: 'Tesla Induction Screen', type: 'Shield', size: 200, powerDraw: 400, stats: { shieldPoints: 400, recharge: 15 }, requiredTech: 'aetheric_shields' },
    { id: 'shield_harmonic_nullifier', name: 'Aetheric Harmonic Nullifier', type: 'Shield', size: 300, powerDraw: 1200, stats: { shieldPoints: 1500, recharge: 50 }, requiredTech: 'resonance_mechanics' },

    // Sensors
    { id: 'scanner_optic_sm', name: 'Electro-Optic Array', type: 'Sensor', size: 50, powerDraw: 20, stats: { range: 3, resolution: 40 } },
    { id: 'scanner_optic_md', name: 'Aetheric Resonance Scanner', type: 'Sensor', size: 100, powerDraw: 50, stats: { range: 8, resolution: 70 } },
    { id: 'array_telegraph_lg', name: 'Deep-Space Telegraph Array', type: 'Sensor', size: 200, powerDraw: 100, stats: { range: 20, resolution: 90 } },

    // Cargo / Special
    { id: 'compartment_hold_sm', name: 'Hold Compartment (Sm)', type: 'Cargo', size: 200, powerDraw: 0, stats: { cargoCapacity: 5000 } },
    { id: 'compartment_hold_lg', name: 'Hold Compartment (Lg)', type: 'Cargo', size: 500, powerDraw: 0, stats: { cargoCapacity: 20000 } },
    { id: 'module_cryo', name: 'Cryo-Suspension Module', type: 'ColonizationModule', size: 800, powerDraw: 50, stats: { colonistCapacity: 250000 } },
    { id: 'bore_geological', name: 'Geological Bore', type: 'SurveyModule', size: 150, powerDraw: 40, stats: { surveySpeed: 1 } },
    { id: 'scoop_aether', name: 'Aetheric Scoop', type: 'Cargo', size: 300, powerDraw: 100, stats: { harvestRate: 100 }, requiredTech: 'aetheric_distillation' },
];

export const COMPONENTS_BY_ID: Record<string, ShipComponent> = Object.fromEntries(COMPONENT_LIBRARY.map(c => [c.id, c]));

// ─── Starting Designs ─────────────────────────────────────────────────────────

export function createDesign(
    id: string, name: string, hullClass: HullClass, componentIds: string[]
): ShipDesign {
    const components = componentIds.map(cid => COMPONENTS_BY_ID[cid]).filter(Boolean);
    const maxHP = HULL_SPECS[hullClass].maxSize;
    const totalThrust = components.filter(c => c.type === 'Engine').reduce((a, c) => a + (c.stats.thrust || 0), 0);
    const sensorComp = components.find(c => c.type === 'Sensor');
    const weapons = components.filter(c => c.type === 'Weapon');
    const fuelCapacity = components.filter(c => c.type === 'FuelTank').reduce((a, c) => a + (c.stats.capacity ?? 0), 0);

    const powerSupply = components.filter(c => c.type === 'Reactor').reduce((a, c) => a + (c.stats.powerOutput || 0), 0);
    const powerDraw = components.reduce((a, c) => a + c.powerDraw, 0);

    const baseBP = HULL_SPECS[hullClass].buildCostBase;

    // Standardized costs: Iron for hull, Titanium for advanced components
    const mineralCost: Record<string, number> = {
        Iron: Math.floor(baseBP * 0.8),
        Titanium: Math.floor(baseBP * 0.2)
    };

    if (hullClass === 'Survey') mineralCost.Platinum = 50;
    if (hullClass === 'Freighter') mineralCost.Iron += 200;

    return {
        id,
        name,
        hullClass,
        components,
        maxHullPoints: maxHP,
        speed: totalThrust / 100, // Normalized speed
        fuelCapacity,
        sensorRange: sensorComp ? (sensorComp.stats.range ?? 0) : 2,
        weaponSystems: weapons,
        powerSupply,
        powerDraw,
        mineralCost,
        bpCost: baseBP,
    };
}

export function createStartingDesigns(): ShipDesign[] {
    return [
        createDesign('design_survey', 'Pioneer-class Survey Vessel', 'Survey',
            ['reactor_coal_boiler', 'engine_furnace_sm', 'tank_phlogiston_md', 'scanner_optic_md', 'bore_geological']),
        createDesign('design_corvette', 'Falcon-class Corvette', 'Corvette',
            ['reactor_coal_boiler', 'engine_furnace_sm', 'tank_phlogiston_sm', 'scanner_optic_sm', 'emitter_aetheric_sm', 'plating_bessemer']),
        createDesign('design_destroyer', 'Vanguard-class Destroyer', 'Destroyer',
            ['reactor_dynamo', 'engine_furnace_md', 'engine_furnace_sm', 'tank_phlogiston_md', 'scanner_optic_md', 'emitter_aetheric_md', 'battery_magnetic_sm', 'plating_bessemer', 'plating_bessemer']),
        createDesign('design_colony', 'Ark-class Colony Ship', 'ColonyShip',
            ['reactor_dynamo', 'engine_furnace_md', 'tank_phlogiston_lg', 'scanner_optic_sm', 'module_cryo', 'compartment_hold_sm']),
        createDesign('design_freighter', 'Mammoth-class Freighter', 'Freighter',
            ['reactor_coal_boiler', 'engine_furnace_md', 'tank_phlogiston_lg', 'scanner_optic_sm', 'compartment_hold_lg']),
        createDesign('design_harvester', 'Siphon-class Aether Harvester', 'Freighter',
            ['reactor_coal_boiler', 'engine_furnace_sm', 'tank_phlogiston_md', 'scanner_optic_sm', 'scoop_aether', 'compartment_hold_sm']),
    ];
}
