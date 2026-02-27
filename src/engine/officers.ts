import type { Officer, OfficerRole, CompanyType } from '@/types';
import { RNG } from '@/utils/rng';

// ─── Name Tables ─────────────────────────────────────────────────────────────

const FIRST_NAMES = [
    'Alistair', 'Beatrice', 'Cornelius', 'Dorothea', 'Edmund', 'Felicity',
    'Gideon', 'Helena', 'Ignatius', 'Josephine', 'Knox', 'Lavinia',
    'Montague', 'Nadia', 'Oswald', 'Prudence', 'Quentin', 'Rosalind',
    'Sebastian', 'Thomasina', 'Ulric', 'Violetta', 'Whitfield', 'Xanthe',
    'York', 'Zenobia', 'Ambrose', 'Cecilia', 'Desmond', 'Evangeline',
    'Frederick', 'Griselda', 'Horatio', 'Isadora', 'Jasper', 'Katarina',
    'Leopold', 'Meredith', 'Nigel', 'Octavia', 'Percival', 'Rowena',
    'Bartholomew', 'Cordelia', 'Erasmus', 'Millicent', 'Reginald', 'Winifred',
];

const LAST_NAMES = [
    'Ashworth', 'Blackwood', 'Cromwell', 'Davenport', 'Eversham',
    'Fairchild', 'Grimsby', 'Hartwell', 'Ironside', 'Jacobsen',
    'Kingsley', 'Lockhart', 'Mortimer', 'Northcott', 'Ogilvie',
    'Pemberton', 'Queensbury', 'Ravencroft', 'Stirling', 'Thackeray',
    'Underwood', 'Vandermeer', 'Waterford', 'Yarmouth', 'Aldridge',
    'Bramwell', 'Chandler', 'Dunmore', 'Ellsworth', 'Forsythe',
    'Grantham', 'Holloway', 'Ingram', 'Jarvis', 'Kensington',
    'Langford', 'Marchmont', 'Newfield', 'Oakley', 'Prescott',
];

// ─── Trait System ────────────────────────────────────────────────────────────

export interface TraitDefinition {
    id: string;
    name: string;
    description: string;
    bonuses: Record<string, number>;
    roleAffinity: OfficerRole[];  // roles this trait is most likely for
}

export const TRAITS: TraitDefinition[] = [
    {
        id: 'industrious',
        name: 'Industrious',
        description: '+15% factory output',
        bonuses: { factory_output: 0.15 },
        roleAffinity: ['Governor', 'Engineer'],
    },
    {
        id: 'prospector',
        name: 'Prospector',
        description: '+20% mining rate',
        bonuses: { mining_rate: 0.20 },
        roleAffinity: ['Governor', 'Engineer'],
    },
    {
        id: 'visionary',
        name: 'Visionary',
        description: '+15% research output',
        bonuses: { research_rate: 0.15 },
        roleAffinity: ['Scientist', 'Governor'],
    },
    {
        id: 'ironclad',
        name: 'Ironclad',
        description: '+10% ground defense',
        bonuses: { ground_defense: 0.10 },
        roleAffinity: ['Admiral', 'Captain'],
    },
    {
        id: 'charismatic',
        name: 'Charismatic',
        description: '+5% happiness',
        bonuses: { happiness: 0.05 },
        roleAffinity: ['Governor'],
    },
    {
        id: 'bureaucrat',
        name: 'Bureaucrat',
        description: '+10% infrastructure growth',
        bonuses: { infra_growth: 0.10 },
        roleAffinity: ['Governor'],
    },
    {
        id: 'tactician',
        name: 'Tactician',
        description: '+10% combat effectiveness',
        bonuses: { combat: 0.10 },
        roleAffinity: ['Admiral', 'Captain'],
    },
    {
        id: 'navigator',
        name: 'Navigator',
        description: '+15% fleet speed',
        bonuses: { fleet_speed: 0.15 },
        roleAffinity: ['Admiral', 'Captain'],
    },
    {
        id: 'meticulous',
        name: 'Meticulous',
        description: '+10% survey accuracy',
        bonuses: { survey_accuracy: 0.10 },
        roleAffinity: ['Scientist', 'Captain'],
    },
    {
        id: 'frugal',
        name: 'Frugal',
        description: '-10% mineral costs',
        bonuses: { mineral_cost: -0.10 },
        roleAffinity: ['Engineer', 'Governor'],
    },
    {
        id: 'daring',
        name: 'Daring',
        description: '+10% exploration speed',
        bonuses: { exploration: 0.10 },
        roleAffinity: ['Admiral', 'Captain'],
    },
    {
        id: 'methodical',
        name: 'Methodical',
        description: '+5% all production',
        bonuses: { all_production: 0.05 },
        roleAffinity: ['Engineer', 'Scientist', 'Governor'],
    },
    {
        id: 'executive',
        name: 'Executive',
        description: '+20% corporate revenue',
        bonuses: { corp_revenue: 0.20 },
        roleAffinity: ['CEO'],
    },
];

export const TRAIT_BY_ID: Record<string, TraitDefinition> = Object.fromEntries(TRAITS.map(t => [t.id, t]));

export const ENGINEER_DOMAINS = ['Structural', 'Industrial', 'Aerospace', 'Aetheric'];

export const SPECIALIZATION_BONUSES: Record<string, Record<string, number>> = {
    // Scientist specializations are TechCategory ids
    Computation: { research_rate: 0.10 },
    Engineering: { research_rate: 0.10 },
    Power: { research_rate: 0.10 },
    Military: { research_rate: 0.10 },
    Biology: { research_rate: 0.10 },
    Logistics: { research_rate: 0.10 },
    Geology: { research_rate: 0.10 },
    Astrogation: { research_rate: 0.10 },

    // Engineer specializations
    Structural: { construction_speed: 0.05 },
    Industrial: { factory_output: 0.05 },
    Aerospace: { repair_rate: 0.05 },
    Aetherics: { fuel_efficiency: 0.05 },
};

// ─── Officer Generation ──────────────────────────────────────────────────────

let _officerCounter = 0;

export function generateOfficerName(rng: RNG): string {
    const first = rng.pick(FIRST_NAMES);
    const last = rng.pick(LAST_NAMES);
    return `${first} ${last}`;
}

export function generateCompanyName(rng: RNG, type: CompanyType): string {
    const prefixes = ['Aetheric', 'Blackwood', 'Vulcan', 'Ironclad', 'Imperial', 'Grand', 'Stirling', 'Royal', 'Clockwork', 'Brass', 'Orion', 'Centauri'];
    const suffixes = {
        Transport: ['Shipping Co.', 'Transport Syndicate', 'Logistics', 'Navigation', 'Space Lines', 'Freight'],
        Extraction: ['Mining Syndicate', 'Extraction Corp', 'Mineral Co.', 'Excavations', 'Deep Core Miners', 'Resources'],
        Manufacturing: ['Manufacturing', 'Foundry', 'Heavy Industries', 'Workshops', 'Fabrication Co.', 'Enterprises'],
        Agricultural: ['Farms', 'AgriCorp', 'Harvests', 'Biosystems', 'Foodstuffs', 'Growers'],
        Commercial: ['Goods', 'Consortium', 'Retail', 'Traders', 'Markets', 'Exchange']
    };
    const pre = rng.pick(prefixes);
    const sufList = suffixes[type];
    const suf = rng.pick(sufList);
    return `${pre} ${suf}`;
}

function pickTraits(rng: RNG, role: OfficerRole, count: number): string[] {
    let available = [...TRAITS];
    const picked: string[] = [];

    // Define roles that should ONLY get affinity traits
    const strictRoles: OfficerRole[] = ['Scientist', 'Engineer', 'Admiral', 'Captain'];
    const isStrict = strictRoles.includes(role);

    for (let i = 0; i < count && available.length > 0; i++) {
        const affinityTraits = available.filter(t => t.roleAffinity.includes(role));

        let traitIndex: number;
        if ((isStrict || rng.chance(0.85)) && affinityTraits.length > 0) {
            // Pick from the affinity subset
            const target = rng.pick(affinityTraits);
            traitIndex = available.indexOf(target);
        } else if (!isStrict) {
            // Pick from any remaining traits (mostly for Governors/CEOs)
            traitIndex = rng.intBetween(0, available.length - 1);
        } else {
            // Strict role but no specific affinity traits left (rare)
            break;
        }

        if (traitIndex !== -1) {
            picked.push(available[traitIndex].id);
            available.splice(traitIndex, 1);
        }
    }

    return picked;
}

export function createOfficer(role: OfficerRole, seed?: number): Officer {
    const s = seed ?? (Date.now() + (++_officerCounter) * 7919);
    const rng = new RNG(s);
    const name = generateOfficerName(rng);
    const traitCount = rng.intBetween(1, 2);  // 1-2 traits
    const traits = pickTraits(rng, role, traitCount);

    // Aggregate bonuses from traits
    const bonuses: Record<string, number> = {};
    for (const tid of traits) {
        const trait = TRAIT_BY_ID[tid];
        if (!trait) continue;
        for (const [key, val] of Object.entries(trait.bonuses)) {
            bonuses[key] = (bonuses[key] ?? 0) + val;
        }
    }

    let specialization: string | undefined;
    if (role === 'Scientist') {
        const categories: import('@/types').TechCategory[] = ['Computation', 'Engineering', 'Power', 'Military', 'Biology', 'Logistics', 'Geology', 'Astrogation'];
        specialization = rng.pick(categories);
    } else if (role === 'Engineer') {
        specialization = rng.pick(ENGINEER_DOMAINS);
    }

    return {
        id: `officer_${s.toString(36)}`,
        name,
        role,
        level: 1,
        portraitSeed: s,
        traits,
        experience: 0,
        bonuses,
        specialization,
        assignedTo: undefined,
    };
}

// ─── Get Governor Bonuses for a Colony ───────────────────────────────────────

export function getGovernorBonuses(officers: Officer[], governorId?: string): Record<string, number> {
    if (!governorId) return {};
    const gov = officers.find(o => o.id === governorId);
    if (!gov || gov.role !== 'Governor') return {};
    return gov.bonuses;
}

// ─── Get Admiral Bonuses for a Fleet ─────────────────────────────────────────

export function getAdmiralBonuses(officers: Officer[], admiralId?: string): Record<string, number> {
    if (!admiralId) return {};
    const adm = officers.find(o => o.id === admiralId);
    if (!adm || adm.role !== 'Admiral') return {};
    return adm.bonuses;
}
