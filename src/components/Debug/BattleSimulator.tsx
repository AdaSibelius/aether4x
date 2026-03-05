'use client';
import React, { useState, useMemo } from 'react';
import { useGameStore } from '@/store/gameStore';
import { runBattleSim } from '@/engine/debug';
import { BattleReport, BattleRound } from '@/engine/combat';
import styles from './DebugConsole.module.css';

// ─── Sub-components ───────────────────────────────────────────────────────────

function HpBar({ pct, color }: { pct: number; color: string }) {
    return (
        <div style={{
            height: 6,
            background: 'rgba(255,255,255,0.06)',
            borderRadius: 3,
            overflow: 'hidden',
            width: '100%',
        }}>
            <div style={{
                height: '100%',
                width: `${Math.max(0, pct)}%`,
                background: color,
                borderRadius: 3,
                transition: 'width 0.2s ease',
            }} />
        </div>
    );
}

function ShipRow({ name, hullPct, shieldPct, destroyed }: {
    name: string; hullPct: number; shieldPct: number; destroyed: boolean;
}) {
    const hullColor = hullPct > 60 ? 'var(--accent-green)' : hullPct > 25 ? 'var(--accent-yellow)' : 'var(--accent-red)';
    return (
        <div style={{ opacity: destroyed ? 0.35 : 1, marginBottom: 6 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, marginBottom: 2 }}>
                <span style={{ color: destroyed ? 'var(--accent-red)' : 'var(--text-primary)' }}>
                    {destroyed ? '💀 ' : ''}{name}
                </span>
                <span style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                    {destroyed ? 'DESTROYED' : `${hullPct}% hull`}
                </span>
            </div>
            {!destroyed && <HpBar pct={hullPct} color={hullColor} />}
            {!destroyed && shieldPct >= 0 && (
                <div style={{ marginTop: 2 }}>
                    <HpBar pct={shieldPct} color='rgba(96,165,250,0.7)' />
                </div>
            )}
        </div>
    );
}

function WinnerBanner({ report }: { report: BattleReport }) {
    const isA = report.winner === 'A';
    const isDraw = report.winner === 'Draw';
    const winnerName = isDraw ? '— DRAW —' : isA ? report.fleetAName : report.fleetBName;
    const bgColor = isDraw
        ? 'rgba(148,163,184,0.1)'
        : isA ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)';
    const borderColor = isDraw
        ? 'rgba(148,163,184,0.2)'
        : isA ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)';

    return (
        <div style={{
            background: bgColor,
            border: `1px solid ${borderColor}`,
            borderRadius: 8,
            padding: '10px 14px',
            textAlign: 'center',
        }}>
            <div style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-muted)', marginBottom: 4 }}>
                Battle Result — {report.rounds.length} round{report.rounds.length !== 1 ? 's' : ''}
            </div>
            <div style={{ fontSize: 14, fontWeight: 700, color: isDraw ? 'var(--text-muted)' : (isA ? 'var(--accent-green)' : 'var(--accent-red)') }}>
                {isDraw ? winnerName : `🏆 ${winnerName}`}
            </div>
            <div style={{ display: 'flex', justifyContent: 'center', gap: 24, marginTop: 8, fontSize: 10, color: 'var(--text-muted)' }}>
                <div>
                    <span style={{ color: 'var(--accent-green)' }}>{report.survivorsA}</span> / {report.rounds[0]?.sideA.length ?? '?'} ships (A)
                </div>
                <div>
                    <span style={{ color: 'var(--accent-red)' }}>{report.survivorsB}</span> / {report.rounds[0]?.sideB.length ?? '?'} ships (B)
                </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'center', gap: 24, marginTop: 4, fontSize: 10, color: 'var(--text-muted)' }}>
                <div>A→B dmg: <span style={{ fontFamily: 'var(--font-mono)' }}>{Math.floor(report.totalDamageAtoB)}</span></div>
                <div>B→A dmg: <span style={{ fontFamily: 'var(--font-mono)' }}>{Math.floor(report.totalDamageBtoA)}</span></div>
            </div>
        </div>
    );
}

function RoundRow({ round, fleetAName, fleetBName }: { round: BattleRound; fleetAName: string; fleetBName: string }) {
    const [open, setOpen] = useState(false);
    return (
        <div style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', paddingBottom: 4, marginBottom: 4 }}>
            <div
                onClick={() => setOpen(o => !o)}
                style={{ display: 'flex', justifyContent: 'space-between', cursor: 'pointer', padding: '3px 0', fontSize: 10 }}
            >
                <span style={{ color: 'var(--text-muted)' }}>Round {round.round}</span>
                <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent-blue)' }}>
                    {Math.floor(round.damageAtoB)} | {Math.floor(round.damageBtoA)} dmg
                </span>
                <span style={{ color: 'var(--text-muted)' }}>{open ? '▲' : '▼'}</span>
            </div>
            {round.destroyedThisRound.length > 0 && (
                <div style={{ fontSize: 9, color: 'var(--accent-red)', paddingLeft: 8 }}>
                    💀 {round.destroyedThisRound.join(', ')}
                </div>
            )}
            {open && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 6, paddingLeft: 4 }}>
                    <div>
                        <div style={{ fontSize: 9, color: 'var(--accent-blue)', marginBottom: 4, textTransform: 'uppercase' }}>{fleetAName}</div>
                        {round.sideA.map(s => <ShipRow key={s.shipId} name={s.shipName} hullPct={s.hullPct} shieldPct={s.shieldPct} destroyed={s.destroyed} />)}
                    </div>
                    <div>
                        <div style={{ fontSize: 9, color: 'var(--accent-red)', marginBottom: 4, textTransform: 'uppercase' }}>{fleetBName}</div>
                        {round.sideB.map(s => <ShipRow key={s.shipId} name={s.shipName} hullPct={s.hullPct} shieldPct={s.shieldPct} destroyed={s.destroyed} />)}
                    </div>
                </div>
            )}
        </div>
    );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function BattleSimulator() {
    const { game } = useGameStore();
    const [fleetAId, setFleetAId] = useState('');
    const [fleetBId, setFleetBId] = useState('');
    const [report, setReport] = useState<BattleReport | null>(null);
    const [showAllRounds, setShowAllRounds] = useState(false);

    // All fleets across all empires with ship counts
    const allFleets = useMemo(() => {
        if (!game) return [];
        return Object.values(game.empires).flatMap(e =>
            e.fleets
                .filter(f => f.shipIds.length > 0)
                .map(f => ({
                    id: f.id,
                    label: `[${e.name}] ${f.name} (${f.shipIds.length} ship${f.shipIds.length !== 1 ? 's' : ''})`,
                    empireId: e.id,
                }))
        );
    }, [game]);

    const canRun = fleetAId && fleetBId && fleetAId !== fleetBId;

    const handleRun = () => {
        if (!game || !canRun) return;
        setShowAllRounds(false);
        const result = runBattleSim(fleetAId, fleetBId, game);
        setReport(result);
    };

    // Key rounds: first round, rounds with kills, last round
    const keyRounds = useMemo(() => {
        if (!report) return [];
        const keys = new Set<number>();
        keys.add(report.rounds[0]?.round);
        keys.add(report.rounds[report.rounds.length - 1]?.round);
        report.rounds.forEach(r => { if (r.destroyedThisRound.length > 0) keys.add(r.round); });
        return report.rounds.filter(r => keys.has(r.round));
    }, [report]);

    const displayedRounds = showAllRounds ? (report?.rounds ?? []) : keyRounds;

    if (!game) return null;

    return (
        <div className={styles.testingArea}>
            <section className={styles.section}>
                <div className={styles.sectionTitle}>Fleet Selection</div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <span style={{ fontSize: 10, color: 'var(--accent-blue)', minWidth: 16 }}>A</span>
                        <select
                            style={{ flex: 1, background: 'var(--bg-card)', fontSize: 10, color: 'var(--text-primary)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 4, padding: '4px 6px' }}
                            value={fleetAId}
                            onChange={e => setFleetAId(e.target.value)}
                        >
                            <option value=''>Choose fleet A…</option>
                            {allFleets.map(f => <option key={f.id} value={f.id}>{f.label}</option>)}
                        </select>
                    </div>

                    <div style={{ textAlign: 'center', fontSize: 10, color: 'var(--text-muted)' }}>vs.</div>

                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <span style={{ fontSize: 10, color: 'var(--accent-red)', minWidth: 16 }}>B</span>
                        <select
                            style={{ flex: 1, background: 'var(--bg-card)', fontSize: 10, color: 'var(--text-primary)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 4, padding: '4px 6px' }}
                            value={fleetBId}
                            onChange={e => setFleetBId(e.target.value)}
                        >
                            <option value=''>Choose fleet B…</option>
                            {allFleets.map(f => <option key={f.id} value={f.id}>{f.label}</option>)}
                        </select>
                    </div>
                </div>

                <button
                    onClick={handleRun}
                    disabled={!canRun}
                    style={{
                        width: '100%',
                        background: canRun ? 'rgba(239,68,68,0.15)' : undefined,
                        borderColor: canRun ? 'rgba(239,68,68,0.35)' : undefined,
                        color: canRun ? 'var(--accent-red)' : undefined,
                        fontWeight: 600,
                        letterSpacing: '0.05em',
                    }}
                >
                    ⚔ Run Battle Simulation
                </button>
            </section>

            {report && (
                <section className={styles.section}>
                    <div className={styles.sectionTitle}>Simulation Result</div>

                    <WinnerBanner report={report} />

                    {report.rounds.length > 0 && (
                        <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                                <div style={{ fontSize: 9, textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.1em' }}>
                                    Round Log {!showAllRounds && report.rounds.length > keyRounds.length ? `(key rounds, ${keyRounds.length}/${report.rounds.length})` : `(all ${report.rounds.length})`}
                                </div>
                                {report.rounds.length > keyRounds.length && (
                                    <button
                                        onClick={() => setShowAllRounds(v => !v)}
                                        style={{ fontSize: 9, padding: '2px 6px', minWidth: 0 }}
                                    >
                                        {showAllRounds ? 'Show Key Only' : 'Show All'}
                                    </button>
                                )}
                            </div>

                            <div style={{ maxHeight: 280, overflowY: 'auto', paddingRight: 4 }}>
                                {displayedRounds.map(r => (
                                    <RoundRow
                                        key={r.round}
                                        round={r}
                                        fleetAName={report.fleetAName}
                                        fleetBName={report.fleetBName}
                                    />
                                ))}
                            </div>
                        </div>
                    )}
                </section>
            )}
        </div>
    );
}
