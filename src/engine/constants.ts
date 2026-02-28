/**
 * EPIC_BALANCING_CONSTANTS
 * Centralized game balance parameters for Aether 4x.
 * Adjusting these values will affect the global economy and production speed.
 */

export const BALANCING = {
    // --- Production & Construction ---
    BP_PER_FACTORY: 12,        // Basic BP generated per state factory per day (Rebalanced for no workerFactor)
    TP_PER_TERRAFORMER: 0.05,  // Percentage progress per terraformer per day
    INFRA_DECAY_RATE: 0.05,   // Infrastructure decay percentage per day
    INFRA_REPAIR_FACTOR: 0.2, // Scaling factor for construction workers repairing infra

    // --- Extraction & Economy ---
    MINING_RATE_BASE: 1.2,     // Tons extracted per mine per mineral accessibility per day (Rebalanced for no workerFactor)
    RESEARCH_RATE_BASE: 4.0,   // RP generated per lab per day (Rebalanced)
    COMMERCE_YIELD_BASE: 0.5,  // Trade Goods generated per 1M pops in commerce
    CIVILIAN_FACTORY_TG: 5,    // Trade Goods generated per civilian factory per day
    DISTILLERY_THROUGHPUT: 50, // Raw Aether units processed per distillery per day
    DISTILLATION_EFFICIENCY: 0.8, // 1 Aether processes into 0.8 Fuel
    AETHER_HARVEST_RATE_BASE: 5, // Base units per scoop per day

    // --- Consumption & Population ---
    POP_CONSUMPTION_RATE: 0.1, // Trade Goods consumed per 1M population per day
    FOOD_CONSUMPTION_RATE: 0.2, // Food units consumed per 1M population per day [NEW]
    POP_DIE_OFF_RATE: 0.1,     // Die-off rate per year per 1x over-capacity
    FAMINE_DIE_OFF_RATE: 0.005, // Daily population loss percentage during starvation [NEW]
    INFRA_POP_SUPPORT: 2500,   // Population (M) supported per 1.0 Infrastructure level [NEW]
    BASE_HABITABLE_POP: 100,  // Base population (M) supported by habitability without infra [NEW]
    INFRA_REPAIR_KIT: 0.1,     // Baseline infrastructure repair for all colonies [NEW]
    FARM_YIELD_BASE: 5.0,      // Food units produced per farm per day [NEW]

    // --- Wealth & Taxes ---
    TRADE_GOOD_VALUE: 8,       // Wealth generated per 1 unit of Trade Goods consumed
    TAX_INCOME_BASE: 0.1,      // Wealth tax per 1M population per day (scaled by happiness)
    TRADE_TAX_RATE: 0.2,       // Percentage of trade value taken as state tax

    // --- Maintenance (Wealth/Day) ---
    MAINTENANCE: {
        FACTORY: 0.5,
        MINE: 0.3,
        RESEARCH_LAB: 1.0,
        GROUND_DEFENSE: 0.8,
        SHIPYARD: 5.0,
        SPACEPORT: 3.0,
        DISTILLERY: 0.5,
        LOGISTICS_HUB: 1.0,
        OFFICE_BASE: 100.0, // Maintenance cost per corporate office
        SHIP_BASE: 10.0,    // Base maintenance per ship
        CORP_LICENSE_FEE: 500.0, // Base daily tax fee per corporation
    },

    // --- Officer Logic ---
    OFFICER_SALARY_BASE: 100,      // Salary per level per day
    OFFICER_CHANCE_PER_TICK: 0.15, // Chance for a new officer to spawn
    OFFICER_XP_PER_LEVEL: 100,     // XP required to level up
    OFFICER_BONUS_SCALE: 0.1,      // 10% bonus increase per level

    // --- Private Sector ---
    CORP_FOUND_WEALTH_THRESHOLD: 10000, // Wealth required for new company to form
    CIVILIAN_EXPANSION_THRESHOLD: 2000,  // Wealth required for auto-building facilities
    CIVILIAN_EXPANSION_COST: 2000,       // Cost in private wealth for auto-build

    // --- Employment & Labor ---
    EMPLOYMENT: {
        WORKER_REQUIREMENT_FACTORY: 20,         // Millions of workers per public factory
        WORKER_REQUIREMENT_MINE: 10,            // Millions per public mine
        WORKER_REQUIREMENT_RESEARCH_LAB: 10,    // Millions per lab
        WORKER_REQUIREMENT_SHIPYARD: 50,        // Millions per shipyard slip
        WORKER_REQUIREMENT_SPACEPORT: 5,        // Millions per spaceport
        WORKER_REQUIREMENT_TERRAFORMER: 15,     // Millions per terraformer
        WORKER_REQUIREMENT_GROUND_DEFENSE: 2,   // Millions per PDC
        WORKER_REQUIREMENT_CONSTRUCTION_OFFICE: 10, // Millions per construction office
        WORKER_REQUIREMENT_CIV_FACTORY: 10,     // Millions per private factory
        WORKER_REQUIREMENT_CIV_MINE: 5,         // Millions per private mine
        WORKER_REQUIREMENT_FARM: 10,           // Millions per farm
        WORKER_REQUIREMENT_COMMERCIAL_CENTER: 10, // Millions per commercial center
        WORKER_REQUIREMENT_LOGISTICS_HUB: 5,   // Millions per hub [NEW]
        WORKER_REQUIREMENT_SIPHON: 15,        // Millions per Aetheric Siphon [NEW]
        WORKER_REQUIREMENT_EXTRACTOR: 12,      // Millions per Deep Core Extractor [NEW]
        WORKER_REQUIREMENT_RECLAMATION: 10,    // Millions per Reclamation Plant [NEW]
        OFFICE_WORKERS_PER_CORP: 5,             // Millions per established company
        WORKER_REQUIREMENT_DISTILLERY: 15,    // Millions per Aetheric Distillery
        PUBLIC_SERVICE_FRACTION: 0.05,         // 5% baseline government/admin requirement (Optional - baseline overhead)
        CONSTRUCTION_BP_PER_OFFICE: 20,         // Construction BP generated per office per day
    },
    MINERAL_NAMES: ['Iron', 'Copper', 'Titanium', 'Uranium', 'Tungsten', 'Cobalt', 'Lithium', 'Platinum', 'Ambergris', 'Aether', 'Fuel', 'Food'],
    SHIPYARD_BP_ALLOCATION_FACTOR: 0.3, // 30% of industrial BP goes to shipyards by default
    SHIPYARD_BASE_MAX_TONNAGE: 5000,

    // --- Ledger Retention ---
    /** Maximum monetary ledger entries before pruning (keeps most recent). */
    MAX_MONETARY_LEDGER_ENTRIES: 500,
    /** Maximum cashflow ledger entries before pruning. */
    MAX_CASHFLOW_LEDGER_ENTRIES: 200,

    // --- Corporate Opportunity Pool (wealth/building/day) ---
    // Each pool type represents how much revenue a building generates for
    // all companies of that type on the colony COMBINED.
    // This replaces the inverse-divisor formulas and makes revenue tick-length
    // invariant for a fixed elapsed simulated time.
    CORP_POOL: {
        COMMERCIAL: 8.0,   // Per commercial center per day
        MANUFACTURING: 6.0,   // Per civilian factory per day
        EXTRACTION: 5.0,   // Per civilian mine per day
        LOGISTICS: 4.0,   // Per logistics hub per day
        AGRICULTURAL: 3.0,   // Per farm per day
    },
};

