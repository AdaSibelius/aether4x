'use client';
import React, { useState } from 'react';
import { useGameStore } from '@/store/gameStore';
import { useUIStore } from '@/store/uiStore';
import { calculateEmpireBudget } from '@/engine/finances';
import { BALANCING } from '@/engine/constants';
import { COLONY_TYPE_BONUS } from '@/engine/colonies';
import { getGovernorBonuses } from '@/engine/officers';
import InvestmentHistoryChart from '@/components/ColonyManager/InvestmentHistoryChart';
import LogisticsMonitor from './LogisticsMonitor';
import CorporateExchange from './CorporateExchange';
import styles from './Economy.module.css';

export default function EconomyView() {
    const game = useGameStore(s => s.game);
    const { selectCompany, setView } = useUIStore();
    const [activeTab, setActiveTab] = useState<'Ledger' | 'Logistics' | 'Market'>('Ledger');
    const [selectedColonyId, setSelectedColonyId] = useState<string | undefined>(undefined);

    if (!game) return null;
    const empire = game.empires[game.playerEmpireId];
    if (!empire) return null;

    const budget = calculateEmpireBudget(game, empire.id);
    const colonies = Object.values(game.colonies).filter(c => c.empireId === empire.id);

    const totalPrivateWealth = colonies.reduce((sum, c) => sum + (c.privateWealth || 0), 0);
    const totalCorpWealth = empire.companies?.reduce((sum, c) => sum + c.wealth, 0) || 0;
    const history = empire.history || [];

    // Calculate global mineral production rates
    const mineralRates: Record<string, number> = {};
    for (const mineral of BALANCING.MINERAL_NAMES) {
        mineralRates[mineral] = 0;
    }

    for (const colony of colonies) {
        const bonus = COLONY_TYPE_BONUS[colony.colonyType] ?? COLONY_TYPE_BONUS.Core;
        const infraEff = 0.5 + (colony.infrastructure / 100) * 0.5;
        const govBonuses = getGovernorBonuses(empire.officers || [], colony.governorId);
        const prodBonus = 1 + (govBonuses.all_production ?? 0);
        const mineBonus = 1 + (govBonuses.mining_rate ?? 0);

        const planet = Object.values(game.galaxy.stars).flatMap(s => s.planets).find(p => p.id === colony.planetId);
        if (planet) {
            for (const m of planet.minerals) {
                const rate = (colony.mines + colony.civilianMines) * BALANCING.MINING_RATE_BASE * m.accessibility * (colony.staffingLevel || 0) * bonus.mining * infraEff * mineBonus * prodBonus;
                mineralRates[m.name] = (mineralRates[m.name] || 0) + rate;
            }
        }
    }

    // Aggregate global mineral stockpiles
    const globalStockpiles: Record<string, number> = { ...empire.minerals };
    for (const colony of colonies) {
        for (const [res, amt] of Object.entries(colony.minerals)) {
            globalStockpiles[res] = (globalStockpiles[res] || 0) + amt;
        }
    }

    return (
        <div className={styles.container}>
            <div className={styles.header}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                    <div>
                        <h2>📊 Empire Economy</h2>
                        <div style={{ color: 'var(--text-muted)' }}>Treasury, Civilian Markets, and Strategic Resource Audit</div>
                    </div>
                    <div className={styles.tabHeader}>
                        <button className={`${styles.tabBtn} ${activeTab === 'Ledger' ? styles.activeTab : ''}`} onClick={() => setActiveTab('Ledger')}>Ledger</button>
                        <button className={`${styles.tabBtn} ${activeTab === 'Logistics' ? styles.activeTab : ''}`} onClick={() => setActiveTab('Logistics')}>Logistics</button>
                        <button className={`${styles.tabBtn} ${activeTab === 'Market' ? styles.activeTab : ''}`} onClick={() => setActiveTab('Market')}>Corporate Market</button>
                    </div>
                </div>
            </div>

            {activeTab === 'Ledger' && (
                <>
                    <div className={styles.topStats}>
                        <div className={styles.statCard}>
                            <div className={styles.statLabel}>Public Treasury</div>
                            <div className={styles.statValue} style={{ color: empire.treasury < 0 ? 'var(--accent-red)' : 'var(--accent-blue)' }}>
                                {Math.floor(empire.treasury).toLocaleString()} W
                            </div>
                            <div className={`${styles.statValueSmall} ${budget.netIncome >= 0 ? styles.increase : styles.decrease}`}>
                                {budget.netIncome >= 0 ? '+' : ''}{Math.floor(budget.netIncome).toLocaleString()} / day
                            </div>
                            <Sparkline data={history.map(h => h.treasury)} color="var(--accent-blue)" />
                        </div>
                        <div className={styles.statCard}>
                            <div className={styles.statLabel}>Civilian Wealth</div>
                            <div className={styles.statValue} style={{ color: 'var(--accent-green)' }}>
                                {Math.floor(totalPrivateWealth).toLocaleString()} W
                            </div>
                            <Sparkline data={history.map(h => h.privateWealth)} color="var(--accent-green)" />
                        </div>
                        <div className={styles.statCard}>
                            <div className={styles.statLabel}>Corporate Capital</div>
                            <div className={styles.statValue} style={{ color: '#f1c40f' }}>
                                {Math.floor(totalCorpWealth).toLocaleString()} W
                            </div>
                            <Sparkline data={history.map(h => h.corporateWealth)} color="#f1c40f" />
                        </div>
                    </div>

                    <div className={styles.flowSection}>
                        <div className={styles.panel}>
                            <div className={styles.panelHeader}>Revenue Streams</div>
                            <div className={styles.panelBody}>
                                <div className={styles.revenueFlow}>
                                    {(() => {
                                        const total = (budget.colonyRevenue.taxes + budget.colonyRevenue.corporateFees + budget.colonyRevenue.tradeRevenue) || 1;
                                        const pTax = (budget.colonyRevenue.taxes / total) * 100;
                                        const pCorp = (budget.colonyRevenue.corporateFees / total) * 100;
                                        const pTrade = (budget.colonyRevenue.tradeRevenue / total) * 100;
                                        return (
                                            <>
                                                <div className={styles.flowBar} style={{ width: `${pTax}%`, background: 'var(--accent-blue)' }} title={`Taxes: ${pTax.toFixed(1)}%`} />
                                                <div className={styles.flowBar} style={{ width: `${pCorp}%`, background: '#f1c40f' }} title={`Corp Fees: ${pCorp.toFixed(1)}%`} />
                                                <div className={styles.flowBar} style={{ width: `${pTrade}%`, background: 'var(--accent-green)' }} title={`Trade Share: ${pTrade.toFixed(1)}%`} />
                                            </>
                                        );
                                    })()}
                                </div>
                                <div className={styles.flowLegend}>
                                    <span style={{ color: 'var(--accent-blue)' }}>● Taxes</span>
                                    <span style={{ color: '#f1c40f' }}>● Corporate Fees</span>
                                    <span style={{ color: 'var(--accent-green)' }}>● Trade Revenue</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className={styles.detailsGrid} style={{ gridTemplateColumns: '1fr 1fr' }}>
                        <div className={styles.panel}>
                            <div className={styles.panelHeader}>Financial Ledger</div>
                            <div className={styles.panelBody}>
                                <table className={styles.ledgerTable}>
                                    <thead>
                                        <tr>
                                            <th>Category</th>
                                            <th style={{ textAlign: 'right' }}>Daily (W)</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        <tr className={styles.ledgerCategory}><td colSpan={2}>Revenue</td></tr>
                                        <tr>
                                            <td>Population Taxes</td>
                                            <td style={{ textAlign: 'right' }} className={styles.increase}>{Math.floor(budget.colonyRevenue.taxes).toLocaleString()}</td>
                                        </tr>
                                        <tr>
                                            <td>Corporate Fees</td>
                                            <td style={{ textAlign: 'right' }} className={styles.increase}>{Math.floor(budget.colonyRevenue.corporateFees).toLocaleString()}</td>
                                        </tr>
                                        <tr>
                                            <td>Trade Revenue Share</td>
                                            <td style={{ textAlign: 'right' }} className={styles.increase}>{Math.floor(budget.colonyRevenue.tradeRevenue).toLocaleString()}</td>
                                        </tr>

                                        <tr className={styles.ledgerCategory}><td colSpan={2}>Expenses</td></tr>
                                        <tr>
                                            <td>Facility Maintenance</td>
                                            <td style={{ textAlign: 'right' }} className={styles.decrease}>-{Math.floor(budget.maintenance.facilities).toLocaleString()}</td>
                                        </tr>
                                        <tr>
                                            <td>Ship Maintenance</td>
                                            <td style={{ textAlign: 'right' }} className={styles.decrease}>-{Math.floor(budget.maintenance.ships).toLocaleString()}</td>
                                        </tr>
                                        <tr>
                                            <td>Officer Salaries</td>
                                            <td style={{ textAlign: 'right' }} className={styles.decrease}>-{Math.floor(budget.salaries).toLocaleString()}</td>
                                        </tr>
                                        <tr>
                                            <td>Administrative Overhead</td>
                                            <td style={{ textAlign: 'right' }} className={styles.decrease}>-{Math.floor(budget.maintenance.offices).toLocaleString()}</td>
                                        </tr>

                                        <tr className={styles.netRow}>
                                            <td>Net Surplus / Deficit</td>
                                            <td style={{ textAlign: 'right' }} className={budget.netIncome >= 0 ? styles.increase : styles.decrease}>
                                                {Math.floor(budget.netIncome).toLocaleString()}
                                            </td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        <div className={styles.panel}>
                            <div className={styles.panelHeader}>Global Mineral Audit</div>
                            <div className={styles.panelBody}>
                                <table className={styles.auditTable}>
                                    <thead>
                                        <tr>
                                            <th>Mineral</th>
                                            <th style={{ textAlign: 'right' }}>Stockpile</th>
                                            <th style={{ textAlign: 'right' }}>Daily Net</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {BALANCING.MINERAL_NAMES.map(m => (
                                            <tr key={m}>
                                                <td style={{ color: 'var(--text-secondary)' }}>{m}</td>
                                                <td style={{ textAlign: 'right' }}>{Math.floor(globalStockpiles[m] || 0).toLocaleString()}</td>
                                                <td style={{ textAlign: 'right' }} className={mineralRates[m] > 0 ? styles.increase : ''}>
                                                    {mineralRates[m] > 0 ? '+' : ''}{mineralRates[m].toFixed(1)}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </>
            )}

            {activeTab === 'Logistics' && <LogisticsMonitor />}

            {activeTab === 'Market' && <CorporateExchange />}

            {activeTab === 'Ledger' && (
                <>
                    <div className={styles.ledgerSection}>
                        <div className={styles.panel}>
                            <div className={styles.panelHeader}>🏛️ Colonial Investment Audit</div>
                            <div className={styles.panelBody}>
                                {(() => {
                                    const currentColonyId = selectedColonyId || colonies[0]?.id;
                                    const selectedColony = game.colonies[currentColonyId];

                                    return (
                                        <>
                                            <div style={{ marginBottom: 16, display: 'flex', gap: 12, alignItems: 'center' }}>
                                                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Select Colony:</span>
                                                <select
                                                    value={currentColonyId}
                                                    onChange={e => setSelectedColonyId(e.target.value)}
                                                    style={{
                                                        background: 'var(--bg-input)',
                                                        border: '1px solid var(--border-color)',
                                                        color: 'var(--text-primary)',
                                                        fontSize: 12,
                                                        padding: '4px 8px',
                                                        borderRadius: 4
                                                    }}
                                                >
                                                    {colonies.map(c => (
                                                        <option key={c.id} value={c.id}>{c.name}</option>
                                                    ))}
                                                </select>
                                            </div>
                                            {selectedColony ? (
                                                <InvestmentHistoryChart history={selectedColony.history || []} height={250} />
                                            ) : (
                                                <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 13, padding: 40 }}>
                                                    No colonies found.
                                                </div>
                                            )}
                                        </>
                                    );
                                })()}
                            </div>
                        </div>
                    </div>

                    <div className={styles.ledgerSection}>
                        <div className={styles.panel}>
                            <div className={styles.panelHeader}>History (Empire-Wide Treasury)</div>
                            <div className={styles.panelBody} style={{ height: 180, display: 'flex', alignItems: 'flex-end', gap: 4, paddingBottom: 30 }}>
                                {history.length === 0 ? (
                                    <div style={{ width: '100%', textAlign: 'center', color: 'var(--text-muted)' }}>Historical data being gathered...</div>
                                ) : (
                                    history.map((snap, i) => {
                                        const total = snap.treasury + snap.privateWealth + snap.corporateWealth;
                                        const maxW = Math.max(...history.map(h => h.treasury + h.privateWealth + h.corporateWealth));
                                        const height = (total / maxW) * 100;
                                        return (
                                            <div key={i} className={styles.historyBar} style={{ height: `${height}%`, flex: 1 }} title={`Cycle ${snap.turn}: ${Math.floor(total)}W`} />
                                        );
                                    })
                                )}
                            </div>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}

function Sparkline({ data, color }: { data: number[], color: string }) {
    if (data.length < 2) return <div style={{ height: 20 }} />;
    const min = Math.min(...data);
    const max = Math.max(...data);
    const range = max - min || 1;
    const points = data.map((d, i) => `${(i / (data.length - 1)) * 100},${100 - ((d - min) / range) * 100}`).join(' ');

    return (
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className={styles.sparkline}>
            <polyline points={points} fill="none" stroke={color} strokeWidth="2" vectorEffect="non-scaling-stroke" />
        </svg>
    );
}
