export type TechCategory =
    | 'Computation'
    | 'Engineering'
    | 'Power'
    | 'Military'
    | 'Biology'
    | 'Logistics'
    | 'Geology'
    | 'Astrogation';

export interface Technology {
    id: string;
    name: string;
    description: string;
    category: TechCategory;
    tier: number;
    cost: number;
    prerequisites: string[];
    effects: TechEffect[];
}

export interface TechEffect {
    type: string;
    value: number;
}

export interface ResearchProject {
    id: string;
    techId: string;
    scientistId: string;
    labs: number;
    investedPoints: number;
}

export interface EmpireResearch {
    activeProjects: ResearchProject[];
    completedTechs: string[];
}
