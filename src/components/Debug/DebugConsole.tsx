'use client';
import React, { useState, useEffect } from 'react';
import { useGameStore } from '@/store/gameStore';
import { useUIStore } from '@/store/uiStore';
import styles from './DebugConsole.module.css';

import SimLogger from '@/utils/logger';
import BattleSimulator from './BattleSimulator';

export default function DebugConsole() {
    const { showDebugConsole, toggleDebugConsole } = useUIStore();
    const [activeTab, setActiveTab] = useState<'Game Master' | 'State Management' | 'Entity Inspector' | 'Combat Sim'>('Game Master');
    const [showState, setShowState] = useState(false);
    const [snapshotName, setSnapshotName] = useState('');
    const [isTracing, setIsTracing] = useState(false);
    const [selectedEntity, setSelectedEntity] = useState<{ type: 'Colony' | 'Company' | 'Fleet' | 'Empire' | 'Full', id: string }>({ type: 'Full', id: '' });

    const { game, debug, snapshots, createSnapshot, loadSnapshot, deleteSnapshot, switchPlayerEmpire } = useGameStore();
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

    return (
        <div className={styles.container}>
            <div className={styles.content}>
                <div className={styles.header}>
                    <span>Developer Console</span>
                    <button className={styles.closeBtn} onClick={toggleDebugConsole}>×</button>
                </div>

                <div className={styles.tabs}>
                    {(['Game Master', 'State Management', 'Entity Inspector', 'Combat Sim'] as const).map(tab => (
                        <button
                            key={tab}
                            className={`${styles.tabBtn} ${activeTab === tab ? styles.active : ''}`}
                            onClick={() => setActiveTab(tab)}
                        >
                            {tab}
                        </button>
                    ))}
                </div>

                {activeTab === 'Game Master' && (
                    <>
                        <section className={styles.section}>
                            <div className={styles.sectionTitle}>Logging & UI</div>
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
                            <div className={styles.sectionTitle}>Resource Injection</div>
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
                            <div className={styles.sectionTitle}>Switch Player View</div>
                            <div className={styles.buttonGrid}>
                                {Object.values(game.empires).map(emp => (
                                    <button
                                        key={emp.id}
                                        onClick={() => switchPlayerEmpire(emp.id)}
                                        className={game.playerEmpireId === emp.id ? styles.active : ''}
                                        style={{ borderLeft: `4px solid ${emp.color}` }}
                                    >
                                        {emp.name} {emp.isPlayer ? '(P)' : '(AI)'}
                                    </button>
                                ))}
                            </div>
                        </section>

                        <section className={styles.section}>
                            <div className={styles.sectionTitle}>Time & Automation</div>
                            <div className={styles.buttonGrid}>
                                <button onClick={() => debug.timeWarp(30)}>Warp 1 Month</button>
                                <button onClick={() => debug.timeWarp(365)}>Warp 1 Year</button>
                                <button onClick={() => selectedColonyId && debug.instantQueue(selectedColonyId)} disabled={!selectedColonyId}>
                                    Instant Build (Top)
                                </button>
                            </div>
                        </section>

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
                    </>
                )}

                {activeTab === 'State Management' && (
                    <div className={styles.snapshotsArea}>
                        <div className={styles.saveForm}>
                            <input
                                type="text"
                                placeholder="Snapshot Name"
                                value={snapshotName}
                                onChange={e => setSnapshotName(e.target.value)}
                            />
                            <button onClick={() => { createSnapshot(snapshotName || 'Manual Save'); setSnapshotName(''); }}>
                                Save Memory Snapshot
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

                        <div className={styles.debugSection} style={{ marginTop: 16 }}>
                            <h4>Headless Simulation Result</h4>
                            <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>Imports the 'sim_output.json' file generated by headless scenarios.</p>
                            <button onClick={async () => {
                                try {
                                    const response = await fetch('/sim_output.json');
                                    if (!response.ok) throw new Error('Failed to fetch sim_output.json');
                                    const state = await response.json();
                                    useGameStore.getState().loadExternalState(state);
                                } catch (err) {
                                    console.error(err);
                                    alert('Could not load simulation result. Make sure the script was run and public/sim_output.json exists.');
                                }
                            }}>
                                Import Last Headless Sim
                            </button>
                        </div>
                    </div>
                )}

                {activeTab === 'Entity Inspector' && (
                    <div className={styles.testingArea}>
                        <section className={styles.section}>
                            <div className={styles.sectionTitle}>Global Markets</div>
                            <div className={styles.marketGrid}>
                                <div className={styles.marketHeader}>Colony</div>
                                <div className={styles.marketHeader}>Consumer Goods</div>
                                <div className={styles.marketHeader}>Food</div>
                                <div className={styles.marketHeader}>Durasteel</div>

                                {Object.values(game.colonies).map(colony => (
                                    <React.Fragment key={colony.id}>
                                        <div className={styles.colonyName}>{colony.name}</div>
                                        <div className={styles.priceData}>
                                            <span className={styles.priceValue}>{colony.resourcePrices?.ConsumerGoods?.toFixed(2) || '0.00'} W</span>
                                            <span className={styles.stockValue}>({Math.floor(colony.minerals.ConsumerGoods || 0)})</span>
                                        </div>
                                        <div className={styles.priceData}>
                                            <span className={styles.priceValue}>{colony.resourcePrices?.Food?.toFixed(2) || '0.00'} W</span>
                                            <span className={styles.stockValue}>({Math.floor(colony.minerals.Food || 0)})</span>
                                        </div>
                                        <div className={styles.priceData}>
                                            <span className={styles.priceValue}>{colony.resourcePrices?.Durasteel?.toFixed(2) || '0.00'} W</span>
                                            <span className={styles.stockValue}>({Math.floor(colony.minerals.Durasteel || 0)})</span>
                                        </div>
                                    </React.Fragment>
                                ))}
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
