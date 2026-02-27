'use client';
import { useState } from 'react';
import { useGameStore } from '@/store/gameStore';
import { useUIStore } from '@/store/uiStore';
import CompanyHQGenerator from './CompanyHQGenerator';
import PortraitGenerator from '../Officers/PortraitGenerator';
import styles from './Economy.module.css';
import {
    LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area,
    BarChart, Bar, Legend, Cell
} from 'recharts';
import { CompanyStrategy } from '@/types';

export default function CompanyDetailsView({ isEmbedded }: { isEmbedded?: boolean }) {
    const game = useGameStore(s => s.game);
    const { selectedCompanyId, setView } = useUIStore();
    const [activeTab, setActiveTab] = useState<'overview' | 'financials' | 'ledger' | 'strategy'>('overview');

    if (!game || !selectedCompanyId) return null;
    const empire = game.empires[game.playerEmpireId];
    if (!empire) return null;

    const company = empire.companies?.find(c => c.id === selectedCompanyId);
    if (!company) {
        return (
            <div className={styles.container}>
                <button className="btn" onClick={() => setView('Economy')}>← Back to Economy</button>
                <div style={{ marginTop: 20 }}>Company not found.</div>
            </div>
        );
    }

    const homeColony = Object.values(game.colonies).find(c => c.id === company.homeColonyId);
    const ceo = empire.officers.find(o => o.id === company.ceoId);

    const onSubsidize = () => {
        if (empire.treasury >= 5000) {
            const nextGame = structuredClone(game);
            const e = nextGame.empires[nextGame.playerEmpireId];
            e.treasury -= 5000;
            const c = e.companies?.find(comp => comp.id === company.id);
            if (c) {
                c.wealth += 5000;
                c.transactions.push({
                    date: new Date().toISOString(),
                    amount: 5000,
                    type: 'Grant',
                    description: 'State Modernization Grant'
                });
            }
            useGameStore.setState({ game: nextGame });
        }
    };

    const onUpdateStrategy = (strat: CompanyStrategy) => {
        const nextGame = structuredClone(game);
        const e = nextGame.empires[nextGame.playerEmpireId];
        const c = e.companies?.find(comp => comp.id === company.id);
        if (c) c.strategy = strat;
        useGameStore.setState({ game: nextGame });
    };

    // Prepare chart data
    const chartData = company.history.map(h => ({
        date: new Date(h.date).toLocaleDateString(),
        wealth: Math.floor(h.wealth),
        valuation: Math.floor(h.valuation),
        revenue: Math.floor(h.revenue),
        expenses: Math.floor(h.expenses)
    }));

    // Transaction summary for pie/bar?
    const txSummary = [
        { name: 'Revenue', value: company.history[company.history.length - 1]?.revenue || 0, color: '#3498db' },
        { name: 'Expenses', value: company.history[company.history.length - 1]?.expenses || 0, color: '#e74c3c' }
    ];

    return (
        <div className={styles.container} style={isEmbedded ? { padding: 24, background: 'transparent', border: 'none' } : {}}>
            {!isEmbedded && (
                <div className={styles.navRow}>
                    <button className="btn" onClick={() => setView('Economy')}>← Back to Register</button>
                </div>
            )}

            <div className={styles.header}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                        <h2 style={{ display: 'flex', alignItems: 'center', gap: 12, margin: 0 }}>
                            {company.type === 'Transport' ? '🚀' : company.type === 'Extraction' ? '⛏️' : '🏭'}
                            {company.name}
                        </h2>
                        <div style={{ color: 'var(--text-muted)' }}>Registered {company.type} Corporation</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Market Valuation</div>
                        <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--accent-blue)', fontFamily: 'var(--font-mono)' }}>
                            {Math.floor(company.valuation).toLocaleString()} W
                        </div>
                    </div>
                </div>
            </div>

            {/* Tabbed Navigation */}
            <div className={styles.tabHeader}>
                <button className={`${styles.tabBtn} ${activeTab === 'overview' ? styles.activeTab : ''}`} onClick={() => setActiveTab('overview')}>Overview</button>
                <button className={`${styles.tabBtn} ${activeTab === 'financials' ? styles.activeTab : ''}`} onClick={() => setActiveTab('financials')}>Financials</button>
                <button className={`${styles.tabBtn} ${activeTab === 'ledger' ? styles.activeTab : ''}`} onClick={() => setActiveTab('ledger')}>Ledger</button>
                <button className={`${styles.tabBtn} ${activeTab === 'strategy' ? styles.activeTab : ''}`} onClick={() => setActiveTab('strategy')}>Strategy</button>
            </div>

            <div className={styles.detailsGrid}>
                {/* Left Column: Fixed Info */}
                <div className={styles.hqColumn}>
                    <div className={styles.panel}>
                        <div className={styles.panelHeader}>Corporate Headquarters</div>
                        <div className={styles.panelBody} style={{ padding: 0 }}>
                            <CompanyHQGenerator company={company} width={300} height={200} />
                            <div style={{ padding: 16, fontSize: 13 }}>
                                <div style={{ color: 'var(--text-muted)' }}>Primary Campus</div>
                                <div style={{ marginBottom: 8 }}><strong style={{ color: 'var(--accent-blue)' }}>{homeColony?.name || 'Unknown'}</strong> Orbit</div>
                                <div className={styles.divider} />
                                <div className={styles.statRow}>
                                    <span>Liquid Assets:</span>
                                    <span style={{ color: 'var(--accent-green)', fontWeight: 600 }}>{Math.floor(company.wealth).toLocaleString()} W</span>
                                </div>
                                <div className={styles.statRow}>
                                    <span>Asset Inventory:</span>
                                    <span style={{ color: 'var(--text-muted)' }}>
                                        {company.type === 'Transport' && `${company.activeFreighters.toLocaleString()} Hulls`}
                                        {company.type === 'Extraction' && `${homeColony?.civilianMines ?? 0} Mng. Units`}
                                        {company.type === 'Manufacturing' && `${homeColony?.civilianFactories ?? 0} Fact. Units`}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className={styles.panel} style={{ marginTop: 16 }}>
                        <div className={styles.panelHeader}>Chief Executive</div>
                        <div className={styles.panelBody}>
                            {ceo ? (
                                <div className={styles.ceoProfile} style={{ flexDirection: 'column', gap: 12 }}>
                                    <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                                        <PortraitGenerator seed={ceo.portraitSeed} role={ceo.role} size={64} />
                                        <div>
                                            <div style={{ fontSize: 16, fontWeight: 700 }}>{ceo.name}</div>
                                            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Lvl {ceo.level} Executive</div>
                                        </div>
                                    </div>
                                    <div className={styles.traitList}>
                                        {ceo.traits.map(t => (
                                            <span key={t} className={styles.traitBadge} style={{ fontSize: 10, padding: '2px 6px' }}>{t}</span>
                                        ))}
                                    </div>
                                </div>
                            ) : (
                                <div style={{ color: 'var(--text-muted)', fontSize: 12 }}>No active CEO assigned.</div>
                            )}
                        </div>
                    </div>

                    <div className={styles.panel} style={{ marginTop: 16 }}>
                        <div className={styles.panelHeader}>Mining Licenses</div>
                        <div className={styles.panelBody}>
                            {company.explorationLicenseIds.length === 0 ? (
                                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>No active system licenses.</div>
                            ) : (
                                <ul style={{ margin: 0, paddingLeft: 16, fontSize: 12, display: 'flex', flexDirection: 'column', gap: 4 }}>
                                    {company.explorationLicenseIds.map(id => {
                                        const system = Object.values(game.galaxy.stars).find(s => s.id === id);
                                        return <li key={id} style={{ color: 'var(--accent-blue)' }}>{system?.name || 'Unknown System'}</li>;
                                    })}
                                </ul>
                            )}
                        </div>
                    </div>
                </div>

                {/* Right Column: Dynamic Content */}
                <div className={styles.ceoColumn}>
                    {activeTab === 'overview' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                            <div className={styles.panel}>
                                <div className={styles.panelHeader}>Valuation Performance</div>
                                <div className={styles.panelBody} style={{ height: 300 }}>
                                    <ResponsiveContainer width="100%" height="100%">
                                        <AreaChart data={chartData}>
                                            <defs>
                                                <linearGradient id="colorVal" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="5%" stopColor="#3498db" stopOpacity={0.3} />
                                                    <stop offset="95%" stopColor="#3498db" stopOpacity={0} />
                                                </linearGradient>
                                            </defs>
                                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                                            <XAxis dataKey="date" stroke="rgba(255,255,255,0.3)" fontSize={10} />
                                            <YAxis stroke="rgba(255,255,255,0.3)" fontSize={10} />
                                            <Tooltip
                                                contentStyle={{ background: '#1a1a2e', border: '1px solid var(--border)', fontSize: 12 }}
                                                itemStyle={{ color: 'var(--accent-blue)' }}
                                            />
                                            <Area type="monotone" dataKey="valuation" stroke="#3498db" fillOpacity={1} fill="url(#colorVal)" />
                                        </AreaChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>

                            <div className={styles.panel}>
                                <div className={styles.panelHeader}>Strategic Subsidies</div>
                                <div className={styles.panelBody}>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 200px', gap: 24, alignItems: 'center' }}>
                                        <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: 0 }}>
                                            The State can issue "Modernization Grants" to private entities. This wealth is used by the corporation
                                            to build new civilian infrastructure (Mines, Factories, Freighters) in their home colony.
                                        </p>
                                        <button
                                            className="btn"
                                            disabled={empire.treasury < 5000}
                                            onClick={onSubsidize}
                                        >
                                            Grant 5,000 W
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'financials' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                            <div className={styles.panel}>
                                <div className={styles.panelHeader}>Profit & Loss Analysis</div>
                                <div className={styles.panelBody} style={{ height: 300 }}>
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={chartData}>
                                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                                            <XAxis dataKey="date" stroke="rgba(255,255,255,0.3)" fontSize={10} />
                                            <YAxis stroke="rgba(255,255,255,0.3)" fontSize={10} />
                                            <Tooltip contentStyle={{ background: '#1a1a2e', border: '1px solid var(--border)', fontSize: 12 }} />
                                            <Legend verticalAlign="top" height={36} />
                                            <Bar dataKey="revenue" name="Gross Revenue" fill="#2ecc71" radius={[4, 4, 0, 0]} />
                                            <Bar dataKey="expenses" name="Operating Expenses" fill="#e74c3c" radius={[4, 4, 0, 0]} />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'ledger' && (
                        <div className={styles.panel}>
                            <div className={styles.panelHeader}>Transaction Ledger</div>
                            <div className={styles.panelBody} style={{ padding: 0 }}>
                                <table className={styles.ledgerTable}>
                                    <thead>
                                        <tr>
                                            <th>Date</th>
                                            <th>Type</th>
                                            <th>Description</th>
                                            <th style={{ textAlign: 'right' }}>Amount</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {[...company.transactions].reverse().map((tx, idx) => (
                                            <tr key={idx}>
                                                <td style={{ color: 'var(--text-muted)', fontSize: 11 }}>{new Date(tx.date).toLocaleDateString()}</td>
                                                <td>
                                                    <span className={styles.traitBadge} style={{
                                                        fontSize: 10,
                                                        background: tx.type === 'Income' ? 'rgba(46, 204, 113, 0.1)' :
                                                            tx.type === 'Grant' ? 'rgba(52, 152, 219, 0.1)' : 'rgba(231, 76, 60, 0.1)',
                                                        color: tx.type === 'Income' ? '#2ecc71' :
                                                            tx.type === 'Grant' ? '#3498db' : '#e74c3c'
                                                    }}>
                                                        {tx.type}
                                                    </span>
                                                </td>
                                                <td style={{ fontSize: 12 }}>{tx.description}</td>
                                                <td style={{
                                                    textAlign: 'right',
                                                    fontWeight: 600,
                                                    color: tx.type === 'Income' || tx.type === 'Grant' ? 'var(--accent-green)' : 'var(--accent-red)'
                                                }}>
                                                    {tx.type === 'Income' || tx.type === 'Grant' ? '+' : '-'}{Math.floor(tx.amount).toLocaleString()} W
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {activeTab === 'strategy' && (
                        <div className={styles.panel}>
                            <div className={styles.panelHeader}>Operational Strategy</div>
                            <div className={styles.panelBody}>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                                    <div className={styles.panel}>
                                        <h3>Corporate Mandate: {company.strategy}</h3>
                                        <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>
                                            {company.strategy === 'Expansionist' && 'Focuses on aggressive scale and market share. Outbids rivals for licenses and expands fleets rapidly.'}
                                            {company.strategy === 'Optimized' && 'Focuses on lean operations and stability. Benefits from -30% lower asset maintenance costs.'}
                                            {company.strategy === 'Vanguard' && 'Focuses on innovation and quality. Favors high-performance prototypes and rapid tech adoption.'}
                                        </p>

                                        <div style={{ marginTop: 20, padding: 12, backgroundColor: 'rgba(0,0,0,0.2)', borderRadius: 4, borderLeft: `4px solid ${company.strategy === 'Expansionist' ? 'var(--accent-red)' : company.strategy === 'Vanguard' ? 'var(--accent-green)' : 'var(--accent-blue)'}` }}>
                                            <div style={{ fontSize: 12, fontWeight: 'bold', marginBottom: 4 }}>INTERNAL STRATEGY POLICY</div>
                                            <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                                                Strategy is determined by the CEO and Board of Directors. Shareholders (including the State) cannot directly override corporate policy.
                                                To influence direction, consider providing targeted grants or changing state licensing fees.
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
