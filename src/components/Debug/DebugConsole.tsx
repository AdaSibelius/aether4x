'use client';
import React, { useState, useEffect } from 'react';
import { useGameStore } from '@/store/gameStore';
import { useUIStore } from '@/store/uiStore';
import styles from './DebugConsole.module.css';

import SimLogger from '@/utils/logger';
import { runStressTest, StressTestReport } from '@/engine/stressTest';
import { runHealthAudit } from '@/engine/health';
import BattleSimulator from './BattleSimulator';

export default function DebugConsole() {
    const { showDebugConsole, toggleDebugConsole } = useUIStore();
    const [activeTab, setActiveTab] = useState<'Cheats' | 'Snapshots' | 'Differentiator' | 'Market Debug' | 'Scenarios' | 'Testing' | 'Combat Sim'>('Cheats');
    const [showState, setShowState] = useState(false);
    const [report, setReport] = useState<StressTestReport | null>(null);
    const [snapshotName, setSnapshotName] = useState('');
    const [isTracing, setIsTracing] = useState(false);
    const [selectedEntity, setSelectedEntity] = useState<{ type: 'Colony' | 'Company' | 'Fleet' | 'Empire' | 'Full', id: string }>({ type: 'Full', id: '' });
    const [diffIds, setDiffIds] = useState<{ a: string, b: string }>({ a: '', b: '' });
    const [diffResult, setDiffResult] = useState<any>(null);

    const { game, debug, snapshots, createSnapshot, loadSnapshot, deleteSnapshot, diffSnapshots } = useGameStore();
    const { selectedColonyId } = useUIStore();

    useEffect(() => {
        if (typeof window !== 'undefined') {
            (window as any).aetherAPI = {
                getState: () => useGameStore.getState().game,
                getEntity: (type: string, id: string) => {
                    const game = useGameStore.getState().game;
                    if (!game) return null;
                    if (type === 'Colony') return game.colonies[id];
                    if (type === 'Company') return game.empires[game.playerEmpireId].companies.find(c => c.id === id);
                    if (type === 'Fleet') return game.empires[game.playerEmpireId].fleets.find(f => f.id === id);
                    return null;
                },
                snapshot: (name: string) => useGameStore.getState().createSnapshot(name),
                diff: (a: string, b: string) => useGameStore.getState().diffSnapshots(a, b),
                healthAudit: () => game ? runHealthAudit(game) : null,
                advance: () => useGameStore.getState().advanceTurn(),
                warp: (days: number) => useGameStore.getState().debug.timeWarp(days)
            };
        }
    }, [game]);

    if (!game || !showDebugConsole) return null;

    const handleToggleTrace = () => {
        const next = !isTracing;
        setIsTracing(next);
        SimLogger.setTrace(next);
    };

    const handleRunStressTest = (turns: number) => {
        const result = runStressTest(game, turns);
        setReport(result);
        setActiveTab('Testing');
    };

    return (
        <div className={styles.container}>
            <div className={styles.content}>
                <div className={styles.header}>
                    <span>Developer Console</span>
                    <button className={styles.closeBtn} onClick={toggleDebugConsole}>×</button>
                </div>

                <div className={styles.tabs}>
                    {(['Cheats', 'Snapshots', 'Differentiator', 'Market Debug', 'Scenarios', 'Testing', 'Combat Sim'] as const).map(tab => (
                        <button
                            key={tab}
                            className={`${styles.tabBtn} ${activeTab === tab ? styles.active : ''}`}
                            onClick={() => setActiveTab(tab)}
                        >
                            {tab}
                        </button>
                    ))}
                </div>

                {activeTab === 'Cheats' && (
                    <>
                        <section className={styles.section}>
                            <div className={styles.sectionTitle}>Logging</div>
                            <button
                                onClick={handleToggleTrace}
                                style={{ color: isTracing ? 'var(--accent-green)' : 'var(--text-muted)' }}
                            >
                                {isTracing ? '🟢 Trace Enabled' : '⚪ Trace Disabled'}
                            </button>
                            <button
                                onClick={() => useUIStore.getState().toggleDebugOverlay()}
                                style={{ color: useUIStore.getState().showDebugOverlay ? 'var(--accent-yellow)' : 'var(--text-muted)' }}
                            >
                                {useUIStore.getState().showDebugOverlay ? '🟡 Debug Overlay ON' : '⚪ Debug Overlay OFF'}
                            </button>
                        </section>

                        <section className={styles.section}>
                            <div className={styles.sectionTitle}>Quick Cheats</div>
                            <div className={styles.buttonGrid}>
                                <button onClick={() => debug.addWealth(1000000)}>+1M Wealth</button>
                                <button onClick={() => debug.addResearchPoints(1000)}>+1k RP</button>
                                <button
                                    onClick={() => selectedColonyId && debug.addMinerals(selectedColonyId, 10000)}
                                    disabled={!selectedColonyId}
                                >
                                    +10k All Minerals
                                </button>
                            </div>
                        </section>

                        <section className={styles.section}>
                            <div className={styles.sectionTitle}>Time Control</div>
                            <div className={styles.buttonGrid}>
                                <button onClick={() => debug.timeWarp(30)}>Warp 1 Month</button>
                                <button onClick={() => debug.timeWarp(365)}>Warp 1 Year</button>
                            </div>
                        </section>

                        <section className={styles.section}>
                            <div className={styles.sectionTitle}>Automation</div>
                            <button onClick={() => selectedColonyId && debug.instantQueue(selectedColonyId)} disabled={!selectedColonyId}>
                                Instant Build (Top)
                            </button>
                        </section>
                    </>
                )}

                {activeTab === 'Snapshots' && (
                    <div className={styles.snapshotsArea}>
                        <div className={styles.saveForm}>
                            <input
                                type="text"
                                placeholder="Snapshot Name"
                                value={snapshotName}
                                onChange={e => setSnapshotName(e.target.value)}
                            />
                            <button onClick={() => { createSnapshot(snapshotName || 'Manual Save'); setSnapshotName(''); }}>
                                Save
                            </button>
                        </div>
                        <div className={styles.snapList}>
                            {snapshots.map((s: any) => (
                                <div key={s.id} className={styles.snapItem}>
                                    <div className={styles.snapInfo}>
                                        <div className={styles.snapName}>{s.name}</div>
                                        <div className={styles.snapMeta}>Turn {s.turn} · {new Date(s.date).toLocaleTimeString()}</div>
                                    </div>
                                    <div className={styles.snapActions}>
                                        <button onClick={() => loadSnapshot(s.id)}>Load</button>
                                        <button onClick={() => deleteSnapshot(s.id)} style={{ color: 'var(--accent-red)' }}>×</button>
                                    </div>
                                </div>
                            ))}
                            {snapshots.length === 0 && <div className={styles.empty}>No snapshots saved</div>}
                        </div>
                    </div>
                )}

                {activeTab === 'Differentiator' && (
                    <div className={styles.testingArea}>
                        <section className={styles.section}>
                            <div className={styles.sectionTitle}>State Comparison</div>
                            <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                                <select
                                    className="form-control"
                                    style={{ background: 'var(--bg-card)', fontSize: 11 }}
                                    value={diffIds.a}
                                    onChange={e => setDiffIds({ ...diffIds, a: e.target.value })}
                                >
                                    <option value="">Select Base...</option>
                                    {snapshots.map(s => <option key={s.id} value={s.id}>{s.name} (T{s.turn})</option>)}
                                </select>
                                <select
                                    className="form-control"
                                    style={{ background: 'var(--bg-card)', fontSize: 11 }}
                                    value={diffIds.b}
                                    onChange={e => setDiffIds({ ...diffIds, b: e.target.value })}
                                >
                                    <option value="">Select Target...</option>
                                    {snapshots.map(s => <option key={s.id} value={s.id}>{s.name} (T{s.turn})</option>)}
                                </select>
                                <button
                                    disabled={!diffIds.a || !diffIds.b}
                                    onClick={() => setDiffResult(diffSnapshots(diffIds.a, diffIds.b))}
                                >
                                    Diff
                                </button>
                            </div>

                            {diffResult && (
                                <div className={styles.report} style={{ border: '1px solid var(--border-dim)' }}>
                                    <div style={{ fontSize: 11, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                                        <div>Turns Elapsed:</div>
                                        <div style={{ textAlign: 'right', color: 'var(--accent-blue)' }}>+{diffResult.turnDelta}</div>
                                        <div>Treasury Δ:</div>
                                        <div style={{ textAlign: 'right', color: diffResult.treasury >= 0 ? 'var(--accent-green)' : 'var(--accent-red)' }}>
                                            {diffResult.treasury >= 0 ? '+' : ''}{diffResult.treasury.toLocaleString()}
                                        </div>
                                        <div>Private Wealth Δ:</div>
                                        <div style={{ textAlign: 'right', color: diffResult.privateWealth >= 0 ? 'var(--accent-green)' : 'var(--accent-red)' }}>
                                            {diffResult.privateWealth >= 0 ? '+' : ''}{diffResult.privateWealth.toLocaleString()}
                                        </div>
                                        <div>Population Δ:</div>
                                        <div style={{ textAlign: 'right', color: diffResult.popDelta >= 0 ? 'var(--accent-green)' : 'var(--accent-red)' }}>
                                            {diffResult.popDelta >= 0 ? '+' : ''}{diffResult.popDelta.toFixed(2)}M
                                        </div>
                                        <div>Minerals Δ:</div>
                                        <div style={{ textAlign: 'right', color: diffResult.mineralDelta >= 0 ? 'var(--accent-green)' : 'var(--accent-red)' }}>
                                            {diffResult.mineralDelta >= 0 ? '+' : ''}{diffResult.mineralDelta.toLocaleString()}
                                        </div>
                                        <div>Fleet/Ship Δ:</div>
                                        <div style={{ textAlign: 'right', color: diffResult.fleetDelta >= 0 ? 'var(--accent-green)' : 'var(--accent-red)' }}>
                                            {diffResult.fleetDelta >= 0 ? '+' : ''}{diffResult.fleetDelta} / {diffResult.shipDelta}
                                        </div>
                                        <div>Corp Valuation Δ:</div>
                                        <div style={{ textAlign: 'right', color: diffResult.valuationDelta >= 0 ? 'var(--accent-green)' : 'var(--accent-red)' }}>
                                            {diffResult.valuationDelta >= 0 ? '+' : ''}{diffResult.valuationDelta.toLocaleString()}
                                        </div>
                                    </div>
                                    <div style={{ marginTop: 8, fontSize: 9, color: 'var(--text-muted)' }}>
                                        Full structural diff available in window.aetherAPI.diff(a, b)
                                    </div>
                                </div>
                            )}
                        </section>
                    </div>
                )}

                {activeTab === 'Market Debug' && (
                    <div className={styles.testingArea}>
                        <section className={styles.section}>
                            <div className={styles.sectionTitle}>Tender Stress-Tester</div>
                            <div className={styles.buttonGrid}>
                                <button onClick={() => {
                                    if (game.tenders.length > 0) {
                                        const tender = game.tenders[0];
                                        // Mock 5 bids
                                        for (let i = 0; i < 5; i++) {
                                            const bid = tender.highestBid + 500 + Math.floor(Math.random() * 1000);
                                            tender.highestBid = bid;
                                            tender.highestBidderId = 'MOCK_CORP';
                                        }
                                        useGameStore.setState({ game: { ...game } });
                                    }
                                }}>
                                    Simulate 5 Bids (Current Tender)
                                </button>
                                <button onClick={() => {
                                    const next = structuredClone(game);
                                    for (const corp of next.empires[next.playerEmpireId].companies) {
                                        // Seed 10 days of history
                                        for (let d = 0; d < 10; d++) {
                                            corp.history.push({
                                                date: `2040-01-${10 + d}`,
                                                wealth: corp.wealth + (Math.random() * 1000),
                                                valuation: corp.valuation + (Math.random() * 2000),
                                                revenue: Math.random() * 500,
                                                expenses: Math.random() * 200
                                            });
                                        }
                                    }
                                    useGameStore.setState({ game: next });
                                }}>
                                    Seed Valuation History
                                </button>
                            </div>
                        </section>

                        <section className={styles.section}>
                            <div className={styles.sectionTitle}>Corporate Ledger</div>
                            <div className={styles.buttonGrid}>
                                {game.empires[game.playerEmpireId].companies.map(corp => (
                                    <button key={corp.id} style={{ fontSize: 10 }} onClick={() => {
                                        console.table(corp.transactions);
                                        useUIStore.getState().addNotification(`Transaction ledger for ${corp.name} printed to browser console.`);
                                    }}>
                                        Log {corp.name} Ledger
                                    </button>
                                ))}
                            </div>
                        </section>
                    </div>
                )}

                {activeTab === 'Scenarios' && (
                    <div className={styles.testingArea}>
                        <section className={styles.section}>
                            <div className={styles.sectionTitle}>Injection Scenarios</div>
                            <div className={styles.buttonGrid}>
                                <button onClick={() => {
                                    const next = structuredClone(game);
                                    Object.values(next.colonies).forEach(c => {
                                        Object.keys(c.minerals).forEach(m => c.minerals[m] *= 0.1);
                                    });
                                    useGameStore.setState({ game: next });
                                    useUIStore.getState().addNotification("SCENARIO: Mineral Crisis triggered. 90% of stockpiles lost.");
                                }}>
                                    Mineral Crisis
                                </button>
                                <button onClick={() => {
                                    const next = structuredClone(game);
                                    next.empires[next.playerEmpireId].companies.forEach(c => c.wealth += 5000000);
                                    useGameStore.setState({ game: next });
                                    useUIStore.getState().addNotification("SCENARIO: Economic Boom triggered. Companies granted +5M credits.");
                                }}>
                                    Economic Boom
                                </button>
                                <button onClick={() => {
                                    const next = structuredClone(game);
                                    Object.values(next.colonies).forEach(c => c.laborEfficiency = 0.5);
                                    useGameStore.setState({ game: next });
                                    useUIStore.getState().addNotification("SCENARIO: Staffing Shortage triggered. Efficiency dropped to 50%.");
                                }}>
                                    Staffing Shortage
                                </button>
                            </div>
                        </section>
                    </div>
                )}

                {activeTab === 'Testing' && (
                    <div className={styles.testingArea}>
                        <section className={styles.section}>
                            <div className={styles.sectionTitle}>Stress Testing</div>
                            <div className={styles.buttonGrid}>
                                <button onClick={() => handleRunStressTest(30)}>30 Turns</button>
                                <button onClick={() => handleRunStressTest(100)}>100 Turns</button>
                            </div>

                            {report && (
                                <div className={`${styles.report} ${report.isHealthy ? styles.healthy : styles.unhealthy}`}>
                                    <div style={{ fontWeight: 600, marginBottom: 8 }}>
                                        {report.isHealthy ? '✅ Healthy' : '⚠️ Issues Found'}
                                    </div>
                                    <div className={styles.reportStats}>
                                        <div>Turns: {report.turnsRun}</div>
                                        <div>Wealth: {Math.floor(report.initialTreasury)} → {Math.floor(report.finalTreasury)}</div>
                                        <div>Pops: {(report.initialPopulation).toFixed(1)}M → {(report.finalPopulation).toFixed(1)}M</div>
                                    </div>
                                    {report.issues.length > 0 && (
                                        <div className={styles.issueList}>
                                            {report.issues.map((iss, i) => <div key={i}>• {iss}</div>)}
                                        </div>
                                    )}
                                </div>
                            )}
                        </section>

                        <section className={styles.section}>
                            <div className={styles.sectionTitle}>Company Commander</div>
                            <div className={styles.buttonGrid}>
                                {game.empires[game.playerEmpireId].companies.map(corp => (
                                    <div key={corp.id} style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: 8, border: '1px solid var(--border-dim)', borderRadius: 4 }}>
                                        <div style={{ fontSize: 10, fontWeight: 600 }}>{corp.name}</div>
                                        <div style={{ display: 'flex', gap: 4 }}>
                                            <button className="btn-xs" style={{ fontSize: 9 }} onClick={() => debug.triggerCorporateOrder(corp.id, 'design_survey')}>Survey</button>
                                            <button className="btn-xs" style={{ fontSize: 9 }} onClick={() => debug.triggerCorporateOrder(corp.id, 'design_freighter')}>Freighter</button>
                                        </div>
                                    </div>
                                ))}
                                {game.empires[game.playerEmpireId].companies.length === 0 && <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>No companies.</div>}
                            </div>
                        </section>

                        <section className={styles.section}>
                            <div className={styles.sectionTitle}>Fleet Navigator</div>
                            <div className={styles.buttonGrid}>
                                {game.empires[game.playerEmpireId].fleets.map(fleet => (
                                    <div key={fleet.id} style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: 8, border: '1px solid var(--border-dim)', borderRadius: 4 }}>
                                        <div style={{ fontSize: 10, fontWeight: 600 }}>{fleet.name}</div>
                                        <div style={{ display: 'flex', gap: 4 }}>
                                            <button className="btn-xs" style={{ fontSize: 9 }} onClick={() => debug.teleportFleet(fleet.id, 'star_0', 'star_0_p0')}>Earth</button>
                                            <button className="btn-xs" style={{ fontSize: 9 }} onClick={() => debug.teleportFleet(fleet.id, 'star_0', 'star_0_p3')}>Mars</button>
                                        </div>
                                    </div>
                                ))}
                                {game.empires[game.playerEmpireId].fleets.length === 0 && <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>No fleets.</div>}
                            </div>
                        </section>
                    </div>
                )}

                {activeTab === 'Combat Sim' && <BattleSimulator />}

                <section className={styles.section} style={{ marginTop: 'auto' }}>
                    <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                        <select
                            className="form-control"
                            style={{ fontSize: 11, background: 'var(--bg-card)' }}
                            value={selectedEntity.type}
                            onChange={e => setSelectedEntity({ ...selectedEntity, type: e.target.value as any })}
                        >
                            <option value="Full">Global State</option>
                            <option value="Colony">Colony</option>
                            <option value="Company">Company</option>
                            <option value="Fleet">Fleet</option>
                        </select>
                        {selectedEntity.type !== 'Full' && (
                            <select
                                className="form-control"
                                style={{ fontSize: 11, background: 'var(--bg-card)' }}
                                value={selectedEntity.id}
                                onChange={e => setSelectedEntity({ ...selectedEntity, id: e.target.value })}
                            >
                                <option value="">Select Target...</option>
                                {selectedEntity.type === 'Colony' && Object.values(game.colonies).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                {selectedEntity.type === 'Company' && game.empires[game.playerEmpireId].companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                {selectedEntity.type === 'Fleet' && game.empires[game.playerEmpireId].fleets.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                            </select>
                        )}
                        <button onClick={() => setShowState(!showState)} className={styles.inspectBtn} style={{ whiteSpace: 'nowrap' }}>
                            {showState ? 'Hide' : 'Inspect'}
                        </button>
                    </div>
                </section>

                {showState && (
                    <div className={styles.stateViewer}>
                        <pre>{JSON.stringify(
                            (() => {
                                if (selectedEntity.type === 'Full') return game;
                                if (selectedEntity.type === 'Colony') return game.colonies[selectedEntity.id];
                                if (selectedEntity.type === 'Company') return game.empires[game.playerEmpireId].companies.find(c => c.id === selectedEntity.id);
                                if (selectedEntity.type === 'Fleet') return game.empires[game.playerEmpireId].fleets.find(f => f.id === selectedEntity.id);
                                return game;
                            })()
                            , (key, value) => {
                                if (key === 'history') return `[...${value.length} snapshots]`;
                                return value;
                            }, 2)}</pre>
                    </div>
                )}
            </div>
        </div>
    );
}
