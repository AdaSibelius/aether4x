'use client';
import { useGameStore } from '@/store/gameStore';
import { useUIStore } from '@/store/uiStore';
import { TECH_TREE, TECH_CATEGORIES, getAvailableTechs } from '@/engine/research';
import type { TechCategory, Officer, ResearchProject, Technology } from '@/types';
import { useState } from 'react';
import styles from './Research.module.css';
import { generateId } from '@/utils/id';

export default function Research() {
    const game = useGameStore(s => s.game);
    const [activeCategory, setActiveCategory] = useState<TechCategory>('Computation');
    const [selectedTech, setSelectedTech] = useState<Technology | null>(null);
    const [selectedScientistId, setSelectedScientistId] = useState<string>('');
    const [labsToAssign, setLabsToAssign] = useState<number>(1);

    if (!game) return <div className={styles.empty}>No game in progress.</div>;

    const empire = game.empires[game.playerEmpireId];
    const { research } = empire;
    const completed = new Set(research.completedTechs);
    const available = getAvailableTechs(research.completedTechs);
    const availableIds = new Set(available.map(t => t.id));

    const activeScientists = empire.officers.filter(o => o.role === 'Scientist');
    const totalLabs = Object.values(game.colonies).filter(c => c.empireId === game.playerEmpireId).reduce((sum, c) => sum + (c.researchLabs || 0), 0);
    const LabsUsed = research.activeProjects.reduce((sum, p) => sum + p.labs, 0);
    const labsRemaining = totalLabs - LabsUsed;

    const startResearch = () => {
        if (!selectedTech || !selectedScientistId || labsToAssign <= 0) return;

        useGameStore.setState(s => {
            if (!s.game) return s;
            const empire = s.game.empires[s.game.playerEmpireId];
            const newProject: ResearchProject = {
                id: generateId('prj'),
                techId: selectedTech.id,
                scientistId: selectedScientistId,
                labs: labsToAssign,
                investedPoints: 0
            };

            const updatedOfficers = empire.officers.map(o =>
                o.id === selectedScientistId ? { ...o, assignedTo: newProject.id } : o
            );

            return {
                game: {
                    ...s.game,
                    empires: {
                        ...s.game.empires,
                        [s.game.playerEmpireId]: {
                            ...empire,
                            officers: updatedOfficers,
                            research: {
                                ...empire.research,
                                activeProjects: [...empire.research.activeProjects, newProject]
                            }
                        }
                    }
                }
            };
        });
        setSelectedTech(null);
    };

    const cancelProject = (projectId: string) => {
        useGameStore.setState(s => {
            if (!s.game) return s;
            const empire = s.game.empires[s.game.playerEmpireId];
            const project = empire.research.activeProjects.find(p => p.id === projectId);
            if (!project) return s;

            const updatedOfficers = empire.officers.map(o =>
                o.id === project.scientistId ? { ...o, assignedTo: undefined } : o
            );

            return {
                game: {
                    ...s.game,
                    empires: {
                        ...s.game.empires,
                        [s.game.playerEmpireId]: {
                            ...empire,
                            officers: updatedOfficers,
                            research: {
                                ...empire.research,
                                activeProjects: empire.research.activeProjects.filter(p => p.id !== projectId)
                            }
                        }
                    }
                }
            };
        });
    };

    const adjustProjectLabs = (projectId: string, delta: number) => {
        useGameStore.setState(s => {
            if (!s.game) return s;
            const empire = s.game.empires[s.game.playerEmpireId];
            const project = empire.research.activeProjects.find(p => p.id === projectId);
            if (!project) return s;

            if (!s.game) return s;
            const liveGame = s.game;
            const currentTotalLabs = Object.values(liveGame.colonies).filter(c => c.empireId === liveGame.playerEmpireId).reduce((sum, c) => sum + (c.researchLabs || 0), 0);
            const currentLabsUsed = empire.research.activeProjects.reduce((sum, p) => sum + p.labs, 0);
            const currentLabsRemaining = currentTotalLabs - currentLabsUsed;

            let newLabs = project.labs + delta;
            if (newLabs < 1) newLabs = 1;
            if (delta > 0 && currentLabsRemaining < delta) newLabs = project.labs + currentLabsRemaining;

            return {
                game: {
                    ...s.game,
                    empires: {
                        ...s.game.empires,
                        [s.game.playerEmpireId]: {
                            ...empire,
                            research: {
                                ...empire.research,
                                activeProjects: empire.research.activeProjects.map(p =>
                                    p.id === projectId ? { ...p, labs: newLabs } : p
                                )
                            }
                        }
                    }
                }
            };
        });
    };

    return (
        <div className={styles.container}>
            {/* Project List */}
            <div className={styles.currentPanel}>
                <div className="panel-header">
                    <h3>Active Research Teams</h3>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 'normal' }}>
                        Labs: <span style={{ color: labsRemaining > 0 ? 'var(--accent-gold)' : 'var(--text-muted)' }}>{LabsUsed} / {totalLabs}</span>
                    </div>
                </div>
                <div className={styles.currentBody}>
                    <div className={styles.projectList}>
                        {research.activeProjects.length > 0 ? research.activeProjects.map(prj => {
                            const tech = TECH_TREE.find(t => t.id === prj.techId);
                            const sci = empire.officers.find(o => o.id === prj.scientistId);
                            const isMatch = sci?.specialization === tech?.category;
                            const progress = tech ? (prj.investedPoints / tech.cost) * 100 : 0;

                            return (
                                <div key={prj.id} className={styles.projectItem}>
                                    <div className={styles.projectTop}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                            <span className={styles.projectName}>{tech?.name}</span>
                                            <span className="badge badge-dim" style={{ fontSize: 9 }}>{prj.labs}L</span>
                                        </div>
                                        <button className="btn-icon" onClick={() => cancelProject(prj.id)} title="Cancel Project">×</button>
                                    </div>
                                    <div className={styles.projectScientist}>
                                        {sci?.name} (Lv {sci?.level}) {isMatch && <span className={styles.specMatch}>★</span>}
                                    </div>
                                    <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 10 }}>
                                        <div style={{ flex: 1 }}>
                                            <div className="progress-bar">
                                                <div className="progress-fill" style={{ width: `${progress.toFixed(1)}%` }} />
                                            </div>
                                        </div>
                                        <div style={{ display: 'flex', gap: 2 }}>
                                            <button className="btn-icon" onClick={() => adjustProjectLabs(prj.id, -1)} style={{ padding: '0 4px', height: 16 }}>-</button>
                                            <button className="btn-icon" onClick={() => adjustProjectLabs(prj.id, 1)} disabled={labsRemaining <= 0} style={{ padding: '0 4px', height: 16 }}>+</button>
                                        </div>
                                    </div>
                                    <div className={styles.projectDetails}>
                                        <span>{progress.toFixed(1)}%</span>
                                        <span>{prj.investedPoints.toFixed(0)} / {tech?.cost} RP</span>
                                    </div>
                                </div>
                            );
                        }) : (
                            <div className={styles.noResearch}>No active teams. Select a technology to begin.</div>
                        )}
                    </div>
                </div>
            </div>

            {/* Category tabs */}
            <div className="tab-list" style={{ margin: '0 0 10px', flexShrink: 0 }}>
                {TECH_CATEGORIES.map(cat => (
                    <button key={cat} className={`tab-item ${activeCategory === cat ? 'active' : ''}`}
                        onClick={() => setActiveCategory(cat)}>{cat}</button>
                ))}
            </div>

            <div className={styles.techGrid}>
                {TECH_TREE.filter(t => t.category === activeCategory).map(tech => {
                    const isDone = completed.has(tech.id);
                    const isAvail = availableIds.has(tech.id);
                    const isActive = research.activeProjects.some(p => p.techId === tech.id);
                    const isLocked = !isDone && !isAvail;

                    return (
                        <div key={tech.id}
                            className={`${styles.techCard} ${isDone ? styles.done : ''} ${isActive ? styles.active : ''} ${isAvail && !isActive ? styles.available : ''} ${isLocked ? styles.locked : ''}`}
                            onClick={() => !isDone && isAvail && !isActive && setSelectedTech(tech)}
                        >
                            <div className={styles.techHeader}>
                                <span className={styles.techName}>{tech.name}</span>
                                <span className={`badge ${isDone ? 'badge-green' : isActive ? 'badge-blue' : isAvail ? 'badge-gold' : 'badge-red'}`}>
                                    {isDone ? 'Done' : isActive ? 'Active' : isAvail ? `${tech.cost} RP` : 'Locked'}
                                </span>
                            </div>
                            <div className={styles.techDesc}>{tech.description}</div>
                            <div className={styles.effects}>
                                {tech.effects.map((e, i) => (
                                    <span key={i} className={styles.effect}>+{e.type.replace(/_/g, ' ')}</span>
                                ))}
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Creation Modal */}
            {selectedTech && (
                <div className={styles.creationOverlay}>
                    <div className={styles.creationPanel}>
                        <div className="panel-header"><h3>Form Research Team</h3></div>
                        <div style={{ padding: 15 }}>
                            <div className={styles.creationField}>
                                <label className={styles.creationLabel}>Technology</label>
                                <div className={styles.projectName} style={{ fontSize: 14 }}>{selectedTech.name}</div>
                            </div>

                            <div className={styles.creationField}>
                                <label className={styles.creationLabel}>Assigned Scientist</label>
                                <select className={styles.creationInput}
                                    value={selectedScientistId}
                                    onChange={(e) => setSelectedScientistId(e.target.value)}
                                >
                                    <option value="">Select a Scientist...</option>
                                    {activeScientists.map(sci => (
                                        <option key={sci.id} value={sci.id} disabled={!!sci.assignedTo}>
                                            {sci.name} (Lv {sci.level}) - {sci.specialization} {sci.assignedTo ? '[ASSIGNED]' : ''}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div className={styles.creationField}>
                                <label className={styles.creationLabel}>Labs (Available: {labsRemaining})</label>
                                <input type="range" min="1" max={Math.max(1, labsRemaining)} step="1"
                                    value={labsToAssign}
                                    onChange={(e) => setLabsToAssign(parseInt(e.target.value))}
                                    className={styles.creationInput}
                                    style={{ padding: 0 }}
                                />
                                <div className={styles.projectDetails}>
                                    <span>Assigning {labsToAssign} labs</span>
                                </div>
                            </div>

                            <div className={styles.creationButtons}>
                                <button className={styles.cancelButton} onClick={() => setSelectedTech(null)}>Cancel</button>
                                <button className={styles.confirmButton} disabled={!selectedScientistId || labsToAssign <= 0 || labsToAssign > labsRemaining} onClick={startResearch}>Deploy Team</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
