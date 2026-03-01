import { PopulationSegment } from './species';

export type ColonyType = 'Core' | 'Mining' | 'Research' | 'Military' | 'Agricultural' | 'Orbital';
export type ColonyPolicy = 'Normal' | 'Encourage Growth' | 'Population Control' | 'Forced Labor';
export type MigrationMode = 'Source' | 'Target' | 'Stable';

export interface LaborAllocation {
    industry: number;
    mining: number;
    research: number;
    construction: number;
    agriculture: number;
    commerce: number;
}

export interface Colony {
    id: string;
    empireId: string;
    planetId: string;
    name: string;
    population: number;
    populationSegments: PopulationSegment[];
    maxPopulation: number;
    populationGrowthRate: number;
    happiness: number;
    infrastructure: number;
    colonyType: ColonyType;
    policy: ColonyPolicy;
    laborAllocation: LaborAllocation;
    governorId?: string;
    productionQueue: ProductionItem[];
    factories: number;
    mines: number;
    civilianFactories: number;
    civilianMines: number;
    electronicsPlants?: number;
    civilianElectronicsPlants?: number;
    machineryPlants?: number;
    civilianMachineryPlants?: number;
    researchLabs: number;
    spaceport: number;
    groundDefenses: number;
    shipyards: Shipyard[];
    aethericDistillery?: number;
    aethericHarvesters?: number;
    constructionOffices?: number;
    corporateOffices?: number;
    stores?: number;
    terraformProgress: number;
    farms: number;
    buildingOwners?: Record<string, Record<string, number>>; // e.g. { 'Factory': { 'empire_player': 2, 'corp_123': 3 } }
    educationIndex?: number;
    educationBudget?: number;
    resourcePrices?: Record<string, number>;
    migrationMode: MigrationMode;
    migrantsWaiting?: number;
    minerals: Record<string, number>;
    demand: Record<string, number>;
    privateWealth: number;
    privateWealthIncome?: number;
    publicWages?: number;
    privateWages?: number;
    staffingLevel?: number;
    laborEfficiency?: number;
    lastMineralRates?: Record<string, number>;
    incentives?: { taxReduction: number, preferredSector: 'Transport' | 'Extraction' | 'Manufacturing' | 'Agricultural' | 'Commercial' | null };
    investmentPool?: number;
    history: ColonySnapshot[];
}

export interface ColonySnapshot {
    turn: number;
    date: Date;
    population: number;
    minerals: Record<string, number>;
    privateWealth: number;
    civilianFactories: number;
    civilianMines: number;
    migrationMode: MigrationMode;
    averageWage?: number;
    educationIndex?: number;
    consumerGoodsPrice?: number;
}

export type ProductionItemType =
    | 'Ship' | 'Factory' | 'Mine' | 'ResearchLab' | 'Shipyard'
    | 'Terraformer' | 'GroundDefense' | 'Spaceport' | 'Infrastructure' | 'ConstructionOffice'
    | 'AethericDistillery' | 'ShipyardExpansion_Slipway' | 'ShipyardExpansion_Tonnage'
    | 'AethericHarvester' | 'CorporateOffice' | 'Store'
    | 'Farm' | 'CivilianFactory' | 'CivilianMine'
    | 'ElectronicsPlant' | 'CivilianElectronicsPlant' | 'MachineryPlant' | 'CivilianMachineryPlant';

export interface ProductionItem {
    id: string;
    type: ProductionItemType;
    name: string;
    designId?: string;
    quantity: number;
    progress: number;
    costPerUnit: Record<string, number>;
    bpCostPerUnit: number;
    sourceCompanyId?: string; // If ordered by a corporation
    targetId?: string; // e.g. a specific shipyard ID for expansions
}

export interface Shipyard {
    id: string;
    name: string;
    slipways: number;
    maxTonnage: number;
    activeBuilds: ProductionItem[];
}
