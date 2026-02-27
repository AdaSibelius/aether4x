'use client';
import React from 'react';
import {
    ResponsiveContainer,
    AreaChart,
    Area,
    XAxis,
    YAxis,
    Tooltip,
    CartesianGrid,
    Legend
} from 'recharts';
import { ColonySnapshot } from '@/types';

interface Props {
    history: ColonySnapshot[];
    height?: number;
}

export default function InvestmentHistoryChart({ history, height = 200 }: Props) {
    if (!history || history.length < 2) {
        return (
            <div style={{
                height,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--text-muted)',
                fontSize: 12,
                border: '1px dashed var(--border-color)',
                borderRadius: 4
            }}>
                Gathering historical data (snapshots every 30 days)...
            </div>
        );
    }

    // Format data for ReCharts
    const data = history.map(snap => ({
        name: snap.turn.toString(),
        dateLabel: snap.date ? new Date(snap.date).toLocaleDateString() : `Turn ${snap.turn}`,
        wealth: Math.floor(snap.privateWealth || 0),
        factories: snap.civilianFactories || 0,
        mines: snap.civilianMines || 0,
        totalFacilities: (snap.civilianFactories || 0) + (snap.civilianMines || 0)
    }));

    const CustomTooltip = ({ active, payload, label }: any) => {
        if (active && payload && payload.length) {
            return (
                <div style={{
                    backgroundColor: 'var(--bg-panel)',
                    border: '1px solid var(--border-color)',
                    padding: '8px',
                    fontSize: '11px',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.5)'
                }}>
                    <div style={{ color: 'var(--text-secondary)', marginBottom: 4 }}>{payload[0].payload.dateLabel}</div>
                    {payload.map((entry: any, index: number) => (
                        <div key={index} style={{ color: entry.color, display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                            <span>{entry.name}:</span>
                            <span style={{ fontWeight: 600 }}>{entry.value.toLocaleString()}</span>
                        </div>
                    ))}
                </div>
            );
        }
        return null;
    };

    return (
        <div style={{ width: '100%', height }}>
            <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <defs>
                        <linearGradient id="colorWealth" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="var(--accent-green)" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="var(--accent-green)" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="colorFacilities" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="var(--accent-blue)" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="var(--accent-blue)" stopOpacity={0} />
                        </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" vertical={false} opacity={0.2} />
                    <XAxis
                        dataKey="name"
                        hide
                    />
                    <YAxis
                        yAxisId="left"
                        orientation="left"
                        stroke="var(--accent-green)"
                        fontSize={10}
                        tickFormatter={(val) => `${(val / 1000).toFixed(0)}k`}
                        axisLine={false}
                        tickLine={false}
                    />
                    <YAxis
                        yAxisId="right"
                        orientation="right"
                        stroke="var(--accent-blue)"
                        fontSize={10}
                        axisLine={false}
                        tickLine={false}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend iconType="rect" wrapperStyle={{ fontSize: 10, paddingTop: 10 }} />
                    <Area
                        yAxisId="left"
                        type="monotone"
                        dataKey="wealth"
                        name="Private Wealth (W)"
                        stroke="var(--accent-green)"
                        fillOpacity={1}
                        fill="url(#colorWealth)"
                        strokeWidth={2}
                    />
                    <Area
                        yAxisId="right"
                        type="stepAfter"
                        dataKey="totalFacilities"
                        name="Civilian Facilities"
                        stroke="var(--accent-blue)"
                        fillOpacity={1}
                        fill="url(#colorFacilities)"
                        strokeWidth={2}
                    />
                </AreaChart>
            </ResponsiveContainer>
        </div>
    );
}
