'use client';
import { useGameStore } from '@/store/gameStore';
import type { Planet, Colony } from '@/types';
import { BALANCING } from '@/engine/constants';
import { getGovernorBonuses } from '@/engine/officers';
import PlanetVisualizer from './PlanetVisualizer';
export { PlanetVisualizer };
import styles from './SharedTabs.module.css';

export function SurfaceTab({ colony, planet }: {
    colony?: Colony;
    planet: Planet | null;
}) {
    // If no colony, assume 0 extraction infrastructure
    const alloc = colony?.laborAllocation ?? { industry: 30, mining: 20, research: 15, construction: 15, agriculture: 5, commerce: 15 };
    const pop = colony?.population ?? 0;
    const miningW = Math.sqrt(Math.max((alloc.mining / 100) * pop, 0.01) / 100);
    const infraEff = 0.5 + ((colony?.infrastructure ?? 80) / 100) * 0.5;
    const game = useGameStore(s => s.game);
    const officers = game ? game.empires[game.playerEmpireId].officers : [];
    const govBonuses = getGovernorBonuses(officers, colony?.governorId);

    return (
        <div className={styles.tabContent} style={{ display: 'flex', flexDirection: 'column' }}>
            <PlanetVisualizer planet={planet} colony={colony} />
            <div className={styles.surfaceLayout}>
                {/* Planetary data */}
                <div className="panel">
                    <div className="panel-header"><h3>Planetary Data</h3></div>
                    <div className="panel-body">
                        <div className="stat-row"><span className="stat-label">Planet Type</span><span className="stat-value">{planet?.bodyType ?? 'Unknown'}</span></div>
                        <div className="stat-row"><span className="stat-label">Atmosphere</span><span className="stat-value">{planet?.atmosphere ?? 'Unknown'}</span></div>
                        {colony !== undefined && (
                            <>
                                <div className="stat-row"><span className="stat-label">Max Population</span><span className="stat-value">{(colony.maxPopulation ?? 15000).toFixed(0)}M</span></div>

                                <div className="divider" />

                                {/* Terraforming */}
                                <div style={{ marginBottom: 6, fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Terraforming</div>
                                <div className="progress-bar" style={{ marginBottom: 6 }}>
                                    <div className="progress-fill" style={{ width: `${colony.terraformProgress}%`, background: 'var(--accent-green)' }} />
                                </div>
                                <div className="stat-row">
                                    <span className="stat-label">Progress</span>
                                    <span className="stat-value">{colony.terraformProgress.toFixed(1)}%</span>
                                </div>
                                <div className="stat-row">
                                    <span className="stat-label">Rate</span>
                                    <span className="stat-value">{(miningW * 0.05).toFixed(2)}%/day</span>
                                </div>
                                {colony.terraformProgress < 100 && miningW < 1 && (
                                    <div style={{ fontSize: 11, color: 'var(--accent-gold)', marginTop: 4 }}>
                                        ⚠️ Assign construction workers to terraform
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                </div>

                {/* Minerals table */}
                <div className="panel">
                    <div className="panel-header"><h3>Mineral Deposits</h3></div>
                    <div className="panel-body">
                        {(!planet || planet.minerals.length === 0) ? (
                            <div style={{ color: 'var(--text-muted)', fontSize: 12 }}>No minerals surveyed.</div>
                        ) : (
                            <table className={styles.mineralTable}>
                                <thead>
                                    <tr>
                                        <th>Mineral</th>
                                        <th>Remaining</th>
                                        <th>Access.</th>
                                        <th>Rate</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {BALANCING.RAW_MINERALS.map((mName: string) => {
                                        const m = planet?.minerals.find(min => min.name === mName) || { name: mName, amount: 0, accessibility: 0 };
                                        const mineBonus = 1 + (govBonuses.mining_rate ?? 0);
                                        const prodBonus = 1 + (govBonuses.all_production ?? 0);
                                        const ratePerDay = colony ? colony.mines * 0.5 * m.accessibility * miningW * infraEff * mineBonus * prodBonus : 0;
                                        const depletedIn = ratePerDay > 0 ? m.amount / ratePerDay : Infinity;
                                        return (
                                            <tr key={mName}>
                                                <td style={{ color: 'var(--text-primary)', fontWeight: 500 }}>
                                                    <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                                        <img src={`/minerals/${mName.toLowerCase()}.png`} alt={mName} width={24} height={24} style={{ imageRendering: 'pixelated', borderRadius: 2 }} />
                                                        {mName}
                                                    </span>
                                                </td>
                                                <td>
                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                                                        <span>{Math.floor(m.amount).toLocaleString()}</span>
                                                        <div className={styles.depBar}>
                                                            <div className={styles.depFill} style={{ width: `${Math.min(100, (m.amount / 5000) * 100)}%` }} />
                                                        </div>
                                                    </div>
                                                </td>
                                                <td style={{ color: m.accessibility > 0.7 ? 'var(--accent-green)' : m.accessibility > 0.4 ? 'var(--accent-gold)' : m.accessibility > 0.2 ? 'var(--text-muted)' : 'var(--accent-red)' }}>
                                                    {(m.accessibility * 100).toFixed(0)}%
                                                </td>
                                                <td style={{ color: 'var(--text-secondary)' }}>
                                                    {ratePerDay.toFixed(1)}/d
                                                    {isFinite(depletedIn) && depletedIn < 1000 && (
                                                        <div style={{ fontSize: 9, color: 'var(--text-muted)' }}>~{Math.ceil(depletedIn)}d left</div>
                                                    )}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

export function AtmosphereTab({ planet }: { planet: Planet | null }) {
    if (!planet) return <div className={styles.empty}>Planet data unavailable.</div>;
    const { atmosphere, atmosphericPressure, surfaceTemperature, atmosphereComposition, albedo } = planet;

    // Convert temperature to Celsius for display
    const tempC = surfaceTemperature - 273.15;

    return (
        <div className={styles.tabContent}>
            <div className="panel" style={{ marginBottom: 16 }}>
                <div className="panel-header"><h3>Atmospheric Conditions</h3></div>
                <div className="panel-body" style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
                    <div className="stat-row" style={{ flex: '1 1 200px' }}>
                        <span className="stat-label">Classification</span>
                        <span className="stat-value">{atmosphere}</span>
                    </div>
                    <div className="stat-row" style={{ flex: '1 1 200px' }}>
                        <span className="stat-label">Surface Pressure</span>
                        <span className="stat-value">{atmosphericPressure?.toFixed(2) ?? '0.00'} atm</span>
                    </div>
                    <div className="stat-row" style={{ flex: '1 1 200px' }}>
                        <span className="stat-label">Surface Temp</span>
                        <span className="stat-value" style={{ color: tempC > 50 ? 'var(--accent-red)' : tempC < -50 ? 'var(--accent-blue)' : 'var(--accent-green)' }}>
                            {surfaceTemperature} K ({tempC > 0 ? '+' : ''}{tempC.toFixed(1)}°C)
                        </span>
                    </div>
                    <div className="stat-row" style={{ flex: '1 1 200px' }}>
                        <span className="stat-label">Albedo</span>
                        <span className="stat-value">{albedo?.toFixed(2) ?? 'N/A'}</span>
                    </div>
                </div>
            </div>

            <div className="panel">
                <div className="panel-header"><h3>Gas Composition</h3></div>
                <div className="panel-body">
                    {(!atmosphereComposition || atmosphereComposition.length === 0) ? (
                        <div style={{ color: 'var(--text-muted)', fontSize: 13, padding: '12px 0' }}>Vacuum. No gases present.</div>
                    ) : (
                        <table className={styles.mineralTable}>
                            <thead>
                                <tr>
                                    <th>Gas</th>
                                    <th>Percentage</th>
                                    <th>Partial Pressure</th>
                                </tr>
                            </thead>
                            <tbody>
                                {atmosphereComposition.map(g => {
                                    const partial = (atmosphericPressure ?? 0) * g.percentage;
                                    return (
                                        <tr key={g.name} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                            <td style={{ color: 'var(--text-primary)', fontWeight: 500, padding: '8px 4px' }}>{g.name}</td>
                                            <td style={{ padding: '8px 4px' }}>{(g.percentage * 100).toFixed(2)}%</td>
                                            <td style={{ color: 'var(--text-secondary)', padding: '8px 4px' }}>{partial.toFixed(3)} atm</td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>
        </div>
    );
}
