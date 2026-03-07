'use client';
import React from 'react';
import { useGameStore } from '@/store/gameStore';
import styles from './Economy.module.css';

export default function LogisticsMonitor() {
    const game = useGameStore(s => s.game);
    if (!game) return null;

    const empire = game.empires[game.playerEmpireId];
    if (!empire) return null;

    const colonies = Object.values(game.colonies).filter(c => c.empireId === empire.id);

    // Identify shortages
    const shortages: { colonyName: string, res: string, amount: number }[] = [];
    for (const c of colonies) {
        if (c.demand) {
            for (const [res, amt] of Object.entries(c.demand)) {
                if (amt > 1) {
                    shortages.push({ colonyName: c.name, res, amount: amt });
                }
            }
        }
    }

    // Identify surplus (Stockpile > 1000)
    const surpluses: { colonyName: string, res: string, amount: number }[] = [];
    for (const c of colonies) {
        for (const [res, amt] of Object.entries(c.minerals)) {
            if (amt > 1000) {
                surpluses.push({ colonyName: c.name, res, amount: amt });
            }
        }
    }

    // Corporate Freighters (simplified detection)
    const activeFreighters = empire.fleets.filter(f => f.shipIds.some((sid: string) => {
        const ship = game.ships[sid];
        const design = empire.designLibrary.find(d => d.id === ship?.designId);
        return design?.role === 'Freighter';
    }));

    return (
        <div className={styles.detailsGrid} style={{ gridTemplateColumns: '1fr 1fr' }}>
            <div className={styles.panel}>
                <div className={styles.panelHeader}>📦 Physical Shortages & Demand</div>
                <div className={styles.panelBody}>
                    {shortages.length === 0 ? (
                        <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
                            No critical shortages detected. Supply lines are stable.
                        </div>
                    ) : (
                        <table className={styles.ledgerTable}>
                            <thead>
                                <tr>
                                    <th>Colony</th>
                                    <th>Mineral</th>
                                    <th style={{ textAlign: 'right' }}>Deficit</th>
                                </tr>
                            </thead>
                            <tbody>
                                {shortages.slice(0, 8).map((s, i) => (
                                    <tr key={i}>
                                        <td>
                                            <div className={styles.ledgerLabel}>
                                                <span className={styles.ledgerIcon}>🪐</span>
                                                <span className={styles.ledgerName}>{s.colonyName}</span>
                                            </div>
                                        </td>
                                        <td style={{ color: 'var(--accent-red)' }}>
                                            <div className={styles.ledgerLabel}>
                                                <span className={styles.ledgerIcon}><img src={`/minerals/${s.res.toLowerCase()}.png`} alt={s.res} width={16} height={16} style={{ imageRendering: 'pixelated' as const, borderRadius: 2 }} /></span>
                                                <span className={styles.ledgerName}>{s.res}</span>
                                            </div>
                                        </td>
                                        <td className={styles.ledgerValue} style={{ textAlign: 'right' }}>
                                            <span className={styles.decrease}>-{Math.floor(s.amount).toLocaleString()}</span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>

            <div className={styles.panel}>
                <div className={styles.panelHeader}>🚢 Active Freight Operations</div>
                <div className={styles.panelBody}>
                    {activeFreighters.length === 0 ? (
                        <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
                            No active corporate freight routes.
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                            {activeFreighters.slice(0, 5).map(f => (
                                <div key={f.id} style={{
                                    background: 'var(--bg-input)',
                                    padding: '8px 12px',
                                    borderRadius: 4,
                                    borderLeft: '3px solid var(--accent-blue)',
                                    fontSize: 12
                                }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                                        <span style={{ fontWeight: 'bold', color: 'var(--text-primary)' }}>{f.name}</span>
                                        <span style={{ color: 'var(--text-muted)' }}>{f.destination ? 'TRANSIT' : 'ORBIT'}</span>
                                    </div>
                                    <div style={{ color: 'var(--text-secondary)' }}>
                                        {f.orders && f.orders.length > 0 ? (
                                            <>Executing: <span style={{ color: 'var(--accent-blue)' }}>{f.orders[0].type}</span></>
                                        ) : 'Awaiting Cargo Assignment'}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    <div style={{ marginTop: 16, borderTop: '1px solid var(--border-color)', paddingTop: 12 }}>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                            Top Export Surplus
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                            {surpluses.slice(0, 6).map((s, i) => (
                                <div key={i} title={`${s.colonyName}: ${Math.floor(s.amount)}t`} style={{
                                    background: 'rgba(46, 204, 113, 0.1)',
                                    color: 'var(--accent-green)',
                                    padding: '2px 8px',
                                    borderRadius: 10,
                                    fontSize: 10,
                                    border: '1px solid rgba(46, 204, 113, 0.2)'
                                }}>
                                    {s.colonyName}: {s.res}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
