export type OfficerRole = 'Admiral' | 'Captain' | 'Scientist' | 'Engineer' | 'Governor' | 'CEO';

export interface Officer {
    id: string;
    name: string;
    role: OfficerRole;
    level: number;
    portraitSeed: number;
    traits: string[];
    experience: number;
    bonuses: Record<string, number>;
    specialization?: string;
    assignedTo?: string;
}
