'use client';
import { useState, useMemo } from 'react';
import { useGameStore } from '@/store/gameStore';
import { useUIStore } from '@/store/uiStore';
import { calculateColonyBudget, calculateEmpireBudget } from '@/engine/finances';
import { COLONY_TYPE_BONUS } from '@/engine/colonies';
import { getGovernorBonuses } from '@/engine/officers';
import { BALANCING } from '@/engine/constants';
import styles from './Dashboard.module.css';

type SortKey = 'name' | 'population' | 'bp' | 'rp' | 'profit' | 'happiness';

export default function Dashboard() {
    const game = useGameStore(s => s.game);
    const { setView, selectColony, selectFleet } = useUIStore();

    const [sortKey, setSortKey] = useState<SortKey>('population');
    const [sortDesc, setSortDesc] = useState(true);

    if (!game) return <div className={styles.empty}>No game in progress.</div>;

    const empire = game.empires[game.playerEmpireId];
    if (!empire) return null;

    const colonies = Object.values(game.colonies).filter(c => c.empireId === empire.id);
    const empireBudget = calculateEmpireBudget(game, empire.id);

    const colonyData = useMemo(() => {
        return colonies.map(c => {
            const budget = calculateColonyBudget(c, 1);
            const bonus = COLONY_TYPE_BONUS[c.colonyType] ?? COLONY_TYPE_BONUS.Core;
            const infraEff = 0.5 + (c.infrastructure / 100) * 0.5;
            const govBonuses = getGovernorBonuses(empire.officers || [], c.governorId);
            const prodBonus = 1 + (govBonuses.all_production ?? 0);

            const bp = c.factories * BALANCING.BP_PER_FACTORY * (c.staffingLevel || 0) * bonus.industry * infraEff * (1 + (govBonuses.factory_output || 0)) * prodBonus;
            const rp = c.researchLabs * 20 * (c.staffingLevel || 0) * bonus.research * infraEff * prodBonus;

            return {
                id: c.id,
                name: c.name,
                population: c.population,
                bp,
                rp,
                profit: budget.netIncome,
                happiness: c.happiness
            };
        });
    }, [colonies, empire.officers]);

    const sortedColonies = useMemo(() => {
        const sorted = [...colonyData].sort((a, b) => {
            const valA = a[sortKey];
            const valB = b[sortKey];
            if (typeof valA === 'string' && typeof valB === 'string') {
                return valA.localeCompare(valB);
            }
            return (valA as number) - (valB as number);
        });
        return sortDesc ? sorted.reverse() : sorted;
    }, [colonyData, sortKey, sortDesc]);

    const handleSort = (key: SortKey) => {
        if (sortKey === key) {
            setSortDesc(!sortDesc);
        } else {
            setSortKey(key);
            setSortDesc(true);
        }
    };

    const totalPop = colonyData.reduce((s, c) => s + c.population, 0);
    const totalBP = colonyData.reduce((s, c) => s + c.bp, 0);
    const totalRP = colonyData.reduce((s, c) => s + c.rp, 0);

    return (
        <div className={styles.container}>
            <div className={styles.header}>
                <div>
                    <div className={styles.empireName}>{empire.name.toUpperCase()} ADMIRALTY BOARD</div>
                    <div className={styles.date}>CENTRAL COMMAND • {game.date instanceof Date ? game.date.toISOString().split('T')[0] : String(game.date)}</div>
                </div>
            </div>

            <div style={{ padding: '14px 14px 0 14px' }}>
                <div className={styles.metricsBar}>
                    <div className={styles.metricCard}>
                        <div className={styles.metricLabel}>Total Population</div>
                        <div className={styles.metricValue}>{totalPop.toFixed(1)}M</div>
                    </div>
                    <div className={styles.metricCard}>
                        <div className={styles.metricLabel}>Industrial Output</div>
                        <div className={styles.metricValue}>{totalBP.toFixed(0)} BP/d</div>
                    </div>
                    <div className={styles.metricCard}>
                        <div className={styles.metricLabel}>Research Velocity</div>
                        <div className={styles.metricValue}>{totalRP.toFixed(0)} RP/d</div>
                    </div>
                    <div className={styles.metricCard}>
                        <div className={styles.metricLabel}>Financial Net</div>
                        <div className={`${styles.metricValue} ${empireBudget.netIncome >= 0 ? styles.ready : styles.danger}`}>
                            {empireBudget.netIncome >= 0 ? '+' : ''}{Math.floor(empireBudget.netIncome).toLocaleString()} W
                        </div>
                    </div>
                </div>
            </div>

            <div className={styles.grid}>
                <div style={{ background: 'var(--bg-panel)', border: '1px solid var(--border-dim)', borderRadius: '8px', overflow: 'hidden' }}>
                    <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-dim)', fontWeight: 600, fontSize: 13, background: 'rgba(255,255,255,0.02)' }}>
                        Colony Roster
                    </div>
                    <table className={styles.rosterTable}>
                        <thead>
                            <tr>
                                <th onClick={() => handleSort('name')}>Colony {sortKey === 'name' && <span className={styles.sortIcon}>{sortDesc ? '▼' : '▲'}</span>}</th>
                                <th onClick={() => handleSort('population')}>Pop {sortKey === 'population' && <span className={styles.sortIcon}>{sortDesc ? '▼' : '▲'}</span>}</th>
                                <th onClick={() => handleSort('bp')}>BP/d {sortKey === 'bp' && <span className={styles.sortIcon}>{sortDesc ? '▼' : '▲'}</span>}</th>
                                <th onClick={() => handleSort('rp')}>RP/d {sortKey === 'rp' && <span className={styles.sortIcon}>{sortDesc ? '▼' : '▲'}</span>}</th>
                                <th onClick={() => handleSort('profit')}>Profit {sortKey === 'profit' && <span className={styles.sortIcon}>{sortDesc ? '▼' : '▲'}</span>}</th>
                                <th onClick={() => handleSort('happiness')}>Mood {sortKey === 'happiness' && <span className={styles.sortIcon}>{sortDesc ? '▼' : '▲'}</span>}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {sortedColonies.map(c => (
                                <tr key={c.id} style={{ cursor: 'pointer' }} onClick={() => { selectColony(c.id); setView('Colonies'); }}>
                                    <td className={styles.colonyName}>{c.name}</td>
                                    <td>{c.population.toFixed(1)}M</td>
                                    <td>{c.bp.toFixed(0)}</td>
                                    <td>{c.rp.toFixed(0)}</td>
                                    <td className={c.profit >= 0 ? styles.ready : styles.danger}>{c.profit > 0 ? '+' : ''}{Math.floor(c.profit)}</td>
                                    <td className={c.happiness > 70 ? styles.ready : c.happiness < 40 ? styles.danger : styles.warning}>{Math.floor(c.happiness)}%</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <div style={{ background: 'var(--bg-panel)', border: '1px solid var(--border-dim)', borderRadius: '8px', overflow: 'hidden' }}>
                        <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-dim)', fontWeight: 600, fontSize: 13, background: 'rgba(255,255,255,0.02)' }}>
                            Fleet Readiness
                        </div>
                        <div style={{ padding: '8px' }}>
                            {empire.fleets.length === 0 ? (
                                <div style={{ padding: '12px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 12 }}>No fleets deployed.</div>
                            ) : (
                                empire.fleets.map(f => (
                                    <div key={f.id}
                                        style={{ padding: '10px', borderRadius: '4px', background: 'rgba(255,255,255,0.03)', marginBottom: '6px', cursor: 'pointer' }}
                                        onClick={() => { selectFleet(f.id); setView('Fleets'); }}
                                    >
                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                                            <span style={{ fontWeight: 600, fontSize: 12 }}>{f.name}</span>
                                            <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{f.shipIds.length} Ships</span>
                                        </div>
                                        <div style={{ fontSize: 10, color: 'var(--accent-blue)', textTransform: 'uppercase' }}>
                                            {f.orders.length > 0 ? 'En Route' : (f.orbitingPlanetId ? 'Orbiting' : 'Deep Space')}
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>

                    <div style={{ background: 'var(--bg-panel)', border: '1px solid var(--border-dim)', borderRadius: '8px', padding: '16px' }}>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '12px' }}>Operational Commands</div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                            <button
                                style={{ width: '100%', padding: '10px', background: 'var(--accent-blue)', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 600, fontSize: 12 }}
                                onClick={() => setView('Economy')}
                            >
                                Financial Ledger & Audit
                            </button>
                            <button
                                style={{ width: '100%', padding: '10px', background: 'rgba(255,255,255,0.05)', color: 'var(--text-primary)', border: '1px solid var(--border-dim)', borderRadius: '4px', cursor: 'pointer', fontSize: 12 }}
                                onClick={() => setView('Research')}
                            >
                                Technology & Projects
                            </button>
                            <button
                                style={{ width: '100%', padding: '10px', background: 'rgba(255,255,255,0.05)', color: 'var(--text-primary)', border: '1px solid var(--border-dim)', borderRadius: '4px', cursor: 'pointer', fontSize: 12 }}
                                onClick={() => setView('ShipDesign')}
                            >
                                Naval Architecture
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
