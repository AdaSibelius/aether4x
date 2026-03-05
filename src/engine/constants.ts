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
    POP_CONSUMPTION_RATE: 0.1, // Consumer Goods consumed per 1M population per day
    FOOD_CONSUMPTION_RATE: 0.5, // Food units consumed per 1M population per day [Rebalanced: was 0.2, raised to force inter-colony food trade]
    POP_DIE_OFF_RATE: 0.1,     // Die-off rate per year per 1x over-capacity
    FAMINE_DIE_OFF_RATE: 0.005, // Daily population loss percentage during starvation [NEW]
    INFRA_POP_SUPPORT: 2500,   // Population (M) supported per 1.0 Infrastructure level [NEW]
    BASE_HABITABLE_POP: 100,  // Base population (M) supported by habitability without infra [NEW]
    INFRA_REPAIR_KIT: 0.1,     // Baseline infrastructure repair for all colonies [NEW]
    FARM_YIELD_BASE: 2.0,      // Food units produced per farm per day [Rebalanced: was 5.0, lowered to create food scarcity]
    FOOD_PRICE_SURGE_THRESHOLD: 30, // Days supply at current consumption before price skyrockets
    FOOD_PRICE_MAX: 3.0,       // Max multiplier for food price during famine

    // --- Combat & Blockades ---
    BOMBARDMENT_COLLATERAL_RATE: 0.1, // 10% of population lost per 1.0 day of unshielded bombardment
    BASE_GROUND_DEFENSES_PER_MILLION_POP: 5, // Default defense rating 

    // --- Wealth & Taxes ---
    CONSUMER_GOOD_VALUE: 8,    // Base Wealth generated per 1 unit of Consumer Goods consumed
    TAX_INCOME_BASE: 0.1,      // Wealth tax per 1M population per day (scaled by happiness)
    TRADE_TAX_RATE: 0.2,       // Percentage of trade value taken as state tax

    // --- Socioeconomic Depth ---
    OFFICE_CAPACITY_PER_BUILDING: 5,
    COLONY_BASELINE_SLOTS: 3,
    BUILDING_WAGES: {
        ResearchLab: 15.0,
        ElectronicsPlant: 12.0,
        CivilianElectronicsPlant: 12.0,
        MachineryPlant: 10.0,
        CivilianMachineryPlant: 10.0,
        Factory: 8.0,
        CivilianFactory: 8.0,
        Shipyard: 8.0,
        ConstructionOffice: 8.0,
        Spaceport: 6.0,
        Mine: 5.0,
        CivilianMine: 5.0,
        Store: 5.0,
        AethericDistillery: 5.0,
        AethericHarvester: 5.0,
        CorporateOffice: 5.0,
        GroundDefense: 5.0,
        Farm: 3.0,
        Default: 1.0
    },
    INDUSTRY_RECIPES: {
        ConsumerGoods: { inputs: { Iron: 1, Copper: 1 }, time: 1, outputMultiplier: 2 }, // [Rebalanced: 2x output vs before]
        Electronics: { inputs: { Copper: 2, Platinum: 1 }, time: 1, outputMultiplier: 1 },
        Machinery: { inputs: { Iron: 2, Tungsten: 1 }, time: 1, outputMultiplier: 1 },
    },
    // --- Asset Consumption (demand drivers for Electronics & Machinery) ---
    MACHINERY_PER_SHIPYARD_BP: 0.05,   // Machinery units consumed per BP of shipyard work per day
    ELECTRONICS_PER_RESEARCH_LAB: 0.5, // Electronics units consumed per research lab per day
    ELECTRONICS_LUXURY_THRESHOLD: 5000, // Private wealth per colony above which pops buy Electronics
    ELECTRONICS_LUXURY_CONSUMPTION: 0.02, // Electronics units consumed per 1M wealthy pops per day
    // --- Wealth Sink ---
    COST_OF_LIVING_RATE: 0.008, // Fraction of private wealth consumed as basic living expenses per day
    MAX_STAFFING_LEVEL: 1.2,    // Hard cap on staffing efficiency (prevents over-staffing feedback loops)
    JOB_REQUIREMENTS: {
        ResearchLab: 60,
        ElectronicsPlant: 60,
        CivilianElectronicsPlant: 60,
        MachineryPlant: 30,
        CivilianMachineryPlant: 30,
        Factory: 30,
        CivilianFactory: 30,
        Mine: 0,
        CivilianMine: 0,
        Farm: 8,
        Default: 0
    },
    EDUCATION_DECAY_RATE: 0.05, // Index loss per day [Rebalanced: was 0.1, lowered so education budget isn't prohibitively expensive]

    // --- Maintenance (Wealth/Day) ---
    MAINTENANCE: {
        FACTORY: 0.5,
        MINE: 0.3,
        RESEARCH_LAB: 1.0,
        GROUND_DEFENSE: 0.8,
        SHIPYARD: 5.0,
        SPACEPORT: 3.0,
        DISTILLERY: 0.5,
        OFFICE_BASE: 100.0, // Maintenance cost per corporate office
        SHIP_BASE: 10.0,    // Base maintenance per ship
        CORP_LICENSE_FEE: 500.0, // Base daily tax fee per corporation
        STORE: 1.0,         // Maintenance cost per store
        FARM: 0.5,          // Maintenance cost per farm per day [NEW: prevents Agricultural from compounding indefinitely]
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
        WORKER_REQUIREMENT_STORE: 10,          // Millions per store (commercial center)
        OFFICE_WORKERS_PER_CORP: 5,             // Millions per established company
        WORKER_REQUIREMENT_DISTILLERY: 15,    // Millions per Aetheric Distillery
        PUBLIC_SERVICE_FRACTION: 0.05,         // 5% baseline government/admin requirement (Optional - baseline overhead)
        CONSTRUCTION_BP_PER_OFFICE: 20,         // Construction BP generated per office per day
    },
    MINERAL_NAMES: ['Iron', 'Copper', 'Titanium', 'Uranium', 'Tungsten', 'Cobalt', 'Lithium', 'Platinum', 'Ambergris', 'Aether', 'Fuel', 'Food', 'ConsumerGoods', 'Electronics', 'Machinery'],
    RAW_MINERALS: ['Iron', 'Copper', 'Titanium', 'Uranium', 'Tungsten', 'Cobalt', 'Lithium', 'Platinum', 'Ambergris', 'Aether'],
    MANUFACTURED_GOODS: ['Fuel', 'Food', 'ConsumerGoods', 'Electronics', 'Machinery'],
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
        COMMERCIAL: 4.0,   // Per store per day [Rebalanced: was 8.0, halved to reduce Commercial dominance]
        MANUFACTURING: 6.0,   // Per civilian factory per day
        EXTRACTION: 5.0,   // Per civilian mine per day
        AGRICULTURAL: 10.0,  // Per farm per day [Rebalanced: was 3.0, raised to make farming viable]
        CONSTRUCTION: 10.0,  // Per construction office per day
        DISTILLERY: 12.0,    // Per aetheric distillery per day
        HARVESTER: 20.0,     // Per aetheric harvester per day
        OFFICE: 3.0,         // Per corporate office per day [Rebalanced: was 8.0, lowered to reduce Commercial dominance]
    },
};

