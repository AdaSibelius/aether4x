'use client';
import React, { useMemo } from 'react';
import { useGameStore } from '@/store/gameStore';
import { Company, CompanyType } from '@/types';
import {
    LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as ReTooltip, ResponsiveContainer,
    PieChart, Pie, Cell, Legend,
    BarChart, Bar
} from 'recharts';
import styles from './Economy.module.css';

const SECTOR_COLORS: Record<string, string> = {
    Transport: '#3498db',
    Extraction: '#e67e22',
    Manufacturing: '#9b59b6',
    Agricultural: '#2ecc71',
    Commercial: '#f1c40f'
};

export default function CorporateExchange() {
    const game = useGameStore(s => s.game);
    if (!game) return null;

    const empire = game.empires[game.playerEmpireId];
    const companies = empire.companies || [];

    const sortedCompanies = useMemo(() => {
        return [...companies].sort((a, b) => b.valuation - a.valuation);
    }, [companies]);

    // Data for Pie Chart: Sector Distribution
    const sectorData = useMemo(() => {
        const counts: Record<string, number> = {};
        companies.forEach(c => {
            counts[c.type] = (counts[c.type] || 0) + c.valuation;
        });
        return Object.entries(counts).map(([name, value]) => ({ name, value }));
    }, [companies]);

    // Data for Line Chart: Top 5 Companies History
    const historyData = useMemo(() => {
        if (companies.length === 0) return [];

        // Pivot data for Recharts: { date: '...', CompanyA: val, CompanyB: val }
        const allDates = Array.from(new Set(companies.flatMap(c => (c.history || []).map(h => h.date)))).sort();

        return allDates.map(date => {
            const entry: any = { date };
            sortedCompanies.slice(0, 5).forEach(c => {
                const history = c.history || [];
                const snap = history.find(h => h.date === date);
                entry[c.name] = snap ? snap.valuation : undefined;
            });
            return entry;
        });
    }, [companies, sortedCompanies]);

    return (
        <div className={styles.exchangeContainer}>
            <div className={styles.chartGrid}>
                <div className={styles.chartCard}>
                    <div className={styles.panelHeader}>Market Valuation Trends (Top 5)</div>
                    <div style={{ height: 250, width: '100%' }}>
                        <ResponsiveContainer>
                            <LineChart data={historyData}>
                                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                                <XAxis dataKey="date" stroke="var(--text-muted)" fontSize={10} />
                                <YAxis stroke="var(--text-muted)" fontSize={10} />
                                <ReTooltip
                                    contentStyle={{ background: 'var(--bg-panel)', border: '1px solid var(--border-color)' }}
                                    itemStyle={{ fontSize: 12 }}
                                />
                                {sortedCompanies.slice(0, 5).map((c, i) => (
                                    <Line
                                        key={c.id}
                                        type="monotone"
                                        dataKey={c.name}
                                        stroke={Object.values(SECTOR_COLORS)[i % 5]}
                                        strokeWidth={2}
                                        dot={false}
                                    />
                                ))}
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                <div className={styles.chartCard}>
                    <div className={styles.panelHeader}>Sectoral Wealth Distribution</div>
                    <div style={{ height: 250, width: '100%' }}>
                        <ResponsiveContainer>
                            <PieChart>
                                <Pie
                                    data={sectorData}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={60}
                                    outerRadius={80}
                                    paddingAngle={5}
                                    dataKey="value"
                                >
                                    {sectorData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={SECTOR_COLORS[entry.name] || '#999'} />
                                    ))}
                                </Pie>
                                <ReTooltip />
                                <Legend wrapperStyle={{ fontSize: 10 }} />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>

            <div className={styles.leaderboardSection}>
                <div className={styles.panel}>
                    <div className={styles.panelHeader}>Market Leaderboard</div>
                    <div className={styles.panelBody}>
                        <table className={styles.exchangeTable}>
                            <thead>
                                <tr>
                                    <th>Rank</th>
                                    <th>Corporation</th>
                                    <th>Sector</th>
                                    <th>Strategy</th>
                                    <th style={{ textAlign: 'right' }}>Capital</th>
                                    <th style={{ textAlign: 'right' }}>Valuation</th>
                                    <th style={{ textAlign: 'right' }}>Licenses</th>
                                </tr>
                            </thead>
                            <tbody>
                                {sortedCompanies.map((c, i) => (
                                    <tr key={c.id}>
                                        <td style={{ color: 'var(--text-muted)', fontSize: 11 }}>#{i + 1}</td>
                                        <td style={{ fontWeight: 600 }}>{c.name}</td>
                                        <td>
                                            <span style={{
                                                fontSize: 10,
                                                padding: '2px 6px',
                                                borderRadius: 4,
                                                background: `${SECTOR_COLORS[c.type]}22`,
                                                color: SECTOR_COLORS[c.type],
                                                border: `1px solid ${SECTOR_COLORS[c.type]}44`
                                            }}>
                                                {c.type}
                                            </span>
                                        </td>
                                        <td style={{ fontSize: 11 }}>{c.strategy}</td>
                                        <td style={{ textAlign: 'right' }}>{Math.floor(c.wealth || 0).toLocaleString()} W</td>
                                        <td style={{ textAlign: 'right', color: 'var(--accent-blue)' }}>{Math.floor(c.valuation || 0).toLocaleString()} W</td>
                                        <td style={{ textAlign: 'right' }}>{(c.explorationLicenseIds || []).length}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            <div className={styles.lobbySection}>
                <div className={styles.panel}>
                    <div className={styles.panelHeader}>⚖️ Corporate Lobby & Influence</div>
                    <div className={styles.panelBody}>
                        <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
                            No active lobbying efforts. Influence accumulates as corporations reach 100,000 W in valuation.
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
