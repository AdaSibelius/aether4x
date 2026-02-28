import { PopulationSegment } from './species';

export type ColonyType = 'Core' | 'Mining' | 'Research' | 'Military' | 'Agricultural';
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
    researchLabs: number;
    spaceport: number;
    groundDefenses: number;
    shipyards: Shipyard[];
    constructionOffices: number;
    farms: number;
    commercialCenters: number;
    terraformProgress: number;
    aethericDistillery: number;
    logisticsHubs: number;
    aethericSiphons: number;
    deepCoreExtractors: number;
    reclamationPlants: number;
    migrationMode: MigrationMode;
    migrantsWaiting?: number;
    minerals: Record<string, number>;
    demand: Record<string, number>;
    privateWealth: number;
    privateWealthIncome?: number;
    staffingLevel?: number;
    laborEfficiency?: number;
    lastMineralRates?: Record<string, number>;
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
    logisticsHubs: number;
    migrationMode: MigrationMode;
}

export type ProductionItemType =
    | 'Ship' | 'Factory' | 'Mine' | 'ResearchLab' | 'Shipyard'
    | 'Terraformer' | 'GroundDefense' | 'Spaceport' | 'Infrastructure' | 'ConstructionOffice'
    | 'AethericDistillery' | 'ShipyardExpansion_Slipway' | 'ShipyardExpansion_Tonnage'
    | 'AethericSiphon' | 'DeepCoreExtractor' | 'ReclamationPlant'
    | 'Farm' | 'CommercialCenter' | 'LogisticsHub';

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
