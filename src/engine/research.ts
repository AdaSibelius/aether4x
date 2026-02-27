import type { Technology, TechCategory, Empire, GameEvent, EventType } from '@/types';
import { generateId } from '@/utils/id';

export const TECH_TREE: Technology[] = [
    // ═══════════════════════════════════════════════════════════════════════════
    // ERA I: THE ANALYTICAL REVOLUTION (Tier 1) — Pre-completed at game start
    // ═══════════════════════════════════════════════════════════════════════════

    {
        id: 'analytical_engine',
        name: 'Analytical Engine',
        description: 'Babbage\'s mechanical computer — the foundation of all modern computation. Unlocks research capabilities.',
        category: 'Computation',
        tier: 1,
        cost: 200,
        prerequisites: [],
        effects: [{ type: 'unlock_research', value: 1 }],
    },
    {
        id: 'steam_refinement',
        name: 'Aetheric Steam Refinement',
        description: 'Improved high-pressure steam systems that double factory output and efficiency.',
        category: 'Engineering',
        tier: 1,
        cost: 300,
        prerequisites: [],
        effects: [{ type: 'factory_output', value: 0.1 }],
    },
    {
        id: 'bessemer_process',
        name: 'Bessemer Forge Process',
        description: 'Revolutionary steel-making process that vastly improves mineral extraction.',
        category: 'Geology',
        tier: 1,
        cost: 350,
        prerequisites: [],
        effects: [{ type: 'mining_rate', value: 0.15 }],
    },
    {
        id: 'aetheric_dynamo',
        name: 'Aetheric Dynamo',
        description: 'Electromagnetic generators harnessing the aether. Baseline colony power.',
        category: 'Power',
        tier: 1,
        cost: 400,
        prerequisites: [],
        effects: [{ type: 'colony_power', value: 100 }],
    },

    // ═══════════════════════════════════════════════════════════════════════════
    // ERA II: THE IRON FRONTIER (Tier 2) — First player research choices
    // ═══════════════════════════════════════════════════════════════════════════

    {
        id: 'aetheric_distillation',
        name: 'Aetheric Distillation',
        description: 'Advanced fractional distillation of raw aether. Unlocks Aetheric Scoops and Distilleries.',
        category: 'Power',
        tier: 2,
        cost: 500,
        prerequisites: ['aetheric_dynamo'],
        effects: [{ type: 'unlock_distillery', value: 1 }],
    },
    {
        id: 'rocket_propulsion',
        name: 'Combustion Rocketry',
        description: 'Liquid-fueled rockets enable the first tentative steps beyond the atmosphere.',
        category: 'Power',
        tier: 2,
        cost: 600,
        prerequisites: ['aetheric_distillation'],
        effects: [{ type: 'engine_thrust', value: 100 }],
    },
    {
        id: 'difference_engine_mk2',
        name: 'Difference Engine Mk II',
        description: 'Second-generation mechanical computers with parallel computation gears.',
        category: 'Computation',
        tier: 2,
        cost: 800,
        prerequisites: ['analytical_engine'],
        effects: [{ type: 'research_rate', value: 0.15 }],
    },
    {
        id: 'aetheric_discharge',
        name: 'Aetheric Discharge Theory',
        description: 'Focusing aetheric resonation to produce coherent energy discharges for naval combat.',
        category: 'Military',
        tier: 2,
        cost: 750,
        prerequisites: ['steam_refinement'],
        effects: [{ type: 'unlock_laser', value: 1 }],
    },
    {
        id: 'pneumatic_rifles',
        name: 'Pneumatic Repeater Rifles',
        description: 'High-pressure pneumatic weaponry for colonial defense forces.',
        category: 'Military',
        tier: 2,
        cost: 700,
        prerequisites: ['steam_refinement'],
        effects: [{ type: 'ground_defense', value: 1 }],
    },
    {
        id: 'telegraph_networks',
        name: 'Voltaic Telegraph Arrays',
        description: 'Electromagnetic communication grids that extend survey and detection range.',
        category: 'Computation',
        tier: 2,
        cost: 900,
        prerequisites: ['analytical_engine'],
        effects: [{ type: 'survey_range', value: 1 }],
    },
    {
        id: 'industrial_chemistry',
        name: 'Industrial Alchemy',
        description: 'Advanced chemical processes enable the construction of sophisticated structures.',
        category: 'Engineering',
        tier: 2,
        cost: 1000,
        prerequisites: ['bessemer_process'],
        effects: [{ type: 'shipyard_capacity', value: 0.2 }],
    },
    {
        id: 'sanitation_systems',
        name: 'Sanitation Systems',
        description: 'Public health infrastructure improves colony growth rates.',
        category: 'Biology',
        tier: 2,
        cost: 600,
        prerequisites: [],
        effects: [{ type: 'population_growth', value: 0.05 }],
    },
    {
        id: 'naval_design_calculus',
        name: 'Naval Design Calculus',
        description: 'Advanced geometric modeling for vessel hulls. Unlocks the Ship Designer interface.',
        category: 'Engineering',
        tier: 2,
        cost: 800,
        prerequisites: ['steam_refinement', 'analytical_engine'],
        effects: [{ type: 'unlock_design', value: 1 }],
    },

    // ═══════════════════════════════════════════════════════════════════════════
    // ERA III: ATOMIC CLOCKWORK (Tier 3)
    // ═══════════════════════════════════════════════════════════════════════════

    {
        id: 'clockwork_fission',
        name: 'Clockwork Fission Reactor',
        description: 'Mechanical regulators control nuclear chain reactions — reliable atomic power.',
        category: 'Power',
        tier: 3,
        cost: 1800,
        prerequisites: ['rocket_propulsion'],
        effects: [{ type: 'engine_thrust', value: 250 }, { type: 'fuel_efficiency', value: 0.2 }],
    },
    {
        id: 'analytical_ballistics',
        name: 'Analytical Ballistics',
        description: 'Computation-guided electromagnetic accelerators for devastating kinetic strikes.',
        category: 'Military',
        tier: 3,
        cost: 1500,
        prerequisites: ['pneumatic_rifles', 'difference_engine_mk2'],
        effects: [{ type: 'unlock_railgun', value: 1 }],
    },
    {
        id: 'mechanical_biology',
        name: 'Mechanical Biology',
        description: 'Clockwork prosthetics and mechanical medicine improve colony health.',
        category: 'Biology',
        tier: 3,
        cost: 1200,
        prerequisites: ['sanitation_systems'],
        effects: [{ type: 'population_growth', value: 0.1 }],
    },
    {
        id: 'orbital_forge',
        name: 'Orbital Forge Calculus',
        description: 'Computation-optimized zero-gravity manufacturing expands shipyard capacity.',
        category: 'Engineering',
        tier: 3,
        cost: 2000,
        prerequisites: ['industrial_chemistry', 'rocket_propulsion'],
        effects: [{ type: 'shipyard_capacity', value: 0.3 }],
    },
    {
        id: 'ambergris_theory',
        name: 'Ambergris Theory',
        description: 'First scientific understanding of Ambergris — the mysterious substance enabling trans-Newtonian physics.',
        category: 'Computation',
        tier: 3,
        cost: 2500,
        prerequisites: ['difference_engine_mk2', 'telegraph_networks'],
        effects: [{ type: 'unlock_tn_elements', value: 1 }],
    },
    {
        id: 'guided_munitions',
        name: 'Clockwork Guided Munitions',
        description: 'Self-correcting projectiles using miniaturized analytical engines.',
        category: 'Military',
        tier: 3,
        cost: 2000,
        prerequisites: ['analytical_ballistics'],
        effects: [{ type: 'unlock_missile', value: 1 }],
    },

    // ═══════════════════════════════════════════════════════════════════════════
    // ERA IV: THE AMBERGRIS AGE (Tier 4)
    // ═══════════════════════════════════════════════════════════════════════════

    {
        id: 'ambergris_drives',
        name: 'Ambergris Resonance Drives',
        description: 'Engines powered by Ambergris resonance achieve previously impossible thrust levels.',
        category: 'Power',
        tier: 4,
        cost: 5000,
        prerequisites: ['clockwork_fission', 'ambergris_theory'],
        effects: [{ type: 'engine_thrust', value: 500 }, { type: 'fuel_efficiency', value: 0.3 }],
    },
    {
        id: 'difference_engine_mk3',
        name: 'Difference Engine Mk III',
        description: 'Third-generation computation engines with Ambergris-enhanced resonance gears.',
        category: 'Computation',
        tier: 4,
        cost: 4500,
        prerequisites: ['ambergris_theory'],
        effects: [{ type: 'research_rate', value: 0.25 }],
    },
    {
        id: 'gene_alchemy',
        name: 'Gene Alchemy',
        description: 'Ambergris-catalyzed biological manipulation enables advanced medicine and xenobiological study.',
        category: 'Biology',
        tier: 4,
        cost: 4000,
        prerequisites: ['mechanical_biology', 'ambergris_theory'],
        effects: [{ type: 'population_growth', value: 0.15 }],
    },
    {
        id: 'aetheric_shields',
        name: 'Aetheric Deflection Shields',
        description: 'Ambergris-tuned electromagnetic barriers that absorb incoming fire.',
        category: 'Military',
        tier: 4,
        cost: 5500,
        prerequisites: ['guided_munitions', 'ambergris_theory'],
        effects: [{ type: 'shield_strength', value: 100 }],
    },
    {
        id: 'atmospheric_engines',
        name: 'Atmospheric Conversion Engines',
        description: 'Massive machines that reshape planetary atmospheres over decades.',
        category: 'Engineering',
        tier: 4,
        cost: 6000,
        prerequisites: ['orbital_forge', 'ambergris_theory'],
        effects: [{ type: 'unlock_terraforming', value: 1 }],
    },
    {
        id: 'volatility_management',
        name: 'Volatility Management',
        description: 'Advanced governor systems for unstable reactions. Unlocks Atomic Heart and Piston-Driven Atomic Engines.',
        category: 'Power',
        tier: 3,
        cost: 2000,
        prerequisites: ['clockwork_fission'],
        effects: [{ type: 'unlock_atomic', value: 1 }],
    },
    {
        id: 'resonance_mechanics',
        name: 'Aetheric Resonance Mechanics',
        description: 'Mastery of Ambergris vibrations. Unlocks the Resonator Core and Harmonic Nullifier.',
        category: 'Power',
        tier: 4,
        cost: 4500,
        prerequisites: ['ambergris_drives', 'difference_engine_mk3'],
        effects: [{ type: 'unlock_resonance', value: 1 }],
    },
    {
        id: 'point_defense',
        name: 'Clockwork Point Defense',
        description: 'Rapid-fire analytical targeting systems to intercept incoming projectiles.',
        category: 'Military',
        tier: 4,
        cost: 4000,
        prerequisites: ['guided_munitions'],
        effects: [{ type: 'unlock_pdc', value: 1 }],
    },
    {
        id: 'geothermal_tapping',
        name: 'Geothermal Core Tapping',
        description: 'Bore into planetary cores for effectively unlimited colony power.',
        category: 'Power',
        tier: 4,
        cost: 4500,
        prerequisites: ['clockwork_fission'],
        effects: [{ type: 'colony_power', value: 1000 }],
    },

    // ═══════════════════════════════════════════════════════════════════════════
    // ERA V: BEYOND THE AETHER (Tier 5)
    // ═══════════════════════════════════════════════════════════════════════════

    {
        id: 'jump_calculus',
        name: 'Jump Point Calculus',
        description: 'The ultimate breakthrough — computing stable passage through jump points using Ambergris harmonics.',
        category: 'Computation',
        tier: 5,
        cost: 12000,
        prerequisites: ['difference_engine_mk3', 'ambergris_drives'],
        effects: [{ type: 'jump_efficiency', value: 0.15 }],
    },
    {
        id: 'antimatter_forge',
        name: 'Antimatter Forge',
        description: 'Ambergris-catalyzed antimatter production enables the most powerful engines conceivable.',
        category: 'Power',
        tier: 5,
        cost: 15000,
        prerequisites: ['ambergris_drives'],
        effects: [{ type: 'engine_thrust', value: 800 }, { type: 'fuel_efficiency', value: 0.5 }],
    },
    {
        id: 'xenobiology',
        name: 'Xenobiological Studies',
        description: 'Deep understanding of alien biology opens diplomacy with other species.',
        category: 'Biology',
        tier: 5,
        cost: 10000,
        prerequisites: ['gene_alchemy'],
        effects: [{ type: 'unlock_diplomacy', value: 1 }],
    },
    {
        id: 'planetary_engines',
        name: 'Planetary Engines',
        description: 'Continent-scale terraforming machines powered by Ambergris resonance.',
        category: 'Engineering',
        tier: 5,
        cost: 14000,
        prerequisites: ['atmospheric_engines', 'ambergris_drives'],
        effects: [{ type: 'terraforming_speed', value: 2 }],
    },
    {
        id: 'ambergris_weaponry',
        name: 'Ambergris Weaponry',
        description: 'Weapons that channel raw Ambergris energy — devastating and unstoppable.',
        category: 'Military',
        tier: 5,
        cost: 16000,
        prerequisites: ['aetheric_shields', 'ambergris_drives'],
        effects: [{ type: 'unlock_laser', value: 1 }],
    },
    {
        id: 'jump_drive_efficiency',
        name: 'Jump Drive Efficiency I',
        description: 'Optimized Ambergris harmonics reduce jump fuel consumption by 20%.',
        category: 'Computation',
        tier: 5,
        cost: 18000,
        prerequisites: ['jump_calculus'],
        effects: [{ type: 'jump_fuel', value: -0.20 }],
    },

    // ═══════════════════════════════════════════════════════════════════════════
    // ADDITIONAL TECHS: Mining, Colony Management & Infrastructure
    // ═══════════════════════════════════════════════════════════════════════════

    // Tier 2 additions
    {
        id: 'steam_drill',
        name: 'Steam-Powered Bore Drill',
        description: 'High-pressure steam drills that dramatically improve mine output on rocky worlds.',
        category: 'Engineering',
        tier: 2,
        cost: 700,
        prerequisites: ['bessemer_process'],
        effects: [{ type: 'mining_rate', value: 0.25 }],
    },
    {
        id: 'fuel_distillation',
        name: 'Petroleum Distillation',
        description: 'Refined fuel processing for early rocket engines. Reduces fuel costs.',
        category: 'Power',
        tier: 2,
        cost: 500,
        prerequisites: ['aetheric_dynamo'],
        effects: [{ type: 'fuel_efficiency', value: 0.1 }],
    },
    {
        id: 'colonial_administration',
        name: 'Colonial Administration',
        description: 'Bureaucratic frameworks for managing far-flung settlements. +10% colony infrastructure growth.',
        category: 'Biology',
        tier: 2,
        cost: 800,
        prerequisites: ['sanitation_systems'],
        effects: [{ type: 'infra_growth', value: 0.10 }],
    },

    // Tier 3 additions
    {
        id: 'deep_core_mining',
        name: 'Deep Core Mining',
        description: 'Techniques for extracting minerals from planetary mantles. +30% mining rate.',
        category: 'Engineering',
        tier: 3,
        cost: 1800,
        prerequisites: ['steam_drill', 'clockwork_fission'],
        effects: [{ type: 'mining_rate', value: 0.30 }],
    },
    {
        id: 'prefab_habitats',
        name: 'Prefabricated Habitats',
        description: 'Mass-produced colony modules accelerate settlement construction.',
        category: 'Engineering',
        tier: 3,
        cost: 1500,
        prerequisites: ['industrial_chemistry'],
        effects: [{ type: 'construction_speed', value: 0.25 }],
    },
    {
        id: 'clockwork_surveyor',
        name: 'Clockwork Geological Surveyor',
        description: 'Automated mineral detection systems double survey accuracy and reveal deeper deposits.',
        category: 'Computation',
        tier: 3,
        cost: 1600,
        prerequisites: ['telegraph_networks'],
        effects: [{ type: 'survey_accuracy', value: 2.0 }],
    },
    {
        id: 'recycling_furnaces',
        name: 'Recycling Furnaces',
        description: 'Recover minerals from waste production. Reduces mineral costs by 15%.',
        category: 'Engineering',
        tier: 3,
        cost: 1400,
        prerequisites: ['bessemer_process', 'industrial_chemistry'],
        effects: [{ type: 'mineral_cost_reduction', value: 0.15 }],
    },

    // Tier 4 additions
    {
        id: 'ambergris_extraction',
        name: 'Ambergris Extraction Engines',
        description: 'Specialized Ambergris-tuned extractors that double mining output from all deposits.',
        category: 'Geology',
        tier: 4,
        cost: 5500,
        prerequisites: ['deep_core_mining', 'ambergris_theory'],
        effects: [{ type: 'mining_rate', value: 0.50 }],
    },
    {
        id: 'pressurized_domes',
        name: 'Pressurized Colony Domes',
        description: 'Enable colonization of hostile worlds with thin or toxic atmospheres.',
        category: 'Engineering',
        tier: 4,
        cost: 4500,
        prerequisites: ['prefab_habitats', 'ambergris_theory'],
        effects: [{ type: 'hostile_colony', value: 1 }],
    },
    {
        id: 'population_management',
        name: 'Population Management Systems',
        description: 'Analytical engine-driven logistics for urban planning. +20% population capacity.',
        category: 'Biology',
        tier: 4,
        cost: 4000,
        prerequisites: ['gene_alchemy'],
        effects: [{ type: 'population_cap', value: 0.20 }],
    },

    // Tier 5 additions
    {
        id: 'zero_g_refineries',
        name: 'Zero-G Refineries',
        description: 'Orbital mineral processing facilities that extract trace elements from gas giants.',
        category: 'Geology',
        tier: 5,
        cost: 14000,
        prerequisites: ['ambergris_extraction', 'ambergris_drives'],
        effects: [{ type: 'mining_rate', value: 0.75 }],
    },
    {
        id: 'autonomous_factories',
        name: 'Autonomous Clockwork Factories',
        description: 'Self-operating factories that produce materials without human oversight.',
        category: 'Computation',
        tier: 5,
        cost: 15000,
        prerequisites: ['difference_engine_mk3', 'ambergris_drives'],
        effects: [{ type: 'factory_output', value: 0.5 }],
    },
];

export const TECH_BY_ID: Record<string, Technology> = Object.fromEntries(TECH_TREE.map(t => [t.id, t]));

export const TECH_CATEGORIES: TechCategory[] = [
    'Computation',
    'Engineering',
    'Power',
    'Military',
    'Biology',
    'Logistics',
    'Geology',
    'Astrogation'
];

export function getAvailableTechs(completedTechs: string[]): Technology[] {
    const completed = new Set(completedTechs);
    return TECH_TREE.filter(t =>
        !completed.has(t.id) &&
        t.prerequisites.every(p => completed.has(p))
    );
}

function makeEvent(type: EventType, message: string, opts?: { starId?: string; planetId?: string; important?: boolean }): GameEvent {
    return {
        id: generateId('evt'),
        turn: 0, // Placeholder, will be updated by caller if needed or used as relative
        date: new Date().toISOString().split('T')[0],
        type,
        message,
        important: opts?.important ?? false,
        starId: opts?.starId,
        planetId: opts?.planetId,
    };
}

export function tickResearch(empire: Empire, dt: number): GameEvent[] {
    const events: GameEvent[] = [];
    const { research, officers } = empire;

    // Base RP per lab (could be moved to constants)
    const BASE_RP_PER_LAB = 20;

    // We use a traditional for loop to avoid issues with splice while iterating
    for (let i = research.activeProjects.length - 1; i >= 0; i--) {
        const project = research.activeProjects[i];
        const tech = TECH_BY_ID[project.techId];
        if (!tech) continue;

        const scientist = officers.find(o => o.id === project.scientistId);

        // Calculate bonus: 5% per level + 10% per level if specialized in the category
        let bonus = 1.0;
        if (scientist) {
            const levelBonus = scientist.level * 0.05;
            const specBonus = (scientist.specialization === tech.category) ? scientist.level * 0.10 : 0;
            bonus += levelBonus + specBonus;

            // Apply trait bonuses (e.g., Visionary)
            const traitBonus = (scientist.bonuses['research_rate'] || 0);
            bonus += traitBonus;
        }

        const projectRate = (project.labs * BASE_RP_PER_LAB) * bonus;
        project.investedPoints += projectRate * (dt / 86400);

        if (project.investedPoints >= tech.cost) {
            research.completedTechs.push(tech.id);
            events.push(makeEvent('ResearchComplete',
                `Research complete: ${tech.name}`, { important: tech.tier >= 2 }));

            // Remove technical project from active list
            research.activeProjects.splice(i, 1);
        }
    }

    return events;
}
