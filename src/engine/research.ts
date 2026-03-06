/**
 * @module research
 * @description
 * Technology tree definitions and research progression logic.
 * 
 * **Architecture & State Mutations:**
 * - `tickResearch` updates `GameState.empires[id].research`.
 * - It processes active projects, applies research points from colonies, and unlocks new technologies upon completion.
 * - Uses `TECH_TREE` definitions to validate prerequisites.
 */
import type { GameState, Empire, Technology, TechCategory, GameEvent, EventType, TechBonuses } from '../types';
import { generateId } from '../utils/id';
import { RNG } from '../utils/rng';

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
    {
        id: 'celestial_mapping',
        name: 'Celestial Mapping',
        description: 'Basic starmaps and sextants — the start of true navigation beyond the home planet.',
        category: 'Astrogation',
        tier: 1,
        cost: 250,
        prerequisites: [],
        effects: [{ type: 'survey_range', value: 0.5 }],
    },
    {
        id: 'standardized_containers',
        name: 'Standardized Aether-Tight Containers',
        description: 'Uniform cargo canisters that streamline interplanetary transport.',
        category: 'Logistics',
        tier: 1,
        cost: 200,
        prerequisites: [],
        effects: [{ type: 'load_speed', value: 0.1 }],
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
        cost: 4500,
        prerequisites: ['aetheric_dynamo'],
        effects: [{ type: 'unlock_distillery', value: 1 }],
    },
    {
        id: 'rocket_propulsion',
        name: 'Combustion Rocketry',
        description: 'Liquid-fueled rockets enable the first tentative steps beyond the atmosphere.',
        category: 'Power',
        tier: 2,
        cost: 5500,
        prerequisites: ['aetheric_distillation'],
        effects: [{ type: 'engine_thrust', value: 100 }],
    },
    {
        id: 'difference_engine_mk2',
        name: 'Difference Engine Mk II',
        description: 'Second-generation mechanical computers with parallel computation gears.',
        category: 'Computation',
        tier: 2,
        cost: 6000,
        prerequisites: ['analytical_engine'],
        effects: [{ type: 'research_rate', value: 0.15 }],
    },
    {
        id: 'officer_academy_foundation',
        name: 'Imperial Naval Academy',
        description: 'Formalizing officer training. New recruits start with slightly more experience.',
        category: 'Military',
        tier: 2,
        cost: 7200,
        prerequisites: ['analytical_engine'],
        effects: [{ type: 'officer_starting_level', value: 1 }],
    },
    {
        id: 'aetheric_discharge',
        name: 'Aetheric Discharge Theory',
        description: 'Focusing aetheric resonation to produce coherent energy discharges for naval combat.',
        category: 'Military',
        tier: 2,
        cost: 8000,
        prerequisites: ['steam_refinement'],
        effects: [{ type: 'unlock_laser', value: 1 }],
    },
    {
        id: 'telegraph_networks',
        name: 'Voltaic Telegraph Arrays',
        description: 'Electromagnetic communication grids that extend survey and detection range.',
        category: 'Computation',
        tier: 2,
        cost: 5000,
        prerequisites: ['analytical_engine'],
        effects: [{ type: 'survey_range', value: 1 }],
    },
    {
        id: 'industrial_chemistry',
        name: 'Industrial Alchemy',
        description: 'Advanced chemical processes enable the construction of sophisticated structures.',
        category: 'Engineering',
        tier: 2,
        cost: 6500,
        prerequisites: ['bessemer_process'],
        effects: [{ type: 'shipyard_capacity', value: 0.2 }],
    },
    {
        id: 'sanitation_systems',
        name: 'Sanitation Systems',
        description: 'Public health infrastructure improves colony growth rates.',
        category: 'Biology',
        tier: 2,
        cost: 3500,
        prerequisites: [],
        effects: [{ type: 'population_growth', value: 0.05 }],
    },
    {
        id: 'naval_design_calculus',
        name: 'Naval Design Calculus',
        description: 'Advanced geometric modeling for vessel hulls. Unlocks the Ship Designer interface.',
        category: 'Engineering',
        tier: 2,
        cost: 5500,
        prerequisites: ['steam_refinement', 'analytical_engine'],
        effects: [{ type: 'unlock_design', value: 1 }],
    },
    {
        id: 'gravitational_surveying',
        name: 'Gravitational Surveying',
        description: 'Sensitive barometers detect subtle gravitational shifts, aiding in system exploration.',
        category: 'Astrogation',
        tier: 2,
        cost: 4200,
        prerequisites: ['celestial_mapping'],
        effects: [{ type: 'survey_accuracy', value: 0.5 }],
    },
    {
        id: 'hydrographic_surveys',
        name: 'Hydrographic Surveys',
        description: 'Advanced mapping of planetary water and liquid resources.',
        category: 'Geology',
        tier: 2,
        cost: 4800,
        prerequisites: ['bessemer_process'],
        effects: [{ type: 'mining_rate', value: 0.1 }],
    },
    {
        id: 'automated_docking',
        name: 'Pneumatic Docking Clamps',
        description: 'Standardized automated clamps that reduce ship turnaround time in port.',
        category: 'Logistics',
        tier: 2,
        cost: 5200,
        prerequisites: ['standardized_containers'],
        effects: [{ type: 'load_speed', value: 0.2 }],
    },
    {
        id: 'soil_enrichment',
        name: 'Chemical Soil Enrichment',
        description: 'Advanced fertilizers and soil treatment protocols for increased agricultural yield.',
        category: 'Biology',
        tier: 2,
        cost: 4800,
        prerequisites: ['sanitation_systems'],
        effects: [{ type: 'farm_yield', value: 0.15 }],
    },
    {
        id: 'precision_surveying',
        name: 'Precision Seismic Surveying',
        description: 'Using high-frequency vibrations to locate shallow mineral deposits.',
        category: 'Geology',
        tier: 2,
        cost: 5500,
        prerequisites: ['bessemer_process'],
        effects: [{ type: 'mining_rate', value: 0.15 }],
    },
    {
        id: 'steam_turbine_refinement',
        name: 'Steam Turbine Refinement',
        description: 'Optimizing the expansion curves of steam turbines for improved industrial power.',
        category: 'Engineering',
        tier: 2,
        cost: 5900,
        prerequisites: ['steam_refinement'],
        effects: [{ type: 'factory_output', value: 0.15 }],
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
        cost: 45000,
        prerequisites: ['rocket_propulsion'],
        effects: [{ type: 'engine_thrust', value: 250 }, { type: 'fuel_efficiency', value: 0.2 }],
    },
    {
        id: 'analytical_ballistics',
        name: 'Analytical Ballistics',
        description: 'Computation-guided electromagnetic accelerators for devastating kinetic strikes.',
        category: 'Military',
        tier: 3,
        cost: 55000,
        prerequisites: ['aetheric_discharge', 'difference_engine_mk2'],
        effects: [{ type: 'unlock_railgun', value: 1 }],
    },
    {
        id: 'psychological_profiling',
        name: 'Imperial Psychological Profiling',
        description: 'Statistical analysis of officer candidates. Higher chance for positive traits.',
        category: 'Biology',
        tier: 3,
        cost: 42000,
        prerequisites: ['sanitation_systems', 'difference_engine_mk2'],
        effects: [{ type: 'officer_trait_chance', value: 0.25 }],
    },
    {
        id: 'mechanical_biology',
        name: 'Mechanical Biology',
        description: 'Clockwork prosthetics and mechanical medicine improve colony health.',
        category: 'Biology',
        tier: 3,
        cost: 38000,
        prerequisites: ['sanitation_systems'],
        effects: [{ type: 'population_growth', value: 0.1 }],
    },
    {
        id: 'orbital_forge',
        name: 'Orbital Forge Calculus',
        description: 'Computation-optimized zero-gravity manufacturing expands shipyard capacity.',
        category: 'Engineering',
        tier: 3,
        cost: 65000,
        prerequisites: ['industrial_chemistry', 'rocket_propulsion'],
        effects: [{ type: 'shipyard_capacity', value: 0.3 }],
    },
    {
        id: 'ambergris_theory',
        name: 'Ambergris Theory',
        description: 'First scientific understanding of Ambergris — the substance enabling trans-Newtonian physics.',
        category: 'Computation',
        tier: 3,
        cost: 85000,
        prerequisites: ['difference_engine_mk2', 'telegraph_networks'],
        effects: [{ type: 'unlock_tn_elements', value: 1 }],
    },
    {
        id: 'scientific_methodology',
        name: 'Standardized Scientific Methodology',
        description: 'Systematic peer-review and experimental rigour accelerate all research.',
        category: 'Computation',
        tier: 3,
        cost: 72000,
        prerequisites: ['difference_engine_mk2'],
        effects: [{ type: 'research_rate', value: 0.2 }],
    },
    {
        id: 'guided_munitions',
        name: 'Clockwork Guided Munitions',
        description: 'Self-correcting projectiles using miniaturized analytical engines.',
        category: 'Military',
        tier: 3,
        cost: 60000,
        prerequisites: ['analytical_ballistics', 'telegraph_networks'],
        effects: [{ type: 'unlock_missile', value: 1 }],
    },
    {
        id: 'enhanced_resonance_sensors',
        name: 'Enhanced Resonance Sensors',
        description: 'Tuning telegraph arrays to pick up subtle harmonic distortions in the aether. Unlocks Active Pulse Emitters.',
        category: 'Computation',
        tier: 3,
        cost: 55000,
        prerequisites: ['telegraph_networks', 'difference_engine_mk2'],
        effects: [{ type: 'survey_range', value: 2.0 }],
    },
    {
        id: 'warp_geometry',
        name: 'Experimental Warp Geometry',
        description: 'Theoretical models of space-time folding. Required for jump drive technology.',
        category: 'Astrogation',
        tier: 3,
        cost: 68000,
        prerequisites: ['gravitational_surveying'],
        effects: [{ type: 'jump_efficiency', value: 0.05 }],
    },
    {
        id: 'automated_mineral_sorting',
        name: 'Automated Mineral Sorting',
        description: 'Mechanical sieves that improve mining purity and throughput.',
        category: 'Geology',
        tier: 3,
        cost: 52000,
        prerequisites: ['bessemer_process'],
        effects: [{ type: 'mining_rate', value: 0.2 }],
    },
    {
        id: 'orbital_fire_control',
        name: 'Orbital Fire Control',
        description: 'Synchronized telemetry for precision bombardment of planetary targets. Unlocks Kinetic Mass Drivers.',
        category: 'Military',
        tier: 3,
        cost: 62000,
        prerequisites: ['analytical_ballistics', 'telegraph_networks'],
        effects: [{ type: 'unlock_bombardment', value: 1 }],
    },
    {
        id: 'supply_chain_optimization',
        name: 'Algorithmic Supply Chain',
        description: 'Difference Engine-driven optimization of freight schedules reduces fuel waste.',
        category: 'Logistics',
        tier: 3,
        cost: 48000,
        prerequisites: ['automated_docking', 'difference_engine_mk2'],
        effects: [{ type: 'fuel_efficiency', value: 0.1 }],
    },
    {
        id: 'hydroponic_vats',
        name: 'Hydroponic Vat Systems',
        description: 'Soilless cultivation chambers that drastically increase food production in confined spaces.',
        category: 'Biology',
        tier: 3,
        cost: 42000,
        prerequisites: ['soil_enrichment'],
        effects: [{ type: 'farm_yield', value: 0.25 }],
    },
    {
        id: 'gravity_feed_forges',
        name: 'Gravity-Feed Forges',
        description: 'Using natural planetary gravity to automate the movement of heavy slag in foundries.',
        category: 'Engineering',
        tier: 3,
        cost: 55000,
        prerequisites: ['industrial_chemistry'],
        effects: [{ type: 'shipyard_capacity', value: 0.25 }],
    },
    {
        id: 'seismic_resonance_mapping',
        name: 'Seismic Resonance Mapping',
        description: 'Analyzing the echoes of deep tremors to find rich secondary ore veins.',
        category: 'Geology',
        tier: 3,
        cost: 48000,
        prerequisites: ['precision_surveying'],
        effects: [{ type: 'mining_rate', value: 0.20 }],
    },
    {
        id: 'lab_management_protocols',
        name: 'Lab Management Protocols',
        description: 'Standardized methods for organizing multi-disciplinary research teams.',
        category: 'Computation',
        tier: 3,
        cost: 52000,
        prerequisites: ['scientific_methodology'],
        effects: [{ type: 'research_capacity', value: 10 }],
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
        cost: 450000,
        prerequisites: ['clockwork_fission', 'ambergris_theory'],
        effects: [{ type: 'engine_thrust', value: 500 }, { type: 'fuel_efficiency', value: 0.3 }],
    },
    {
        id: 'difference_engine_mk3',
        name: 'Difference Engine Mk III',
        description: 'Third-generation computation engines with Ambergris-enhanced resonance gears.',
        category: 'Computation',
        tier: 4,
        cost: 550000,
        prerequisites: ['ambergris_theory'],
        effects: [{ type: 'research_rate', value: 0.25 }],
    },
    {
        id: 'specialist_training_regime',
        name: 'Officer Specialist Regimes',
        description: 'Intensive training for scientific and engineering disciplines.',
        category: 'Computation',
        tier: 4,
        cost: 480000,
        prerequisites: ['difference_engine_mk2'],
        effects: [{ type: 'officer_specialization_bonus', value: 0.1 }],
    },
    {
        id: 'gene_alchemy',
        name: 'Gene Alchemy',
        description: 'Ambergris-catalyzed biological manipulation enables advanced medicine.',
        category: 'Biology',
        tier: 4,
        cost: 420000,
        prerequisites: ['mechanical_biology', 'ambergris_theory'],
        effects: [{ type: 'population_growth', value: 0.2 }],
    },
    {
        id: 'aetheric_shields',
        name: 'Aetheric Deflection Shields',
        description: 'Ambergris-tuned electromagnetic barriers that absorb incoming fire.',
        category: 'Military',
        tier: 4,
        cost: 520000,
        prerequisites: ['guided_munitions', 'ambergris_theory'],
        effects: [{ type: 'shield_strength', value: 100 }],
    },
    {
        id: 'aetheric_dampeners',
        name: 'Aetheric Dampeners',
        description: 'Using resonance-absorbing alloys to mask a vessel\'s presence in the aether. Unlocks Stealth Hull plating.',
        category: 'Military',
        tier: 4,
        cost: 480000,
        prerequisites: ['industrial_chemistry', 'aetheric_shields'],
        effects: [{ type: 'unlock_stealth', value: 1 }],
    },
    {
        id: 'atmospheric_engines',
        name: 'Atmospheric Conversion Engines',
        description: 'Massive machines that reshape planetary atmospheres over decades.',
        category: 'Engineering',
        tier: 4,
        cost: 650000,
        prerequisites: ['orbital_forge', 'ambergris_theory'],
        effects: [{ type: 'unlock_terraforming', value: 1 }],
    },
    {
        id: 'industrial_robotics_tier1',
        name: 'Steam-Powered Automata',
        description: 'Rudimentary mechanical workers that augment human labor in factories.',
        category: 'Engineering',
        tier: 4,
        cost: 580000,
        prerequisites: ['orbital_forge'],
        effects: [{ type: 'factory_output', value: 0.3 }],
    },
    {
        id: 'jump_lane_stabilization',
        name: 'Jump Lane Stabilization',
        description: 'Establishing resonance beacons reduces the strain of trans-Newtonian travel.',
        category: 'Astrogation',
        tier: 4,
        cost: 460000,
        prerequisites: ['warp_geometry'],
        effects: [{ type: 'jump_fuel', value: -0.1 }],
    },
    {
        id: 'deep_core_mining',
        name: 'Ambergris Bore-Drills',
        description: 'Resonance-tipped drills capable of reaching mantle-depth mineral deposits.',
        category: 'Geology',
        tier: 4,
        cost: 512000,
        prerequisites: ['automated_mineral_sorting', 'ambergris_theory'],
        effects: [{ type: 'mining_rate', value: 0.4 }],
    },
    {
        id: 'seismic_resonance_yield',
        name: 'Seismic Resonance Yield',
        description: 'Maximizing tectonic impact of orbital strikes to shatter underground bunkers. Unlocks Orbital Lances.',
        category: 'Military',
        tier: 4,
        cost: 540000,
        prerequisites: ['orbital_fire_control', 'ambergris_theory'],
        effects: [{ type: 'bombardment_damage', value: 0.50 }],
    },
    {
        id: 'high_capacity_bays',
        name: 'Resonant Cargo Expansion',
        description: 'Ambergris-stabilized structures allow for denser packing of cargo containers.',
        category: 'Logistics',
        tier: 4,
        cost: 440000,
        prerequisites: ['standardized_containers', 'ambergris_theory'],
        effects: [{ type: 'cargo_capacity', value: 0.5 }],
    },
    {
        id: 'automated_assembly_logic',
        name: 'Automated Assembly Logic',
        description: 'Advanced logical sequences for mechanical workers that maximize factory floor efficiency.',
        category: 'Engineering',
        tier: 4,
        cost: 550000,
        prerequisites: ['industrial_robotics_tier1'],
        effects: [{ type: 'factory_output', value: 0.25 }],
    },
    {
        id: 'precision_deep_drilling',
        name: 'Precision Deep Drilling',
        description: 'Resonance-guided drill bits that maintain structural integrity at extreme depths.',
        category: 'Geology',
        tier: 4,
        cost: 512000,
        prerequisites: ['deep_core_mining'],
        effects: [{ type: 'mining_rate', value: 0.35 }],
    },
    {
        id: 'logistics_shunting_algorithms',
        name: 'Logistics Shunting Algorithms',
        description: 'Predictive computation for cargo movement within spaceports.',
        category: 'Logistics',
        tier: 4,
        cost: 480000,
        prerequisites: ['supply_chain_optimization'],
        effects: [{ type: 'load_speed', value: 0.40 }],
    },

    // ═══════════════════════════════════════════════════════════════════════════
    // ERA V: BEYOND THE AETHER (Tier 5)
    // ═══════════════════════════════════════════════════════════════════════════

    {
        id: 'jump_calculus',
        name: 'Jump Point Calculus',
        description: 'Computing stable passage through jump points using Ambergris harmonics.',
        category: 'Computation',
        tier: 5,
        cost: 2500000,
        prerequisites: ['difference_engine_mk3', 'ambergris_drives'],
        effects: [{ type: 'jump_efficiency', value: 0.15 }],
    },
    {
        id: 'advanced_officer_commissioning',
        name: 'High Command Commissioning',
        description: 'Elite recruitment protocols for the highest level of leadership.',
        category: 'Military',
        tier: 5,
        cost: 2200000,
        prerequisites: ['officer_academy_foundation', 'difference_engine_mk3'],
        effects: [{ type: 'officer_starting_level', value: 2 }, { type: 'officer_trait_chance', value: 0.2 }],
    },
    {
        id: 'antimatter_forge',
        name: 'Antimatter Forge',
        description: 'Ambergris-catalyzed antimatter production enables powerful engines.',
        category: 'Power',
        tier: 5,
        cost: 3500000,
        prerequisites: ['ambergris_drives'],
        effects: [{ type: 'engine_thrust', value: 800 }, { type: 'fuel_efficiency', value: 0.5 }],
    },
    {
        id: 'synthetic_ambergris',
        name: 'Synthetic Ambergris Crystallization',
        description: 'Laboratory-grown Ambergris reduces dependency on natural deposits and improves efficiency.',
        category: 'Power',
        tier: 5,
        cost: 3200000,
        prerequisites: ['antimatter_forge'],
        effects: [{ type: 'fuel_efficiency', value: 0.3 }],
    },
    {
        id: 'interstellar_hubs',
        name: 'Deep Space Navigation Hubs',
        description: 'Massive orbital beacons that coordination fleet movements across the stars.',
        category: 'Astrogation',
        tier: 5,
        cost: 2800000,
        prerequisites: ['jump_lane_stabilization'],
        effects: [{ type: 'survey_accuracy', value: 1.0 }],
    },
    {
        id: 'planetary_logistics_grid',
        name: 'Integrated Planetary Logistics',
        description: 'Global-scale automated transport networks that maximize colony throughput.',
        category: 'Logistics',
        tier: 5,
        cost: 2400000,
        prerequisites: ['high_capacity_bays', 'difference_engine_mk3'],
        effects: [{ type: 'load_speed', value: 0.5 }],
    },

    {
        id: 'grand_scientist_mentorship',
        name: 'Grand Scientist Mentorship',
        description: 'Establishing elite mentorship programs to pass down complex lab management techniques.',
        category: 'Computation',
        tier: 5,
        cost: 3200000,
        prerequisites: ['lab_management_protocols'],
        effects: [{ type: 'research_capacity', value: 15 }],
    },
    {
        id: 'genetic_yield_optimization',
        name: 'Genetic Food Yield Optimization',
        description: 'Tailoring crop genetics to specific planetary aetheric signatures.',
        category: 'Biology',
        tier: 5,
        cost: 2800000,
        prerequisites: ['gene_alchemy'],
        effects: [{ type: 'farm_yield', value: 0.40 }],
    },
    {
        id: 'nano_seismic_imaging',
        name: 'Nano-Seismic Imaging',
        description: 'Deploying clouds of nanobots to map tectonic faults with sub-millimeter precision.',
        category: 'Geology',
        tier: 5,
        cost: 3100000,
        prerequisites: ['deep_core_mining', 'precision_deep_drilling'],
        effects: [{ type: 'mining_rate', value: 0.45 }],
    },


    // ═══════════════════════════════════════════════════════════════════════════
    // ERA VI: RESONATED SOCIETY (Tier 6)
    // ═══════════════════════════════════════════════════════════════════════════

    {
        id: 'aetheric_neural_links',
        name: 'Aetheric Neural Links',
        description: 'Interfacing scientist minds with analytical engines to accelerate discovery.',
        category: 'Computation',
        tier: 6,
        cost: 12000000,
        prerequisites: ['jump_calculus'],
        effects: [{ type: 'research_rate', value: 0.5 }],
    },
    {
        id: 'subspace_cartography',
        name: 'Sub-Space Cartography',
        description: 'Real-time monitoring of jump lane vibrations enables precise fleet tracking.',
        category: 'Astrogation',
        tier: 6,
        cost: 15000000,
        prerequisites: ['interstellar_hubs'],
        effects: [{ type: 'survey_range', value: 5.0 }],
    },
    {
        id: 'quantum_inventory_tracking',
        name: 'Quantum Inventory Tracking',
        description: 'Every mineral atom is tracked in real-time, eliminating loss and waste during transfer.',
        category: 'Logistics',
        tier: 6,
        cost: 10000000,
        prerequisites: ['planetary_logistics_grid'],
        effects: [{ type: 'mineral_cost_reduction', value: 0.2 }],
    },

    {
        id: 'subspace_research_nodes',
        name: 'Sub-Space Research Nodes',
        description: 'Establishing computation nodes inside subspace pockets to bypass physical calculation limits.',
        category: 'Computation',
        tier: 6,
        cost: 12000000,
        prerequisites: ['aetheric_neural_links'],
        effects: [{ type: 'research_rate', value: 0.5 }],
    },
    {
        id: 'tectonic_stabilization',
        name: 'Tectonic Harmonic Stabilization',
        description: 'Active frequency dampeners that allow for massive mining operations without seismic risk.',
        category: 'Geology',
        tier: 6,
        cost: 14000000,
        prerequisites: ['nano_seismic_imaging'],
        effects: [{ type: 'mining_rate', value: 0.60 }],
    },
    {
        id: 'quantum_logistics_matrix',
        name: 'Quantum Logistics Matrix',
        description: 'Using quantum entanglement to synchronize supply chains across the stars.',
        category: 'Logistics',
        tier: 6,
        cost: 11000000,
        prerequisites: ['quantum_inventory_tracking'],
        effects: [{ type: 'fuel_efficiency', value: 0.50 }],
    },

    // ═══════════════════════════════════════════════════════════════════════════
    // ERA VII: TRANS-AETHERIC ENGINEERING (Tier 7)
    // ═══════════════════════════════════════════════════════════════════════════

    {
        id: 'void_fold_engines',
        name: 'Void-Fold Engines',
        description: 'Near-instantaneous transit between star systems by folding space-time.',
        category: 'Power',
        tier: 7,
        cost: 65000000,
        prerequisites: ['antimatter_forge', 'subspace_cartography'],
        effects: [{ type: 'jump_efficiency', value: 0.5 }],
    },
    // ─── Detection & Stealth ──────────────────────────────────────────────────────
    {
        id: 'enhanced_resonance_sensors',
        name: 'Enhanced Resonance Sensors',
        description: 'Amplifies the harmonic resonance bands used by survey arrays, improving passive detection resolution by 30% and unlocking the Resonance Pulse Emitter active sensor module.',
        category: 'Astrogation',
        tier: 3,
        cost: 55000,
        prerequisites: ['gravitational_surveying'],
        effects: [{ type: 'sensor_resolution', value: 0.3 }, { type: 'unlock_active_sensor', value: 1 }],
    },
    {
        id: 'aetheric_dampeners',
        name: 'Aetheric Dampeners',
        description: 'Resonance-absorbing alloys woven into hull plating cancel the ship\'s Aetheric Flux signature, making fleets nearly invisible to passive sensors.',
        category: 'Military',
        tier: 4,
        cost: 480000,
        prerequisites: ['aetheric_shields'],
        effects: [{ type: 'unlock_stealth_hull', value: 1 }],
    },

    {
        id: 'trans_planetary_pipelines',
        name: 'Trans-Planetary Pipelines',
        description: 'Massive surface-to-orbit mineral lifters capable of moving entire mountains hourly.',
        category: 'Logistics',
        tier: 7,
        cost: 52000000,
        prerequisites: ['quantum_inventory_tracking'],
        effects: [{ type: 'load_speed', value: 1.0 }],
    },

    // ═══════════════════════════════════════════════════════════════════════════
    // ERA VIII: STELLAR CONSCIOUSNESS (Tier 8)
    // ═══════════════════════════════════════════════════════════════════════════

    {
        id: 'ai_core_governors',
        name: 'Aetheric Intelligence Governors',
        description: 'Fully autonomous planetary management cores with 100% decision efficiency.',
        category: 'Computation',
        tier: 8,
        cost: 250000000,
        prerequisites: ['aetheric_neural_links'],
        effects: [{ type: 'factory_output', value: 1.0 }],
    },
    {
        id: 'teleportation_logistics',
        name: 'Resonant Teleportation',
        description: 'Instantaneous cargo transfer between any two points in a star system.',
        category: 'Logistics',
        tier: 8,
        cost: 380000000,
        prerequisites: ['trans_planetary_pipelines'],
        effects: [{ type: 'load_speed', value: 10.0 }],
    },
    {
        id: 'stellar_nursery_agriculture',
        name: 'Stellar Nursery Agriculture',
        description: 'Farming in the actual coronas of stars using magnetic containment fields.',
        category: 'Biology',
        tier: 8,
        cost: 450000000,
        prerequisites: ['genetic_yield_optimization'],
        effects: [{ type: 'farm_yield', value: 1.0 }],
    },
    {
        id: 'infinite_computation_lattice',
        name: 'Infinite Computation Lattice',
        description: 'A stellar-scale computer that provides infinite research overhead.',
        category: 'Computation',
        tier: 8,
        cost: 500000000,
        prerequisites: ['subspace_research_nodes'],
        effects: [{ type: 'research_capacity', value: 50 }],
    },
];

export const TECH_BY_ID: Record<string, Technology> = Object.fromEntries(TECH_TREE.map(t => [t.id, t]));

export function getEmpireTechBonuses(completedTechs: string[]): TechBonuses {
    const bonuses: TechBonuses = {};
    completedTechs.forEach(techId => {
        const tech = TECH_BY_ID[techId];
        if (tech) {
            tech.effects.forEach(effect => {
                bonuses[effect.type] = (bonuses[effect.type] || 0) + effect.value;
            });
        }
    });
    return bonuses;
}

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

function makeEvent(type: EventType, message: string, rng: RNG, opts?: { starId?: string; planetId?: string; important?: boolean }): GameEvent {
    return {
        id: generateId('evt', rng),
        turn: 0, // Placeholder, will be updated by caller if needed or used
        date: '', // Will be stamped by time.ts
        type,
        message,
        important: opts?.important ?? false,
        starId: opts?.starId,
        planetId: opts?.planetId,
    };
}

export function tickResearch(empire: Empire, dt: number, rng: RNG): GameEvent[] {
    const events: GameEvent[] = [];
    const { research, officers } = empire;

    // Base RP per lab
    const BASE_RP_PER_LAB = 20;
    const empireBonuses = getEmpireTechBonuses(research.completedTechs);

    // Filter to valid active projects
    const completedIndices: number[] = [];

    for (let i = 0; i < research.activeProjects.length; i++) {
        const project = research.activeProjects[i];
        const tech = TECH_BY_ID[project.techId];
        if (!tech) continue;

        const scientist = officers.find(o => o.id === project.scientistId);

        // 1. Calculate Researcher Effectiveness
        let bonus = 1.0;
        let capacity = 10; // Default if no scientist

        if (scientist) {
            const levelBonus = (scientist.level - 1) * 0.05;
            const specMultiplier = 0.10 + (empireBonuses['officer_specialization_bonus'] || 0);
            const specBonus = (scientist.specialization === tech.category) ? scientist.level * specMultiplier : 0;
            const traitBonus = (scientist.bonuses['research_rate'] || 0);

            bonus += levelBonus + specBonus + traitBonus;
            capacity = scientist.labCapacity + (empireBonuses['research_capacity'] || 0);
        }

        // Apply empire-wide research rate bonuses
        bonus += (empireBonuses['research_rate'] || 0);

        // 2. Lab Efficiency & Bottleneck logic
        // If labs > capacity, excess labs operate at 10% efficiency
        const assignedLabs = project.labs;
        const effectiveLabs = assignedLabs > capacity
            ? capacity + (assignedLabs - capacity) * 0.1
            : assignedLabs;

        const projectRate = (effectiveLabs * BASE_RP_PER_LAB) * bonus;
        project.investedPoints += projectRate * (dt / 86400);

        if (project.investedPoints >= tech.cost) {
            completedIndices.push(i);
        }
    }

    // Process completions (reverse order)
    for (let i = completedIndices.length - 1; i >= 0; i--) {
        const idx = completedIndices[i];
        const project = research.activeProjects[idx];
        const tech = TECH_BY_ID[project.techId];

        research.completedTechs.push(tech.id);
        events.push(makeEvent('ResearchComplete',
            `Research complete: ${tech.name}`, rng, { important: tech.tier >= 2 }));

        research.activeProjects.splice(idx, 1);
    }

    return events;
}
