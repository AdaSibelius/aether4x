'use client';
import { useState, useMemo } from 'react';
import { useGameStore } from '@/store/gameStore';
import { useUIStore } from '@/store/uiStore';
import { STRUCTURE_BP_COST, STRUCTURE_MINERAL_COST } from '@/engine/colonies';
export { STRUCTURE_BP_COST, STRUCTURE_MINERAL_COST };
import type { Colony, ColonyPolicy, ColonyType, LaborAllocation, Planet, ProductionItemType, Officer, Empire } from '@/types';
import { SurfaceTab, AtmosphereTab } from '@/components/SharedTabs/SharedTabs';
import { getGovernorBonuses } from '@/engine/officers';
import PortraitGenerator from '@/components/Officers/PortraitGenerator';
import { SPECIES } from '@/engine/species';
import { BALANCING } from '@/engine/constants';
import { canHostBuildings, isBodyHabitable } from '@/engine/galaxy';
import { RosterShell, SidebarSection, RosterGroup, RosterItem, MainArea } from '@/components/Roster/Roster';
import { calculateColonyBudget } from '@/engine/finances';
import styles from './ColonyManager.module.css';
import ShipyardTab from './ShipyardTab';
import InvestmentHistoryChart from './InvestmentHistoryChart';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip, Legend as RechartsLegend } from 'recharts';

// ─── Styles ──────────────────────────────────────────────────────────────────

const COLONY_TYPES: ColonyType[] = ['Core', 'Mining', 'Research', 'Military', 'Agricultural'];
const COLONY_TYPE_ICON: Record<ColonyType, string> = {
    Core: '🏛️', Mining: '⛏️', Research: '🔬', Military: '⚔️', Agricultural: '🌾',
};
const COLONY_TYPE_DESC: Record<ColonyType, string> = {
    Core: 'Balanced production',
    Mining: '+50% mineral yield',
    Research: '+50% research output',
    Military: '+20% build points',
    Agricultural: 'Increased population cap',
};

const BUILDABLE_STRUCTURES: { type: ProductionItemType; label: string; icon: string; desc: string }[] = [
    { type: 'Factory', label: 'Factory', icon: '🏭', desc: '+10 BP/day base output' },
    { type: 'Mine', label: 'Mine', icon: '⛏️', desc: '+1 mineral extraction site' },
    { type: 'ResearchLab', label: 'Research Lab', icon: '🔬', desc: '+5 RP/day per worker' },
    { type: 'Infrastructure', label: 'Infrastructure', icon: '🏗️', desc: '+5% infrastructure rating' },
    { type: 'GroundDefense', label: 'PDC Battery', icon: '🛡️', desc: 'Planetary defense cannon' },
    { type: 'Spaceport', label: 'Spaceport', icon: '🚀', desc: '+5 happiness, enables trade' },
    { type: 'AethericDistillery', label: 'Aetheric Distillery', icon: '⚗️', desc: 'Refines Raw Aether into Fuel' },
    { type: 'AethericSiphon', label: 'Aetheric Siphon', icon: '🌀', desc: 'Directly harvests Aether from planetary currents' },
    { type: 'DeepCoreExtractor', label: 'Deep Core Extractor', icon: '🌋', desc: 'Advanced extraction of deep-seated minerals' },
    { type: 'ReclamationPlant', label: 'Reclamation Plant', icon: '♻️', desc: '+5% global production via waste recycling' },
];

export const COLONY_TYPE_BONUSES: Record<ColonyType, Record<string, number>> = {
    Core: { industry: 1.0, mining: 1.0, research: 1.0 },
    Mining: { industry: 0.8, mining: 1.5, research: 0.8 },
    Research: { industry: 0.8, mining: 0.8, research: 1.5 },
    Military: { industry: 1.2, mining: 1.0, research: 0.7 },
    Agricultural: { industry: 0.9, mining: 0.9, research: 0.9 },
};

export function calcEffectiveRates(colony: Colony, officers: Officer[], planet?: Planet | null, empires?: Record<string, Empire>) {
    const infra = colony.infrastructure ?? 80;
    const infraEff = 0.5 + (infra / 100) * 0.5;
    const bonus = COLONY_TYPE_BONUSES[colony.colonyType ?? 'Core'] ?? COLONY_TYPE_BONUSES.Core;
    const pop = colony.population ?? 0;
    const empire = empires ? empires[colony.empireId] : null;

    // --- Labor Model ---
    const reqIndustry = (colony.factories ?? 0) * BALANCING.EMPLOYMENT.WORKER_REQUIREMENT_FACTORY +
        (colony.civilianFactories ?? 0) * BALANCING.EMPLOYMENT.WORKER_REQUIREMENT_CIV_FACTORY;
    const reqMining = (colony.mines ?? 0) * BALANCING.EMPLOYMENT.WORKER_REQUIREMENT_MINE +
        (colony.civilianMines ?? 0) * BALANCING.EMPLOYMENT.WORKER_REQUIREMENT_CIV_MINE;
    const reqResearch = (colony.researchLabs ?? 0) * BALANCING.EMPLOYMENT.WORKER_REQUIREMENT_RESEARCH_LAB;
    const reqConstruction = (colony.constructionOffices ?? 0) * BALANCING.EMPLOYMENT.WORKER_REQUIREMENT_CONSTRUCTION_OFFICE +
        ((colony.factories ?? 0) > 0 && colony.terraformProgress < 100 ? BALANCING.EMPLOYMENT.WORKER_REQUIREMENT_TERRAFORMER : 0) +
        (colony.aethericDistillery ?? 0) * BALANCING.EMPLOYMENT.WORKER_REQUIREMENT_DISTILLERY;
    const reqLogistics = (colony.shipyards?.length || 0) * BALANCING.EMPLOYMENT.WORKER_REQUIREMENT_SHIPYARD +
        (colony.spaceport ? BALANCING.EMPLOYMENT.WORKER_REQUIREMENT_SPACEPORT : 0) +
        (colony.groundDefenses ?? 0) * BALANCING.EMPLOYMENT.WORKER_REQUIREMENT_GROUND_DEFENSE;
    const reqCorpOffices = (empire?.companies?.length || 0) * BALANCING.EMPLOYMENT.OFFICE_WORKERS_PER_CORP;

    const reqAgri = (colony.farms ?? 0) * BALANCING.EMPLOYMENT.WORKER_REQUIREMENT_FARM;
    const reqServices = (colony.commercialCenters ?? 0) * BALANCING.EMPLOYMENT.WORKER_REQUIREMENT_COMMERCIAL_CENTER;

    const totalReq = reqIndustry + reqMining + reqResearch + reqConstruction + reqLogistics + reqCorpOffices + reqAgri + reqServices;

    const staffingLevel = totalReq > 0 ? Math.min(1.0, pop / totalReq) : 1.0;
    const constructionBP = (colony.constructionOffices ?? 0) * BALANCING.EMPLOYMENT.CONSTRUCTION_BP_PER_OFFICE * staffingLevel;

    const govBonuses = getGovernorBonuses(officers, colony.governorId);
    const prodBonus = 1 + (govBonuses.all_production ?? 0);
    const factoryBonus = 1 + (govBonuses.factory_output ?? 0);
    const mineBonus = 1 + (govBonuses.mining_rate ?? 0);
    const resBonus = 1 + (govBonuses.research_rate ?? 0);

    let mineralsPerDay = 0;
    if (planet && planet.minerals) {
        for (const mineral of planet.minerals) {
            let extraction = ((colony.mines ?? 0) + (colony.civilianMines ?? 0)) * BALANCING.MINING_RATE_BASE * mineral.accessibility * staffingLevel * bonus.mining * infraEff * mineBonus * prodBonus;
            extraction = Math.min(extraction, mineral.amount);
            if (extraction > 0) mineralsPerDay += extraction;
        }
    } else {
        mineralsPerDay = ((colony.mines ?? 0) + (colony.civilianMines ?? 0)) * BALANCING.MINING_RATE_BASE * staffingLevel * bonus.mining * infraEff * mineBonus * prodBonus;
    }

    return {
        bpPerDay: (colony.factories ?? 0) * BALANCING.BP_PER_FACTORY * staffingLevel * bonus.industry * infraEff * factoryBonus * prodBonus,
        mineralsPerDay,
        rpPerDay: (colony.researchLabs ?? 0) * BALANCING.RESEARCH_RATE_BASE * staffingLevel * bonus.research * infraEff * resBonus * prodBonus,
        constructionBP,
        staffingLevel,
        infraEff,
        govBonuses,
        mineralSpecific: (planet?.minerals ?? []).map(m => {
            const mineBonus = 1 + (govBonuses.mining_rate ?? 0);
            const rate = ((colony.mines ?? 0) + (colony.civilianMines ?? 0)) * BALANCING.MINING_RATE_BASE * m.accessibility * staffingLevel * (bonus.mining ?? 1) * infraEff * mineBonus * prodBonus;
            return { name: m.name, rate: rate, remaining: m.amount };
        }),
        budget: calculateColonyBudget(colony, 1), // Daily budget
        laborReport: {
            industry: reqIndustry,
            mining: reqMining,
            research: reqResearch,
            construction: reqConstruction,
            logistics: reqLogistics,
            office: reqCorpOffices,
            agri: reqAgri,
            services: reqServices,
            totalReq,
            unemployed: Math.max(0, pop - totalReq),
        }
    };
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function HappinessMeter({ value }: { value: number }) {
    const color = value > 70 ? 'var(--accent-green)' : value > 40 ? 'var(--accent-gold)' : 'var(--accent-red)';
    const label = value > 70 ? 'Content' : value > 40 ? 'Neutral' : 'Unrest';
    return (
        <div className={styles.meterRow}>
            <span className={styles.meterLabel}>Happiness</span>
            <div className={styles.meterTrack}>
                <div className={styles.meterFill} style={{ width: `${value}%`, background: color }} />
            </div>
            <span className={styles.meterVal} style={{ color }}>{value.toFixed(0)}% · {label}</span>
        </div>
    );
}

function InfraBar({ value }: { value: number }) {
    const color = value > 60 ? 'var(--accent-blue)' : value > 30 ? 'var(--accent-gold)' : 'var(--accent-red)';
    return (
        <div className={styles.meterRow}>
            <span className={styles.meterLabel}>Infrastructure</span>
            <div className={styles.meterTrack}>
                <div className={styles.meterFill} style={{ width: `${value}%`, background: color }} />
            </div>
            <span className={styles.meterVal} style={{ color }}>{value.toFixed(1)}%</span>
        </div>
    );
}

// ─── Tab 1: Overview ─────────────────────────────────────────────────────────

function OverviewTab({ colony, rates, planet, updateColony, governor }: {
    colony: Colony;
    rates: ReturnType<typeof calcEffectiveRates>;
    planet: Planet | null;
    updateColony: (patch: Partial<Colony>) => void;
    governor: Officer | null;
}) {
    const popPct = (colony.population / (colony.maxPopulation ?? 15000)) * 100;

    return (
        <div className={styles.tabContent}>
            {/* Planet banner */}
            <div className={styles.planetBanner}>
                <div className={styles.planetIcon}>🪐</div>
                <div>
                    <div className={styles.planetName}>{colony.name}</div>
                    <div className={styles.planetMeta}>
                        {planet ? `${planet.subtype} ${planet.type} · ${planet.atmosphere} atmosphere` : 'Unknown planet type'}
                    </div>
                </div>
                <div className={styles.colonyBadge}>{COLONY_TYPE_ICON[colony.colonyType]} {colony.colonyType}</div>
            </div>

            {planet && !canHostBuildings(planet) && (
                <div className="alert alert-warning" style={{ margin: '0 20px 20px 20px', display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span>⚠️</span>
                    <div>
                        <strong>Hostile Environment:</strong> Surface building is restricted on {planet.subtype}s.
                        Only orbital stations or atmospheric siphons can be operated here.
                    </div>
                </div>
            )}

            <div className={styles.overviewGrid}>
                {/* Population panel */}
                <div className={styles.panel}>
                    <div className="panel-header"><h3>Population</h3></div>
                    <div className="panel-body">
                        <div className={styles.meterRow} style={{ marginBottom: 6 }}>
                            <span className={styles.meterLabel}>People</span>
                            <div className={styles.meterTrack}>
                                <div className={styles.meterFill} style={{ width: `${Math.min(100, popPct)}%`, background: popPct > 90 ? 'var(--accent-red)' : 'var(--accent-green)' }} />
                            </div>
                            <span className={styles.meterVal}>{colony.population.toFixed(1)}M / {(colony.maxPopulation ?? 15000).toFixed(0)}M</span>
                        </div>
                        <div className="stat-row">
                            <span className="stat-label">Growth Rate</span>
                            <span className="stat-value good">+{(colony.populationGrowthRate * 100).toFixed(1)}%/yr</span>
                        </div>
                        <div className="stat-row">
                            <span className="stat-label">Spaceport</span>
                            <span className={`stat-value ${colony.spaceport ? 'good' : ''}`}>{colony.spaceport ? '✓ Active' : '✗ None'}</span>
                        </div>
                        <div className="stat-row">
                            <span className="stat-label">PDC Batteries</span>
                            <span className="stat-value">{colony.groundDefenses ?? 0}</span>
                        </div>
                    </div>
                </div>

                {/* Morale panel */}
                <div className={styles.panel}>
                    <div className="panel-header"><h3>Welfare</h3></div>
                    <div className="panel-body">
                        <HappinessMeter value={colony.happiness ?? 70} />
                        <InfraBar value={colony.infrastructure ?? 80} />
                        <div style={{ marginTop: 8, fontSize: 11, color: 'var(--text-muted)' }}>
                            {(colony.infrastructure ?? 80) < 40
                                ? '⚠️ Low infrastructure — assign construction workers to repair.'
                                : (colony.minerals.Food || 0) < (colony.population * BALANCING.FOOD_CONSUMPTION_RATE)
                                    ? '⚠️ Starvation Imminent — build farms or import food.'
                                    : colony.happiness < 40
                                        ? '⚠️ Low morale — build a spaceport or reduce overcrowding.'
                                        : '✓ Colony operating normally.'}
                        </div>
                    </div>
                </div>

                {/* Daily output panel */}
                <div className={styles.panel}>
                    <div className="panel-header"><h3>Daily Output</h3></div>
                    <div className="panel-body">
                        <div className="stat-row">
                            <span className="stat-label">Build Points</span>
                            <span className="stat-value good">{rates.bpPerDay.toFixed(0)} BP/day</span>
                        </div>
                        <div className="stat-row">
                            <span className="stat-label">Minerals</span>
                            <span className="stat-value">{rates.mineralsPerDay.toFixed(1)} t/day</span>
                        </div>
                        <div className="stat-row">
                            <span className="stat-label">Research</span>
                            <span className="stat-value">{rates.rpPerDay.toFixed(0)} RP/day</span>
                        </div>
                        <div className="stat-row">
                            <span className="stat-label">Infra Efficiency</span>
                            <span className="stat-value">{(rates.infraEff * 100).toFixed(0)}%</span>
                        </div>
                        <div className="stat-row">
                            <span className="stat-label">Labor Efficiency</span>
                            <span className="stat-value" style={{ color: rates.staffingLevel < 0.9 ? 'var(--accent-gold)' : 'var(--accent-green)' }}>{(rates.staffingLevel * 100).toFixed(0)}%</span>
                        </div>
                    </div>
                </div>

                {/* Governor Panel */}
                <div className={styles.panel}>
                    <div className="panel-header"><h3>🏛️ Governor</h3></div>
                    <div className="panel-body">
                        {!governor ? (
                            <div style={{ color: 'var(--text-muted)', fontSize: 12, padding: '10px 0', textAlign: 'center' }}>
                                No governor assigned. Assign one in the Officers tab to boost production.
                            </div>
                        ) : (
                            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                                <PortraitGenerator seed={governor.portraitSeed} role={governor.role} size={48} />
                                <div>
                                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{governor.name}</div>
                                    <div style={{ fontSize: 10, color: '#60a5fa', marginBottom: 4 }}>Level {governor.level} Governor</div>
                                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                                        {Object.entries(governor.bonuses).map(([key, val]) => (
                                            <div key={key} style={{ fontSize: 9, padding: '2px 6px', background: 'rgba(74, 222, 128, 0.1)', color: 'var(--accent-green)', borderRadius: 4 }}>
                                                +{Math.round(val * 100)}% {key.replace('_', ' ')}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Mineral stockpile panel */}
                <div className={styles.panel}>
                    <div className="panel-header"><h3>⛏️ Mineral Stockpile</h3></div>
                    <div className="panel-body">
                        {(() => {
                            const minerals = colony.minerals ?? {};
                            return BALANCING.MINERAL_NAMES
                                .map(m => (
                                    <div className="stat-row" key={m} style={{ gap: 4 }}>
                                        <span className="stat-label" style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 2 }}>
                                            <img src={`/minerals/${m.toLowerCase()}.png`} alt={m} width={20} height={20} style={{ imageRendering: 'pixelated' as const, borderRadius: 2 }} />
                                            {m}
                                        </span>
                                        <span className="stat-value" style={{ flex: 1, textAlign: 'right' }}>{Math.floor(minerals[m] ?? 0).toLocaleString()}</span>
                                        {(() => {
                                            const spec = rates.mineralSpecific.find(ms => ms.name === m);
                                            if (spec && spec.rate > 0) {
                                                const years = spec.remaining / (spec.rate * 365);
                                                return (
                                                    <span style={{ fontSize: 9, color: years < 5 ? 'var(--accent-red)' : 'var(--text-muted)', flex: 1, textAlign: 'right' }}>
                                                        {years < 100 ? `${years.toFixed(1)}y` : '>100y'}
                                                    </span>
                                                );
                                            }
                                            return <span style={{ flex: 1 }} />;
                                        })()}
                                    </div>
                                ));
                        })()}
                    </div>
                </div>

                {/* Economy & Trade panel */}
                <div className={styles.panel}>
                    <div className="panel-header"><h3>⚖️ Economy & Trade</h3></div>
                    <div className="panel-body">
                        <div className="stat-row">
                            <span className="stat-label">Civilian Wealth</span>
                            <span className="stat-value good">{(colony.privateWealth ?? 0).toLocaleString(undefined, { maximumFractionDigits: 0 })} W</span>
                        </div>
                        {(colony.civilianFactories ?? 0) > 0 && (
                            <div className="stat-row">
                                <span className="stat-label">Civilian Factories</span>
                                <span className="stat-value">{colony.civilianFactories}</span>
                            </div>
                        )}
                        {(colony.civilianMines ?? 0) > 0 && (
                            <div className="stat-row">
                                <span className="stat-label">Civilian Mines</span>
                                <span className="stat-value">{colony.civilianMines}</span>
                            </div>
                        )}
                        {colony.demand && Object.values(colony.demand).some(amt => amt > 0) ? (
                            <div style={{ marginTop: 8 }}>
                                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--accent-red)', marginBottom: 4 }}>Current Deficits</div>
                                {Object.entries(colony.demand).filter(([, amt]) => amt > 0).map(([req, amt]) => (
                                    <div className="stat-row" key={req}>
                                        <span className="stat-label" style={{ fontSize: 11 }}>{req}</span>
                                        <span className="stat-value bad">-{Math.ceil(amt)}</span>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 8, fontStyle: 'italic' }}>No local deficits.</div>
                        )}
                        <hr style={{ border: 'none', borderTop: '1px solid var(--border-color)', margin: '8px 0' }} />
                        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 8 }}>DAILY BUDGET</div>
                        <div className="stat-row">
                            <span className="stat-label">Tax Revenue</span>
                            <span className="stat-value good">+{rates.budget.taxes.toFixed(1)} W</span>
                        </div>
                        <div className="stat-row">
                            <span className="stat-label">Maintenance</span>
                            <span className="stat-value bad">-{rates.budget.maintenance.total.toFixed(1)} W</span>
                        </div>
                        <div style={{ padding: '4px 8px', background: 'rgba(0,0,0,0.2)', borderRadius: 4, marginTop: 4 }}>
                            {Object.entries(rates.budget.maintenance).map(([key, val]) => {
                                if (key === 'total' || val === 0) return null;
                                return (
                                    <div key={key} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: 'var(--text-muted)' }}>
                                        <span style={{ textTransform: 'capitalize' }}>{key}</span>
                                        <span>-{val.toFixed(2)}</span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>

            </div>

            {/* Row 2: Type and Policy */}
            <div className={styles.topGrid}>
                {/* Colony Policy selector */}
                <div className={styles.panel}>
                    <div className="panel-header"><h3>📜 Colony Policy</h3></div>
                    <div className="panel-body">
                        <select
                            className="input-field"
                            value={colony.policy ?? 'Normal'}
                            onChange={e => updateColony({ policy: e.target.value as ColonyPolicy })}
                            style={{ width: '100%', marginBottom: 8 }}
                        >
                            <option value="Normal">Normal (+0% Growth, +0 Happiness)</option>
                            <option value="Encourage Growth">Encourage Growth (+50% Growth, -10 Happiness)</option>
                            <option value="Population Control">Population Control (0% Growth, +15 Happiness)</option>
                            <option value="Forced Labor">Forced Labor (-20% Growth, -30 Happiness, +Boost Output)</option>
                        </select>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                            Policies dictate the primary focus of this colony's administration, trading happiness for population growth or raw industrial output.
                        </div>
                    </div>
                </div>

                {/* Migration Mode selector */}
                <div className={styles.panel}>
                    <div className="panel-header"><h3>🚀 Migration Controls</h3></div>
                    <div className="panel-body">
                        <div className={styles.migrationGrid}>
                            {(['Source', 'Stable', 'Target'] as const).map(mode => (
                                <button
                                    key={mode}
                                    className={`${styles.migrationBtn} ${colony.migrationMode === mode ? styles.migrationBtnActive : ''}`}
                                    onClick={() => updateColony({ migrationMode: mode })}
                                >
                                    <span className={styles.migrationIcon}>{mode === 'Source' ? '📤' : mode === 'Target' ? '📥' : '🛑'}</span>
                                    <span className={styles.migrationName}>{mode}</span>
                                </button>
                            ))}
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 8 }}>
                            {colony.migrationMode === 'Source' && '📤 Residents are encouraged to leave. Transport companies will prioritize outbound passenger ships.'}
                            {colony.migrationMode === 'Target' && '📥 This colony is welcoming new settlers. Transport companies will prioritize inbound passenger ships.'}
                            {colony.migrationMode === 'Stable' && '🛑 Migration is restricted to natural growth. Transport companies will ignore this colony for migration routes.'}
                        </div>
                    </div>
                </div>

                {/* Colony type selector */}
                <div className={styles.panel}>
                    <div className="panel-header"><h3>Colony Specialization</h3></div>
                    <div className="panel-body">
                        <div className={styles.typeGrid}>
                            {COLONY_TYPES.map(ct => (
                                <button
                                    key={ct}
                                    className={`${styles.typeBtn} ${(colony.colonyType ?? 'Core') === ct ? styles.typeBtnActive : ''}`}
                                    onClick={() => updateColony({ colonyType: ct })}
                                    title={COLONY_TYPE_DESC[ct]}
                                >
                                    <span className={styles.typeIcon}>{COLONY_TYPE_ICON[ct]}</span>
                                    <span className={styles.typeName}>{ct}</span>
                                    <span className={styles.typeDesc}>{COLONY_TYPE_DESC[ct]}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

// ─── Labor Report ─────────────────────────────────────────────────────────────

function LaborReport({ report, staffing, population }: {
    report: ReturnType<typeof calcEffectiveRates>['laborReport'];
    staffing: number;
    population: number;
}) {
    if (!report) return null;

    const staffingColor = staffing >= 1.0 ? 'var(--accent-green)' : staffing > 0.7 ? 'var(--accent-gold)' : 'var(--accent-red)';

    const sectors = [
        { name: 'Industry', value: report.industry || 0, color: '#4a90e2' },
        { name: 'Mining', value: report.mining || 0, color: '#f5a623' },
        { name: 'Research', value: report.research || 0, color: '#bd10e0' },
        { name: 'Construction', value: report.construction || 0, color: '#50e3c2' },
        { name: 'Logistics', value: report.logistics || 0, color: '#ff7eb3' },
        { name: 'Corporate', value: report.office || 0, color: '#aa1111' },
        { name: 'Agriculture', value: report.agri || 0, color: '#7ed321' },
        { name: 'Services', value: report.services || 0, color: '#f8e71c' },
        { name: 'Reserve', value: report.unemployed || 0, color: '#9b9b9b' },
    ].filter(s => s.value > 0);

    const CustomTooltip = ({ active, payload }: { active?: boolean; payload?: any[] }) => {
        if (active && payload && payload.length) {
            return (
                <div style={{
                    backgroundColor: 'var(--bg-panel)',
                    border: '1px solid var(--border-color)',
                    padding: '8px',
                    fontSize: '11px',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
                    borderRadius: '4px'
                }}>
                    <div style={{ color: payload[0].payload.color, fontWeight: 600, marginBottom: 2 }}>
                        {payload[0].name}
                    </div>
                    <div style={{ color: 'var(--text-primary)' }}>
                        {payload[0].value.toFixed(1)}M workers
                    </div>
                    <div style={{ color: 'var(--text-muted)', fontSize: '10px' }}>
                        {((payload[0].value / (report.totalReq + report.unemployed)) * 100).toFixed(1)}% of population
                    </div>
                </div>
            );
        }
        return null;
    };

    return (
        <div className={styles.sliderGroup}>
            <div style={{ display: 'flex', gap: 20, alignItems: 'center', marginBottom: 20 }}>
                <div style={{ width: 140, height: 140, flexShrink: 0 }}>
                    <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                            <Pie
                                data={sectors}
                                cx="50%"
                                cy="50%"
                                innerRadius={35}
                                outerRadius={55}
                                paddingAngle={2}
                                dataKey="value"
                                stroke="none"
                            >
                                {sectors.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={entry.color} />
                                ))}
                            </Pie>
                            <RechartsTooltip content={<CustomTooltip />} />
                        </PieChart>
                    </ResponsiveContainer>
                </div>
                <div style={{ flex: 1 }}>
                    <div className={styles.staffingHeader}>
                        <span className={styles.staffingLabel}>Global Staffing</span>
                        <span className={styles.staffingVal} style={{ color: staffingColor }}>{(staffing * 100).toFixed(0)}%</span>
                    </div>
                    <div className="progress-bar" style={{ height: 6, marginTop: 4 }}>
                        <div className="progress-fill" style={{ width: `${staffing * 100}%`, background: staffingColor }} />
                    </div>
                    <div style={{ marginTop: 12, fontSize: '11px', color: 'var(--text-muted)' }}>
                        {report.unemployed > 0
                            ? `${report.unemployed.toFixed(1)}M citizens available for new facilities.`
                            : `Personnel shortage of ${Math.abs(population - report.totalReq).toFixed(1)}M affecting output.`}
                    </div>
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 12px' }}>
                {sectors.map((s, i) => (
                    <div key={i} className={styles.laborRow} style={{ margin: 0, padding: '2px 0' }}>
                        <span className={styles.laborLabel} style={{ fontSize: '0.85em', display: 'flex', alignItems: 'center' }}>
                            <span style={{
                                display: 'inline-block',
                                width: 8,
                                height: 8,
                                borderRadius: '50%',
                                backgroundColor: s.color,
                                marginRight: 6
                            }} />
                            {s.name}
                        </span>
                        <span className={styles.laborVal} style={{ fontSize: '0.85em' }}>{s.value.toFixed(1)}M</span>
                    </div>
                ))}
            </div>
            <hr style={{ border: 'none', borderTop: '1px solid var(--border-color)', margin: '12px 0' }} />
            <div className={styles.laborRow} style={{ color: report.unemployed > 0 ? 'var(--accent-green)' : 'var(--accent-red)' }}>
                <span className={styles.laborLabel} style={{ fontWeight: 600 }}>
                    {report.unemployed > 0 ? '👷 Labor Reserve' : '⚠️ Labor Deficit'}
                </span>
                <span className={styles.laborVal} style={{ fontWeight: 600 }}>
                    {report.unemployed > 0
                        ? report.unemployed.toFixed(1)
                        : Math.abs(population - report.totalReq).toFixed(1)}M
                </span>
            </div>
        </div>
    );
}

// ─── Tab 2: Industry ─────────────────────────────────────────────────────────

function IndustryTab({ colony, rates, planet, updateColony, empire }: {
    colony: Colony;
    rates: ReturnType<typeof calcEffectiveRates>;
    planet: Planet | null;
    updateColony: (patch: Partial<Colony>) => void;
    empire: Empire;
}) {
    const [addQty, setAddQty] = useState(1);

    const addToQueue = (type: ProductionItemType, qty?: number) => {
        const existing = BUILDABLE_STRUCTURES.find(b => b.type === type)!;
        const bpCost = STRUCTURE_BP_COST[type] ?? 1000;
        const mineralCost = STRUCTURE_MINERAL_COST[type] ?? {};
        const newItem = {
            id: `item_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
            type,
            name: existing.label,
            quantity: qty || addQty,
            progress: 0,
            costPerUnit: mineralCost,
            bpCostPerUnit: bpCost,
        };
        updateColony({ productionQueue: [...colony.productionQueue, newItem] });
    };

    const removeItem = (id: string) => {
        updateColony({ productionQueue: colony.productionQueue.filter(i => i.id !== id) });
    };

    const getEta = (item: typeof colony.productionQueue[0]) => {
        const totalBp = item.bpCostPerUnit * item.quantity;
        const remaining = totalBp * (1 - item.progress / 100);
        if (rates.bpPerDay <= 0) return '∞';
        const days = remaining / rates.bpPerDay;
        if (days < 30) return `~${Math.ceil(days)}d`;
        if (days < 365) return `~${Math.ceil(days / 30)}mo`;
        return `~${(days / 365).toFixed(1)}yr`;
    };

    const buildAction = (type: ProductionItemType) => {
        const isAllowed = planet ? canHostBuildings(planet) : true;
        const isDistillery = type === 'AethericDistillery';
        if (!isAllowed && !isDistillery) return null;

        return (
            <div className={styles.ledgerBuildActions}>
                <button className={styles.tinyBuildBtn} onClick={() => addToQueue(type, 1)}>+1</button>
                <button className={styles.tinyBuildBtn} onClick={() => addToQueue(type, 5)}>+5</button>
                <button className={styles.tinyBuildBtn} onClick={() => addToQueue(type, 10)}>+10</button>
            </div>
        );
    };

    return (
        <div className={styles.tabContent}>
            <div className={styles.fullWidthLayout}>
                {/* Employment Overview */}
                <div className={styles.panel} style={{ marginBottom: 20 }}>
                    <div className="panel-header"><h3>Employment Report</h3></div>
                    <div className="panel-body">
                        <LaborReport
                            report={rates.laborReport}
                            staffing={rates.staffingLevel}
                            population={colony.population}
                        />
                    </div>
                </div>

                {/* Industrial Ledger */}
                <div className="panel" style={{ marginBottom: 20 }}>
                    <div className="panel-header"><h3>Industrial Ledger</h3></div>
                    <div className="panel-body" style={{ padding: 0 }}>
                        <table className={styles.ledgerTable}>
                            <thead>
                                <tr>
                                    <th>Facility</th>
                                    <th style={{ textAlign: 'right' }}>Count</th>
                                    <th style={{ textAlign: 'right' }}>Labor Req</th>
                                    <th style={{ textAlign: 'center' }}>Staffing</th>
                                    <th style={{ textAlign: 'right' }}>Daily Output</th>
                                    <th style={{ textAlign: 'center' }}>Build Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr className={styles.ledgerCategory}>
                                    <td colSpan={6}>Primary Production</td>
                                </tr>
                                <tr>
                                    <td>
                                        <div className={styles.ledgerLabel}><span className={styles.ledgerIcon}>🏭</span><span className={styles.ledgerName}>Factories</span></div>
                                    </td>
                                    <td className={styles.ledgerValue} style={{ textAlign: 'right' }}>{colony.factories}</td>
                                    <td className={styles.ledgerValue} style={{ textAlign: 'right' }}>{(colony.factories * BALANCING.EMPLOYMENT.WORKER_REQUIREMENT_FACTORY).toFixed(1)}M</td>
                                    <td>
                                        <div className={styles.ledgerStaffing}>
                                            <div className={styles.meterTrack} style={{ margin: 0 }}><div className={styles.meterFill} style={{ width: `${rates.staffingLevel * 100}%`, background: 'var(--accent-blue)' }} /></div>
                                            <span className={styles.staffingText}>{(rates.staffingLevel * 100).toFixed(0)}%</span>
                                        </div>
                                    </td>
                                    <td className={styles.ledgerValue} style={{ textAlign: 'right', color: 'var(--accent-blue)' }}>{rates.bpPerDay.toFixed(1)} BP</td>
                                    <td>{buildAction('Factory')}</td>
                                </tr>
                                <tr>
                                    <td>
                                        <div className={styles.ledgerLabel}><span className={styles.ledgerIcon}>⛏️</span><span className={styles.ledgerName}>Mines</span></div>
                                    </td>
                                    <td className={styles.ledgerValue} style={{ textAlign: 'right' }}>{colony.mines + (colony.civilianMines || 0)}</td>
                                    <td className={styles.ledgerValue} style={{ textAlign: 'right' }}>{((colony.mines + (colony.civilianMines || 0)) * BALANCING.EMPLOYMENT.WORKER_REQUIREMENT_MINE).toFixed(1)}M</td>
                                    <td>
                                        <div className={styles.ledgerStaffing}>
                                            <div className={styles.meterTrack} style={{ margin: 0 }}><div className={styles.meterFill} style={{ width: `${rates.staffingLevel * 100}%`, background: 'var(--accent-green)' }} /></div>
                                            <span className={styles.staffingText}>{(rates.staffingLevel * 100).toFixed(0)}%</span>
                                        </div>
                                    </td>
                                    <td className={styles.ledgerValue} style={{ textAlign: 'right', color: 'var(--accent-green)' }}>{rates.mineralsPerDay.toFixed(1)}t</td>
                                    <td>{buildAction('Mine')}</td>
                                </tr>
                                <tr>
                                    <td>
                                        <div className={styles.ledgerLabel}><span className={styles.ledgerIcon}>🔬</span><span className={styles.ledgerName}>Research Labs</span></div>
                                    </td>
                                    <td className={styles.ledgerValue} style={{ textAlign: 'right' }}>{colony.researchLabs}</td>
                                    <td className={styles.ledgerValue} style={{ textAlign: 'right' }}>{(colony.researchLabs * BALANCING.EMPLOYMENT.WORKER_REQUIREMENT_RESEARCH_LAB).toFixed(1)}M</td>
                                    <td>
                                        <div className={styles.ledgerStaffing}>
                                            <div className={styles.meterTrack} style={{ margin: 0 }}><div className={styles.meterFill} style={{ width: `${rates.staffingLevel * 100}%`, background: 'var(--accent-purple, #a855f7)' }} /></div>
                                            <span className={styles.staffingText}>{(rates.staffingLevel * 100).toFixed(0)}%</span>
                                        </div>
                                    </td>
                                    <td className={styles.ledgerValue} style={{ textAlign: 'right', color: 'var(--accent-purple, #a855f7)' }}>{rates.rpPerDay.toFixed(0)} RP</td>
                                    <td>{buildAction('ResearchLab')}</td>
                                </tr>

                                <tr className={styles.ledgerCategory}>
                                    <td colSpan={6}>Orbital Infrastructure</td>
                                </tr>
                                <tr>
                                    <td>
                                        <div className={styles.ledgerLabel}><span className={styles.ledgerIcon}>🚀</span><span className={styles.ledgerName}>Spaceport</span></div>
                                    </td>
                                    <td className={styles.ledgerValue} style={{ textAlign: 'right' }}>{colony.spaceport ?? 0}</td>
                                    <td className={styles.ledgerValue} style={{ textAlign: 'right' }}>{((colony.spaceport ?? 0) * BALANCING.EMPLOYMENT.WORKER_REQUIREMENT_SPACEPORT).toFixed(1)}M</td>
                                    <td>
                                        <div className={styles.ledgerStaffing}>
                                            <div className={styles.meterTrack} style={{ margin: 0 }}><div className={styles.meterFill} style={{ width: `${rates.staffingLevel * 100}%`, background: 'var(--accent-blue)' }} /></div>
                                            <span className={styles.staffingText}>{(rates.staffingLevel * 100).toFixed(0)}%</span>
                                        </div>
                                    </td>
                                    <td className={styles.ledgerValue} style={{ textAlign: 'right' }}>{colony.spaceport > 0 ? "Operational" : "Offline"}</td>
                                    <td>{buildAction('Spaceport')}</td>
                                </tr>

                                <tr className={styles.ledgerCategory}>
                                    <td colSpan={6}>Planetary Logistics & Defense</td>
                                </tr>
                                <tr>
                                    <td>
                                        <div className={styles.ledgerLabel}><span className={styles.ledgerIcon}>🏢</span><span className={styles.ledgerName}>Construction Offices</span></div>
                                    </td>
                                    <td className={styles.ledgerValue} style={{ textAlign: 'right' }}>{colony.constructionOffices ?? 0}</td>
                                    <td className={styles.ledgerValue} style={{ textAlign: 'right' }}>{((colony.constructionOffices ?? 0) * BALANCING.EMPLOYMENT.WORKER_REQUIREMENT_CONSTRUCTION_OFFICE).toFixed(1)}M</td>
                                    <td>
                                        <div className={styles.ledgerStaffing}>
                                            <div className={styles.meterTrack} style={{ margin: 0 }}><div className={styles.meterFill} style={{ width: `${rates.staffingLevel * 100}%`, background: 'var(--accent-gold)' }} /></div>
                                            <span className={styles.staffingText}>{(rates.staffingLevel * 100).toFixed(0)}%</span>
                                        </div>
                                    </td>
                                    <td className={styles.ledgerValue} style={{ textAlign: 'right', color: 'var(--accent-gold)' }}>{rates.constructionBP.toFixed(0)} BP</td>
                                    <td>{buildAction('ConstructionOffice')}</td>
                                </tr>
                                <tr>
                                    <td>
                                        <div className={styles.ledgerLabel}><span className={styles.ledgerIcon}>🛡️</span><span className={styles.ledgerName}>Planetary Defense</span></div>
                                    </td>
                                    <td className={styles.ledgerValue} style={{ textAlign: 'right' }}>{colony.groundDefenses ?? 0}</td>
                                    <td className={styles.ledgerValue} style={{ textAlign: 'right' }}>{((colony.groundDefenses ?? 0) * BALANCING.EMPLOYMENT.WORKER_REQUIREMENT_GROUND_DEFENSE).toFixed(1)}M</td>
                                    <td>
                                        <div className={styles.ledgerStaffing}>
                                            <div className={styles.meterTrack} style={{ margin: 0 }}><div className={styles.meterFill} style={{ width: `${rates.staffingLevel * 100}%`, background: 'var(--accent-red)' }} /></div>
                                            <span className={styles.staffingText}>{(rates.staffingLevel * 100).toFixed(0)}%</span>
                                        </div>
                                    </td>
                                    <td className={styles.ledgerValue} style={{ textAlign: 'right' }}>Ready</td>
                                    <td>{buildAction('GroundDefense')}</td>
                                </tr>
                                {colony.aethericDistillery > 0 && (
                                    <tr>
                                        <td>
                                            <div className={styles.ledgerLabel}><span className={styles.ledgerIcon}>⚗️</span><span className={styles.ledgerName}>Aetheric Distillery</span></div>
                                        </td>
                                        <td className={styles.ledgerValue} style={{ textAlign: 'right' }}>{colony.aethericDistillery}</td>
                                        <td className={styles.ledgerValue} style={{ textAlign: 'right' }}>{(colony.aethericDistillery * BALANCING.EMPLOYMENT.WORKER_REQUIREMENT_DISTILLERY).toFixed(1)}M</td>
                                        <td>
                                            <div className={styles.ledgerStaffing}>
                                                <div className={styles.meterTrack} style={{ margin: 0 }}><div className={styles.meterFill} style={{ width: `${rates.staffingLevel * 100}%`, background: '#50e3c2' }} /></div>
                                                <span className={styles.staffingText}>{(rates.staffingLevel * 100).toFixed(0)}%</span>
                                            </div>
                                        </td>
                                        <td className={styles.ledgerValue} style={{ textAlign: 'right', color: '#50e3c2' }}>Active</td>
                                        <td>{buildAction('AethericDistillery')}</td>
                                    </tr>
                                )}
                                <tr className={styles.ledgerCategory}>
                                    <td colSpan={6}>Civilian & Economic Infrastructure</td>
                                </tr>
                                <tr>
                                    <td>
                                        <div className={styles.ledgerLabel}><span className={styles.ledgerIcon}>🚜</span><span className={styles.ledgerName}>Agricultural Farms</span></div>
                                    </td>
                                    <td className={styles.ledgerValue} style={{ textAlign: 'right' }}>{colony.farms ?? 0}</td>
                                    <td className={styles.ledgerValue} style={{ textAlign: 'right' }}>{((colony.farms ?? 0) * BALANCING.EMPLOYMENT.WORKER_REQUIREMENT_FARM).toFixed(1)}M</td>
                                    <td>
                                        <div className={styles.ledgerStaffing}>
                                            <div className={styles.meterTrack} style={{ margin: 0 }}><div className={styles.meterFill} style={{ width: `${rates.staffingLevel * 100}%`, background: 'var(--accent-green)' }} /></div>
                                            <span className={styles.staffingText}>{(rates.staffingLevel * 100).toFixed(0)}%</span>
                                        </div>
                                    </td>
                                    <td className={styles.ledgerValue} style={{ textAlign: 'right', color: 'var(--accent-green)' }}>{(colony.farms * BALANCING.FARM_YIELD_BASE * rates.staffingLevel).toFixed(0)} Food/day</td>
                                    <td>{buildAction('Farm')}</td>
                                </tr>
                                <tr>
                                    <td>
                                        <div className={styles.ledgerLabel}><span className={styles.ledgerIcon}>🏢</span><span className={styles.ledgerName}>Commercial Centers</span></div>
                                    </td>
                                    <td className={styles.ledgerValue} style={{ textAlign: 'right' }}>{colony.commercialCenters ?? 0}</td>
                                    <td className={styles.ledgerValue} style={{ textAlign: 'right' }}>{((colony.commercialCenters ?? 0) * BALANCING.EMPLOYMENT.WORKER_REQUIREMENT_COMMERCIAL_CENTER).toFixed(1)}M</td>
                                    <td>
                                        <div className={styles.ledgerStaffing}>
                                            <div className={styles.meterTrack} style={{ margin: 0 }}><div className={styles.meterFill} style={{ width: `${rates.staffingLevel * 100}%`, background: 'var(--accent-gold)' }} /></div>
                                            <span className={styles.staffingText}>{(rates.staffingLevel * 100).toFixed(0)}%</span>
                                        </div>
                                    </td>
                                    <td className={styles.ledgerValue} style={{ textAlign: 'right', color: 'var(--accent-gold)' }}>Active</td>
                                    <td>{buildAction('CommercialCenter')}</td>
                                </tr>
                                <tr>
                                    <td>
                                        <div className={styles.ledgerLabel}><span className={styles.ledgerIcon}>📦</span><span className={styles.ledgerName}>Logistics Hubs</span></div>
                                    </td>
                                    <td className={styles.ledgerValue} style={{ textAlign: 'right' }}>{colony.logisticsHubs ?? 0}</td>
                                    <td className={styles.ledgerValue} style={{ textAlign: 'right' }}>{((colony.logisticsHubs ?? 0) * BALANCING.EMPLOYMENT.WORKER_REQUIREMENT_LOGISTICS_HUB).toFixed(1)}M</td>
                                    <td>
                                        <div className={styles.ledgerStaffing}>
                                            <div className={styles.meterTrack} style={{ margin: 0 }}><div className={styles.meterFill} style={{ width: `${rates.staffingLevel * 100}%`, background: 'var(--accent-blue)' }} /></div>
                                            <span className={styles.staffingText}>{(rates.staffingLevel * 100).toFixed(0)}%</span>
                                        </div>
                                    </td>
                                    <td className={styles.ledgerValue} style={{ textAlign: 'right', color: 'var(--accent-blue)' }}>+{(colony.logisticsHubs * 2).toFixed(0)}% Efficiency</td>
                                    <td>{buildAction('LogisticsHub')}</td>
                                </tr>

                                {(() => {
                                    const completedTechs = empire.research?.completedTechs || [];
                                    const specialtyRows = [];

                                    if (completedTechs.includes('aetheric_siphon_theory')) {
                                        specialtyRows.push(
                                            <tr key="siphon">
                                                <td>
                                                    <div className={styles.ledgerLabel}><span className={styles.ledgerIcon}>🌀</span><span className={styles.ledgerName}>Aetheric Siphons</span></div>
                                                </td>
                                                <td className={styles.ledgerValue} style={{ textAlign: 'right' }}>{colony.aethericSiphons ?? 0}</td>
                                                <td className={styles.ledgerValue} style={{ textAlign: 'right' }}>{((colony.aethericSiphons ?? 0) * (BALANCING.EMPLOYMENT.WORKER_REQUIREMENT_SIPHON || 5)).toFixed(1)}M</td>
                                                <td>
                                                    <div className={styles.ledgerStaffing}>
                                                        <div className={styles.meterTrack} style={{ margin: 0 }}><div className={styles.meterFill} style={{ width: `${rates.staffingLevel * 100}%`, background: 'var(--accent-cyan, #06b6d4)' }} /></div>
                                                        <span className={styles.staffingText}>{(rates.staffingLevel * 100).toFixed(0)}%</span>
                                                    </div>
                                                </td>
                                                <td className={styles.ledgerValue} style={{ textAlign: 'right', color: 'var(--accent-cyan, #06b6d4)' }}>{((colony.aethericSiphons ?? 0) * 50 * rates.staffingLevel).toFixed(0)} Aether/day</td>
                                                <td>{buildAction('AethericSiphon')}</td>
                                            </tr>
                                        );
                                    }

                                    if (completedTechs.includes('deep_core_mining')) {
                                        specialtyRows.push(
                                            <tr key="extractor">
                                                <td>
                                                    <div className={styles.ledgerLabel}><span className={styles.ledgerIcon}>🌋</span><span className={styles.ledgerName}>Deep Core Extractors</span></div>
                                                </td>
                                                <td className={styles.ledgerValue} style={{ textAlign: 'right' }}>{colony.deepCoreExtractors ?? 0}</td>
                                                <td className={styles.ledgerValue} style={{ textAlign: 'right' }}>{((colony.deepCoreExtractors ?? 0) * (BALANCING.EMPLOYMENT.WORKER_REQUIREMENT_EXTRACTOR || 8)).toFixed(1)}M</td>
                                                <td>
                                                    <div className={styles.ledgerStaffing}>
                                                        <div className={styles.meterTrack} style={{ margin: 0 }}><div className={styles.meterFill} style={{ width: `${rates.staffingLevel * 100}%`, background: 'var(--accent-orange, #f97316)' }} /></div>
                                                        <span className={styles.staffingText}>{(rates.staffingLevel * 100).toFixed(0)}%</span>
                                                    </div>
                                                </td>
                                                <td className={styles.ledgerValue} style={{ textAlign: 'right', color: 'var(--accent-orange, #f97316)' }}>+{((colony.deepCoreExtractors ?? 0) * 20).toFixed(0)}% Extraction</td>
                                                <td>{buildAction('DeepCoreExtractor')}</td>
                                            </tr>
                                        );
                                    }

                                    if (completedTechs.includes('automated_reclamation_consortium')) {
                                        specialtyRows.push(
                                            <tr key="reclamation">
                                                <td>
                                                    <div className={styles.ledgerLabel}><span className={styles.ledgerIcon}>♻️</span><span className={styles.ledgerName}>Reclamation Plants</span></div>
                                                </td>
                                                <td className={styles.ledgerValue} style={{ textAlign: 'right' }}>{colony.reclamationPlants ?? 0}</td>
                                                <td className={styles.ledgerValue} style={{ textAlign: 'right' }}>{((colony.reclamationPlants ?? 0) * (BALANCING.EMPLOYMENT.WORKER_REQUIREMENT_RECLAMATION || 3)).toFixed(1)}M</td>
                                                <td>
                                                    <div className={styles.ledgerStaffing}>
                                                        <div className={styles.meterTrack} style={{ margin: 0 }}><div className={styles.meterFill} style={{ width: `${rates.staffingLevel * 100}%`, background: 'var(--accent-emerald, #10b981)' }} /></div>
                                                        <span className={styles.staffingText}>{(rates.staffingLevel * 100).toFixed(0)}%</span>
                                                    </div>
                                                </td>
                                                <td className={styles.ledgerValue} style={{ textAlign: 'right', color: 'var(--accent-emerald, #10b981)' }}>+{((colony.reclamationPlants ?? 0) * 5).toFixed(0)}% Output</td>
                                                <td>{buildAction('ReclamationPlant')}</td>
                                            </tr>
                                        );
                                    }

                                    if (specialtyRows.length > 0) {
                                        return (
                                            <>
                                                <tr className={styles.ledgerCategory}>
                                                    <td colSpan={6}>Advanced Technology Structures</td>
                                                </tr>
                                                {specialtyRows}
                                            </>
                                        );
                                    }
                                    return null;
                                })()}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Production queue */}
                <div className={styles.panel}>
                    <div className="panel-header">
                        <h3>Production Queue</h3>
                        {colony.productionQueue.length > 0 && (
                            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{colony.productionQueue.length} item{colony.productionQueue.length > 1 ? 's' : ''}</span>
                        )}
                    </div>
                    <div className="panel-body">
                        {colony.productionQueue.length === 0 ? (
                            <div style={{ color: 'var(--text-muted)', fontSize: 12, textAlign: 'center', padding: '12px 0' }}>Queue empty. Use Build Actions in the Ledger →</div>
                        ) : (
                            <div className={styles.horizontalQueue}>
                                {colony.productionQueue.map((item, i) => (
                                    <div key={item.id} className={styles.queueItemHorizontal}>
                                        <div className={styles.queueItemHeader}>
                                            <span className={styles.queuePos}>{i + 1}</span>
                                            <div className={styles.queueName}>
                                                <span>{item.quantity}× {item.name}</span>
                                                {i === 0 && <span className={`badge badge-blue`} style={{ fontSize: 9 }}>ACTIVE</span>}
                                            </div>
                                            <span className={styles.queueEta}>{getEta(item)}</span>
                                            <button className="btn btn-danger btn-sm btn-icon" onClick={() => removeItem(item.id)} title="Remove">×</button>
                                        </div>
                                        {i === 0 && (() => {
                                            const missingResources: string[] = [];
                                            if (item.costPerUnit) {
                                                const remainingFrac = 1 - (item.progress / 100);
                                                for (const [res, cost] of Object.entries(item.costPerUnit)) {
                                                    const totalNeeded = cost * item.quantity;
                                                    const remainingNeeded = totalNeeded * remainingFrac;
                                                    const available = colony.minerals[res] || 0;
                                                    if (available < remainingNeeded * 0.05 && available < cost) {
                                                        missingResources.push(res);
                                                    }
                                                }
                                            }

                                            return (
                                                <div style={{ marginTop: 6 }}>
                                                    <div className="progress-bar" style={{ height: 4 }}>
                                                        <div className="progress-fill" style={{ width: `${item.progress}%`, background: missingResources.length > 0 ? 'var(--accent-red)' : 'var(--accent-blue)' }} />
                                                    </div>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 3 }}>
                                                        <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>{item.progress.toFixed(1)}%</span>
                                                        {missingResources.length > 0 && (
                                                            <span style={{ fontSize: 9, color: 'var(--accent-red)', fontWeight: 600 }}>
                                                                Shortage: {missingResources.join(', ')}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })()}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

// ─── Tab 3: Population ────────────────────────────────────────────────────────

function PopulationTab({ colony, rates, planet }: {
    colony: Colony;
    rates: ReturnType<typeof calcEffectiveRates>;
    planet: Planet | null;
}) {
    const segments = colony.populationSegments ?? [];
    const pop = colony.population ?? 0;
    const alloc = colony.laborAllocation ?? { industry: 30, mining: 20, research: 15, construction: 15, agriculture: 5, commerce: 15 };
    const unemployedPct = (rates.laborReport.unemployed / pop) * 100;
    const maxPop = colony.maxPopulation ?? 15000;

    // Welfare calculations (mirror time.ts logic)
    const avgHabitability = segments.length > 0
        ? segments.reduce((sum, s) => sum + s.habitability * s.count, 0) / pop
        : 1.0;
    const habitabilityBonus = (avgHabitability - 0.5) * 30;
    const infraBonus = ((colony.infrastructure ?? 80) - 50) * 0.3;
    const overcrowdPenalty = pop > maxPop * 0.9 ? 10 : 0;
    const spaceportBonus = colony.spaceport ? 5 : 0;
    const unemploymentPenalty = (rates.laborReport.unemployed > 0 ? 0 : (1 - rates.staffingLevel) * 30);
    const targetHappiness = Math.round(60 + habitabilityBonus + infraBonus - overcrowdPenalty + spaceportBonus - unemploymentPenalty);

    // ── Policy Multipliers ──
    let policyGrowthMod = 1.0;

    switch (colony.policy) {
        case 'Encourage Growth':
            policyGrowthMod = 1.5;
            break;
        case 'Population Control':
            policyGrowthMod = 0.0;
            break;
        case 'Forced Labor':
            policyGrowthMod = 0.8;
            break;
        case 'Normal':
        default:
            break;
    }

    const capacityMod = Math.max(-1, 1 - (pop / maxPop));
    const isOvercrowded = capacityMod < 0;

    return (
        <div className={styles.tabContent}>
            <div className={styles.popGrid}>
                {/* Demographics Panel */}
                <div className={styles.panel}>
                    <div className="panel-header">
                        <h3>👥 Demographics</h3>
                        <span style={{ fontSize: 11, color: isOvercrowded ? 'var(--accent-red)' : 'var(--text-muted)' }}>
                            {pop.toFixed(1)}M / {maxPop.toLocaleString()}M Capacity
                        </span>
                    </div>
                    <div className="panel-body">
                        <table className={`data-table ${styles.popTable}`}>
                            <thead>
                                <tr>
                                    <th></th>
                                    <th>Species</th>
                                    <th style={{ textAlign: 'right' }}>Population</th>
                                    <th style={{ textAlign: 'right' }}>Growth</th>
                                    <th style={{ textAlign: 'right' }}>Happiness</th>
                                </tr>
                            </thead>
                            <tbody>
                                {segments.map(seg => {
                                    const sp = SPECIES[seg.speciesId as keyof typeof SPECIES];
                                    const segHappinessMod = seg.happiness > 70 ? 1.1 : seg.happiness < 30 ? 0.95 : 1.0;
                                    const speciesMod = sp?.growthRateModifier ?? 1.0;
                                    const baseGrowth = (colony.populationGrowthRate ?? 0.02) * 100;

                                    const effectiveAnnualGrowthPct = baseGrowth * policyGrowthMod * segHappinessMod * speciesMod * seg.habitability * capacityMod;

                                    return (
                                        <tr key={seg.speciesId}>
                                            <td style={{ width: 48 }}>
                                                <img
                                                    src={sp?.portrait ?? ''}
                                                    alt={sp?.name ?? seg.speciesId}
                                                    className={styles.speciesPortrait}
                                                />
                                            </td>
                                            <td>
                                                <div style={{ fontWeight: 500, color: 'var(--text-primary)' }}>
                                                    {sp?.icon} {sp?.name ?? seg.speciesId}
                                                </div>
                                                <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{sp?.description}</div>
                                            </td>
                                            <td style={{ textAlign: 'right' }}>
                                                <span className="stat-value">{seg.count.toFixed(1)} M</span>
                                            </td>
                                            <td style={{ textAlign: 'right' }}>
                                                <span style={{
                                                    fontSize: 12,
                                                    fontWeight: 600,
                                                    color: effectiveAnnualGrowthPct < 0 ? 'var(--accent-red)' : effectiveAnnualGrowthPct > 0 ? 'var(--accent-green)' : 'var(--text-muted)'
                                                }}>
                                                    {effectiveAnnualGrowthPct > 0 ? '+' : ''}{effectiveAnnualGrowthPct.toFixed(1)}% / yr
                                                </span>
                                                <div style={{ fontSize: 9, color: 'var(--text-muted)', marginTop: 2 }}>
                                                    Base: {baseGrowth.toFixed(1)}%
                                                    {policyGrowthMod !== 1 && ` • Pol: x${policyGrowthMod.toFixed(1)}`}
                                                    {capacityMod < 1 && ` • Cap: x${capacityMod.toFixed(2)}`}
                                                </div>
                                            </td>
                                            <td style={{ textAlign: 'right' }}>
                                                <span style={{
                                                    color: seg.happiness > 60 ? 'var(--accent-green)' : seg.happiness > 35 ? 'var(--accent-yellow, #f0ad4e)' : 'var(--accent-red)',
                                                    fontWeight: 500,
                                                }}>
                                                    {seg.happiness > 60 ? '😊' : seg.happiness > 35 ? '😐' : '😟'} {Math.round(seg.happiness)}
                                                </span>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                            <tfoot>
                                <tr style={{ borderTop: '1px solid var(--border-dim)' }}>
                                    <td></td>
                                    <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>Total</td>
                                    <td style={{ textAlign: 'right', fontWeight: 600 }}>{pop.toFixed(1)} M</td>
                                    <td></td>
                                    <td></td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                </div>

                {/* Employment Panel */}
                <div className={styles.panel} style={{ flex: 1 }}>
                    <div className="panel-header"><h3>👷 Labor Breakdown</h3></div>
                    <div className="panel-body">
                        <table className="data-table" style={{ tableLayout: 'auto' }}>
                            <thead>
                                <tr>
                                    <th style={{ width: '160px' }}>Sector</th>
                                    <th style={{ textAlign: 'right', width: '100px' }}>Requirement</th>
                                    <th style={{ textAlign: 'right', width: '100px' }}>Facilities</th>
                                    <th style={{ textAlign: 'right' }}>Output</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr>
                                    <td>🏛️ Industry</td>
                                    <td style={{ textAlign: 'right' }}>{rates.laborReport.industry.toFixed(1)} M</td>
                                    <td style={{ textAlign: 'right' }}>{colony.factories + colony.civilianFactories} Buildings</td>
                                    <td style={{ textAlign: 'right' }}><span className="stat-value">{rates.bpPerDay.toFixed(0)} BP/d</span></td>
                                </tr>
                                <tr>
                                    <td>⛏️ Mining</td>
                                    <td style={{ textAlign: 'right' }}>{rates.laborReport.mining.toFixed(1)} M</td>
                                    <td style={{ textAlign: 'right' }}>{colony.mines + colony.civilianMines} Mines</td>
                                    <td style={{ textAlign: 'right' }}><span className="stat-value">{rates.mineralsPerDay.toFixed(1)} t/d</span></td>
                                </tr>
                                <tr>
                                    <td>🧪 Research</td>
                                    <td style={{ textAlign: 'right' }}>{rates.laborReport.research.toFixed(1)} M</td>
                                    <td style={{ textAlign: 'right' }}>{colony.researchLabs} Labs</td>
                                    <td style={{ textAlign: 'right' }}><span className="stat-value">{rates.rpPerDay.toFixed(1)} RP/d</span></td>
                                </tr>
                                <tr>
                                    <td>🏗️ Construction</td>
                                    <td style={{ textAlign: 'right' }}>{rates.laborReport.construction.toFixed(1)} M</td>
                                    <td style={{ textAlign: 'right' }}>{colony.constructionOffices} Offices</td>
                                    <td style={{ textAlign: 'right' }}><span className="stat-value">{rates.constructionBP.toFixed(0)} BP/d</span></td>
                                </tr>
                                <tr>
                                    <td>🚀 Logistics</td>
                                    <td style={{ textAlign: 'right' }}>{rates.laborReport.logistics.toFixed(1)} M</td>
                                    <td style={{ textAlign: 'right' }}>{colony.shipyards.length + (colony.spaceport ? 1 : 0)} Spaceports</td>
                                    <td style={{ textAlign: 'right' }}><span className="stat-value">Hub / SY</span></td>
                                </tr>
                                <tr>
                                    <td>🌾 Agriculture</td>
                                    <td style={{ textAlign: 'right' }}>{rates.laborReport.agri.toFixed(1)} M</td>
                                    <td style={{ textAlign: 'right' }}>{colony.farms} Farm Blocks</td>
                                    <td style={{ textAlign: 'right' }}><span className="stat-value">Growth</span></td>
                                </tr>
                                <tr>
                                    <td>🛒 Services</td>
                                    <td style={{ textAlign: 'right' }}>{rates.laborReport.services.toFixed(1)} M</td>
                                    <td style={{ textAlign: 'right' }}>{colony.commercialCenters} Comm. Centers</td>
                                    <td style={{ textAlign: 'right' }}><span className="stat-value">Trade Goods</span></td>
                                </tr>
                                {rates.laborReport.unemployed > 0 && (
                                    <tr style={{ color: 'var(--accent-green)' }}>
                                        <td>👷 Reserve Workforce</td>
                                        <td style={{ textAlign: 'right' }}>{rates.laborReport.unemployed.toFixed(1)} M</td>
                                        <td style={{ textAlign: 'right' }}>— Population</td>
                                        <td style={{ textAlign: 'right' }}>Expansion</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Welfare Summary Panel */}
                <div className={styles.panel}>
                    <div className="panel-header"><h3>🏥 Welfare Breakdown</h3></div>
                    <div className="panel-body">
                        <table className={`data-table ${styles.welfareTable}`}>
                            <tbody>
                                <tr><td>Base</td><td style={{ textAlign: 'right' }}>+60</td></tr>
                                <tr>
                                    <td>Habitability ({(avgHabitability * 100).toFixed(0)}%)</td>
                                    <td style={{ textAlign: 'right', color: habitabilityBonus >= 0 ? 'var(--accent-green)' : 'var(--accent-red)' }}>
                                        {habitabilityBonus >= 0 ? '+' : ''}{habitabilityBonus.toFixed(1)}
                                    </td>
                                </tr>
                                <tr>
                                    <td>Infrastructure ({(colony.infrastructure ?? 80).toFixed(0)}%)</td>
                                    <td style={{ textAlign: 'right', color: infraBonus >= 0 ? 'var(--accent-green)' : 'var(--accent-red)' }}>
                                        {infraBonus >= 0 ? '+' : ''}{infraBonus.toFixed(1)}
                                    </td>
                                </tr>
                                <tr>
                                    <td>Spaceport</td>
                                    <td style={{ textAlign: 'right', color: 'var(--accent-green)' }}>
                                        {colony.spaceport ? '+5' : '+0'}
                                    </td>
                                </tr>
                                {overcrowdPenalty > 0 && (
                                    <tr>
                                        <td>Overcrowding</td>
                                        <td style={{ textAlign: 'right', color: 'var(--accent-red)' }}>−{overcrowdPenalty}</td>
                                    </tr>
                                )}
                                {unemploymentPenalty > 0.1 && (
                                    <tr>
                                        <td>Unemployment ({unemployedPct}%)</td>
                                        <td style={{ textAlign: 'right', color: 'var(--accent-red)' }}>−{unemploymentPenalty.toFixed(1)}</td>
                                    </tr>
                                )}
                            </tbody>
                            <tfoot>
                                <tr style={{ borderTop: '2px solid var(--border-dim)', fontWeight: 600 }}>
                                    <td>Target Happiness</td>
                                    <td style={{ textAlign: 'right', color: targetHappiness > 60 ? 'var(--accent-green)' : 'var(--accent-red)' }}>
                                        {targetHappiness}
                                    </td>
                                </tr>
                                <tr>
                                    <td>Current</td>
                                    <td style={{
                                        textAlign: 'right',
                                        color: colony.happiness > 60 ? 'var(--accent-green)' : colony.happiness > 35 ? 'var(--accent-yellow, #f0ad4e)' : 'var(--accent-red)',
                                    }}>
                                        {Math.round(colony.happiness)} {Math.round(colony.happiness) < targetHappiness ? '↑' : Math.round(colony.happiness) > targetHappiness ? '↓' : '→'}
                                    </td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
}

const SPECIES_MAP = SPECIES;

// ─── Main Component ───────────────────────────────────────────────────────────

type Tab = 'Overview' | 'Population' | 'Industry' | 'Shipyards' | 'Surface' | 'Atmosphere' | 'History';

export default function ColonyManager() {
    const game = useGameStore(s => s.game);
    const { selectedColonyId, selectColony } = useUIStore();
    const [activeTab, setActiveTab] = useState<Tab>('Overview');

    if (!game) return <div className={styles.empty}>No game in progress.</div>;

    const allColonies = Object.values(game.colonies).filter(c => c.empireId === game.playerEmpireId);
    if (allColonies.length === 0) return (
        <RosterShell>
            <MainArea isEmpty emptyMessage="No colonies yet. Explore and colonize a planet." children={null} />
        </RosterShell>
    );

    const colony = (selectedColonyId ? game.colonies[selectedColonyId] : null) ?? allColonies[0];

    // Find planet data
    const planet = Object.values(game.galaxy.stars).flatMap(s => s.planets).find(p => p.id === colony.planetId) ?? null;
    const empire = game.empires[game.playerEmpireId];
    const rates = useMemo(() => calcEffectiveRates(colony, empire.officers, planet, game.empires), [colony, empire.officers, planet, game.empires]);

    const updateColony = (patch: Partial<Colony>) => {
        useGameStore.setState(s => ({
            game: s.game ? {
                ...s.game,
                colonies: {
                    ...s.game.colonies,
                    [colony.id]: { ...colony, ...patch },
                },
            } : null,
        }));
    };

    // Group colonies by star system
    const groupedColonies = allColonies.reduce((acc, c) => {
        const star = Object.values(game.galaxy.stars).find(s => s.planets.some(p => p.id === c.planetId));
        const systemName = star?.name || 'Unknown System';
        if (!acc[systemName]) acc[systemName] = [];
        acc[systemName].push(c);
        return acc;
    }, {} as Record<string, Colony[]>);

    return (
        <RosterShell>
            <SidebarSection
                header={
                    <div style={{
                        fontFamily: 'Orbitron',
                        fontSize: 11,
                        color: 'var(--accent-blue)',
                        textTransform: 'uppercase',
                        letterSpacing: '0.1em',
                    }}>
                        Colonial Administration ({allColonies.length})
                    </div>
                }
            >
                {Object.entries(groupedColonies).map(([system, list]) => (
                    <RosterGroup key={system} title={system.toUpperCase()} icon="🪐">
                        {list.map(c => {
                            const p = Object.values(game.galaxy.stars).flatMap(s => s.planets).find(pl => pl.id === c.planetId) ?? null;
                            const r = calcEffectiveRates(c, empire.officers, p, game.empires);
                            return (
                                <RosterItem
                                    key={c.id}
                                    name={c.name}
                                    active={c.id === colony.id}
                                    onClick={() => { selectColony(c.id); setActiveTab('Overview'); }}
                                    subtitle={`${c.population.toFixed(1)}M · ${r.bpPerDay.toFixed(0)} BP/d`}
                                    thumbnail={<div style={{ fontSize: 20 }}>{COLONY_TYPE_ICON[c.colonyType ?? 'Core'] ?? '🏛️'}</div>}
                                />
                            );
                        })}
                    </RosterGroup>
                ))}
            </SidebarSection>

            <MainArea
                isEmpty={!colony}
                title={colony?.name}
                subtitle={colony && `${colony.colonyType} Colony · ${planet?.name || 'Unknown Body'}`}
                headerActions={
                    <div className={styles.tabs} style={{ borderBottom: 'none', padding: 0, background: 'transparent' }}>
                        {(['Overview', 'Population', 'Industry', 'Shipyards', 'History', 'Surface', 'Atmosphere'] as Tab[]).map(tab => (
                            <button
                                key={tab}
                                className={`${styles.tab} ${activeTab === tab ? styles.tabActive : ''}`}
                                onClick={() => setActiveTab(tab)}
                                style={{ height: 32, fontSize: 11 }}
                            >
                                {tab === 'Overview' ? '🏛️' : tab === 'Population' ? '👥' : tab === 'Industry' ? '🏭' : tab === 'Shipyards' ? '⚓' : tab === 'History' ? '📈' : tab === 'Surface' ? '🪐' : '💨'} {tab}
                            </button>
                        ))}
                    </div>
                }
            >
                <div style={{ padding: '0 16px', height: '100%', overflowY: 'auto' }}>
                    {activeTab === 'Overview' && (
                        <OverviewTab colony={colony} rates={rates} planet={planet} updateColony={updateColony} governor={empire.officers.find(o => o.id === colony.governorId) ?? null} />
                    )}
                    {activeTab === 'Population' && (
                        <PopulationTab colony={colony} rates={rates} planet={planet} />
                    )}
                    {activeTab === 'Industry' && <IndustryTab colony={colony} rates={rates} planet={planet} updateColony={updateColony} empire={empire} />}
                    {activeTab === 'Shipyards' && <ShipyardTab colony={colony} rates={rates} updateColony={updateColony} empire={empire} />}
                    {activeTab === 'History' && (
                        <div className={styles.panel} style={{ marginTop: 10 }}>
                            <div className="panel-header"><h3>📈 Development History</h3></div>
                            <div className="panel-body">
                                <InvestmentHistoryChart history={colony.history || []} height={400} />
                            </div>
                        </div>
                    )}
                    {activeTab === 'Surface' && (
                        <SurfaceTab colony={colony} planet={planet} />
                    )}
                    {activeTab === 'Atmosphere' && (
                        <AtmosphereTab planet={planet} />
                    )}
                </div>
            </MainArea>
        </RosterShell>
    );
}

