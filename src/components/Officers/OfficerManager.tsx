'use client';
import React, { useState } from 'react';
import { useGameStore } from '@/store/gameStore';
import { useUIStore } from '@/store/uiStore';
import PortraitGenerator from './PortraitGenerator';
import { TRAIT_BY_ID } from '@/engine/officers';
import { TECH_TREE } from '@/engine/research';
import type { Officer, OfficerRole } from '@/types';
import { RosterShell, SidebarSection, RosterGroup, RosterItem, MainArea } from '@/components/Roster/Roster';

// ─── Role badge colors ───────────────────────────────────────────────────────

const ROLE_COLOR: Record<OfficerRole, string> = {
    Admiral: '#d4a843',
    Captain: '#9ca3af',
    Scientist: '#4ade80',
    Engineer: '#f59e0b',
    Governor: '#60a5fa',
    CEO: '#a855f7',
};

const ROLE_ICON: Record<OfficerRole, string> = {
    Admiral: '⚓',
    Captain: '🧭',
    Scientist: '🔬',
    Engineer: '⚙️',
    Governor: '🏛️',
    CEO: '💼',
};

// ─── Component ───────────────────────────────────────────────────────────────

export default function OfficerManager() {
    const game = useGameStore(s => s.game);
    const { selectedOfficerId, selectOfficer } = useUIStore();

    if (!game) return null;
    const empire = game.empires[game.playerEmpireId];
    const officers = empire.officers;

    // Find colonies for assignment
    const colonies = Object.values(game.colonies);

    const selected = officers.find(o => o.id === selectedOfficerId) ?? officers[0] ?? null;

    function getAssignmentLabel(officer: Officer): string {
        if (!officer.assignedTo) return 'Unassigned';
        if (officer.role === 'Governor') {
            const col = colonies.find(c => c.id === officer.assignedTo);
            if (col) return col.name;
        }
        if (officer.role === 'CEO') {
            const companyId = officer.assignedTo.replace('company_', '');
            const company = empire.companies.find(c => c.id === companyId || c.name === companyId);
            if (company) return company.name;
        }
        if (officer.assignedTo?.startsWith('prj_')) {
            const project = empire.research.activeProjects.find(p => p.id === officer.assignedTo);
            if (project) {
                const tech = TECH_TREE.find(t => t.id === project.techId);
                return `Researching ${tech?.name || 'Project'}`;
            }
        }
        return officer.assignedTo;
    }

    function handleAssign(officerId: string, targetId: string | undefined) {
        if (!game) return;
        const store = useGameStore.getState();
        const g = { ...game };
        const emp = { ...g.empires[g.playerEmpireId] };
        const updatedOfficers = emp.officers.map(o => {
            if (o.id === officerId) return { ...o, assignedTo: targetId };
            // Unassign prev governor from this colony
            if (targetId && o.assignedTo === targetId && o.role === 'Governor') return { ...o, assignedTo: undefined };
            return o;
        });
        emp.officers = updatedOfficers;
        g.empires = { ...g.empires, [g.playerEmpireId]: emp };

        // Update colony governor reference
        if (targetId) {
            const col = g.colonies[targetId];
            if (col) {
                g.colonies = { ...g.colonies, [targetId]: { ...col, governorId: officerId } };
            }
        }
        // Clear old colony assignment
        for (const cid of Object.keys(g.colonies)) {
            const c = g.colonies[cid];
            if (c.governorId === officerId && cid !== targetId) {
                g.colonies = { ...g.colonies, [cid]: { ...c, governorId: undefined } };
            }
        }

        store.game = g;
        useGameStore.setState({ game: g });
    }

    return (
        <RosterShell>
            <SidebarSection
                header={
                    <div style={{
                        fontFamily: 'Outfit',
                        fontSize: 11,
                        color: 'var(--accent-blue)',
                        textTransform: 'uppercase',
                        letterSpacing: '0.1em',
                    }}>
                        Officer Corps ({officers.length})
                    </div>
                }
            >
                {(['Governor', 'CEO', 'Scientist', 'Engineer', 'Admiral', 'Captain'] as OfficerRole[]).map(role => {
                    const roleOfficers = officers.filter(o => o.role === role);
                    if (roleOfficers.length === 0) return null;

                    return (
                        <RosterGroup
                            key={role}
                            title={`${role}s (${roleOfficers.length})`}
                            icon={ROLE_ICON[role]}
                            titleColor={ROLE_COLOR[role]}
                        >
                            {roleOfficers.map(o => (
                                <RosterItem
                                    key={o.id}
                                    name={o.name}
                                    active={selectedOfficerId === o.id}
                                    onClick={() => selectOfficer(o.id)}
                                    thumbnail={<PortraitGenerator seed={o.portraitSeed} role={o.role} size={40} />}
                                    subtitle={
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                            <span style={{ fontSize: 9, color: ROLE_COLOR[o.role], fontWeight: 700 }}>
                                                Lv.{o.level}
                                            </span>
                                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                {getAssignmentLabel(o)}
                                            </span>
                                        </div>
                                    }
                                />
                            ))}
                        </RosterGroup>
                    );
                })}
            </SidebarSection>

            <MainArea
                isEmpty={!selected}
                emptyMessage="Select an officer"
                title={selected?.name}
                subtitle={selected && `${selected.role} · Level ${selected.level}`}
            >
                {selected && (
                    <div style={{ padding: '0 16px' }}>
                        {/* Header Area with Portrait */}
                        <div style={{ display: 'flex', gap: 24, marginBottom: 24, alignItems: 'flex-start' }}>
                            <div style={{
                                padding: 4,
                                background: 'rgba(255,255,255,0.03)',
                                borderRadius: 8,
                                border: '1px solid rgba(255,255,255,0.05)'
                            }}>
                                <PortraitGenerator seed={selected.portraitSeed} role={selected.role} size={140} />
                            </div>
                            <div style={{ flex: 1 }}>
                                <div style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: 6,
                                    padding: '4px 12px',
                                    borderRadius: 4,
                                    background: `${ROLE_COLOR[selected.role]}15`,
                                    border: `1px solid ${ROLE_COLOR[selected.role]}30`,
                                    color: ROLE_COLOR[selected.role],
                                    fontSize: 12,
                                    fontWeight: 700,
                                    marginBottom: 12,
                                    textTransform: 'uppercase'
                                }}>
                                    {ROLE_ICON[selected.role]} {selected.role}
                                </div>

                                <div style={{ marginBottom: 16 }}>
                                    <div style={{
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        fontSize: 11,
                                        color: 'var(--text-muted)',
                                        marginBottom: 6,
                                    }}>
                                        <span>Training Progress</span>
                                        <span>{selected.experience}/100 XP</span>
                                    </div>
                                    <div style={{
                                        height: 8,
                                        background: 'rgba(0,0,0,0.3)',
                                        borderRadius: 4,
                                        overflow: 'hidden',
                                        border: '1px solid rgba(255,255,255,0.05)'
                                    }}>
                                        <div style={{
                                            height: '100%',
                                            width: `${selected.experience}%`,
                                            background: `linear-gradient(90deg, ${ROLE_COLOR[selected.role]}, ${ROLE_COLOR[selected.role]}99)`,
                                            boxShadow: `0 0 10px ${ROLE_COLOR[selected.role]}44`,
                                            transition: 'width 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
                                        }} />
                                    </div>
                                </div>
                                <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                                    <span style={{ color: 'var(--text-muted)' }}>Currently Assigned:</span>{' '}
                                    <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{getAssignmentLabel(selected)}</span>
                                </div>
                            </div>
                        </div>

                        {/* Details Panel */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
                            <div className="panel">
                                <div className="panel-header"><h3>Specialized Traits</h3></div>
                                <div className="panel-body" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                                    {selected.traits.length === 0 ? (
                                        <div style={{ color: 'var(--text-muted)', fontSize: 12, fontStyle: 'italic' }}>No unique traits</div>
                                    ) : selected.traits.map(tid => {
                                        const trait = TRAIT_BY_ID[tid];
                                        if (!trait) return null;
                                        return (
                                            <div key={tid} style={{
                                                padding: '10px',
                                                borderRadius: 6,
                                                background: 'rgba(255,255,255,0.02)',
                                                border: '1px solid rgba(255,255,255,0.05)',
                                            }}>
                                                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{trait.name}</div>
                                                <div style={{ fontSize: 11, color: 'var(--accent-green)', marginTop: 4 }}>{trait.description}</div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            <div className="panel">
                                <div className="panel-header"><h3>Active Bonuses</h3></div>
                                <div className="panel-body">
                                    {Object.entries(selected.bonuses).length === 0 ? (
                                        <div style={{ color: 'var(--text-muted)', fontSize: 12, fontStyle: 'italic' }}>No specialized bonuses</div>
                                    ) : Object.entries(selected.bonuses).map(([key, val]) => (
                                        <div key={key} className="stat-row" style={{ marginBottom: 8, padding: '4px 0', borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                                            <span className="stat-label" style={{ textTransform: 'capitalize', fontSize: 12 }}>
                                                {key.replace(/_/g, ' ')}
                                            </span>
                                            <span className="stat-value" style={{
                                                color: val > 0 ? 'var(--accent-green)' : 'var(--accent-red)',
                                                fontWeight: 700,
                                                fontSize: 13
                                            }}>
                                                {val > 0 ? '+' : ''}{(val * 100).toFixed(0)}%
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Assignment Panel */}
                        {selected.role === 'Governor' && (
                            <div className="panel">
                                <div className="panel-header"><h3>Jurisdiction & Assignment</h3></div>
                                <div className="panel-body">
                                    <div style={{
                                        fontSize: 11,
                                        color: 'var(--text-muted)',
                                        marginBottom: 10,
                                        textTransform: 'uppercase',
                                        letterSpacing: '0.05em',
                                    }}>Appointed Colony</div>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                                        <button
                                            onClick={() => handleAssign(selected.id, undefined)}
                                            className="btn btn-secondary"
                                            style={{
                                                minWidth: '100px',
                                                opacity: !selected.assignedTo ? 0.6 : 1,
                                                background: !selected.assignedTo ? 'rgba(255,255,255,0.05)' : undefined
                                            }}
                                        >
                                            Unassign
                                        </button>
                                        {colonies.map(col => (
                                            <button
                                                key={col.id}
                                                onClick={() => handleAssign(selected.id, col.id)}
                                                className={`btn ${selected.assignedTo === col.id ? 'btn-primary' : 'btn-secondary'}`}
                                                style={selected.assignedTo === col.id ? {
                                                    borderColor: ROLE_COLOR.Governor,
                                                    boxShadow: `0 0 10px ${ROLE_COLOR.Governor}33`
                                                } : {}}
                                            >
                                                🏛️ {col.name}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )}

                        {selected.role === 'Scientist' && selected.assignedTo?.startsWith('prj_') && (
                            <div style={{
                                padding: 16,
                                borderRadius: 8,
                                background: 'rgba(74,222,128,0.05)',
                                border: '1px solid rgba(74,222,128,0.1)',
                                fontSize: 13,
                                color: 'var(--text-secondary)',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 10
                            }}>
                                <span style={{ fontSize: 18 }}>🔬</span>
                                <div>
                                    Current Project: <strong style={{ color: 'var(--accent-green)' }}>{getAssignmentLabel(selected)}</strong>
                                </div>
                            </div>
                        )}

                        {selected.role !== 'Governor' && !selected.assignedTo?.startsWith('prj_') && (
                            <div style={{
                                fontStyle: 'italic',
                                fontSize: 12,
                                color: 'var(--text-muted)',
                                padding: '10px 0'
                            }}>
                                Note: Fleet and sector-wide research assignments are managed via the Admiralty and Academy interfaces.
                            </div>
                        )}
                    </div>
                )}
            </MainArea>
        </RosterShell>
    );
}
