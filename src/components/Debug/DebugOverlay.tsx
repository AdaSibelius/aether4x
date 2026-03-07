'use client';
import React, { useMemo } from 'react';
import { useGameStore } from '@/store/gameStore';
import { useUIStore } from '@/store/uiStore';
import { runHealthAudit } from '@/engine/health';
import styles from './DebugOverlay.module.css';

export default function DebugOverlay() {
    const { game } = useGameStore();
    const { showDebugOverlay, activeView, selectedStarId } = useUIStore();

    const audit = useMemo(() => {
        if (!game || !showDebugOverlay) return null;
        return runHealthAudit(game);
    }, [game, showDebugOverlay]);

    if (!game || !showDebugOverlay) return null;

    return (
        <div className={styles.overlay}>
            <svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none">
                {/* 1. Health Issue Flags (Visualized on Sidebar/Top if active) */}
                {audit && !audit.isHealthy && (
                    <g className={styles.healthLayer}>
                        <text x="50" y="5" textAnchor="middle" className={styles.healthFlag}>
                            ⚠️ STATE INCONSISTENCY DETECTED ({audit.issues.length} ISSUES)
                        </text>
                    </g>
                )}

                {/* 2. License Visuals (System View specific) */}
                {activeView === 'System' && selectedStarId && (
                    <g className={styles.licenseLayer}>
                        {(() => {
                            const companyLicenses = game.empires[game.playerEmpireId].companies.filter(c =>
                                c.explorationLicenseIds.includes(selectedStarId)
                            );

                            return companyLicenses.map((corp, idx) => (
                                <circle
                                    key={corp.id}
                                    cx={10 + idx * 5}
                                    cy={90}
                                    r="2"
                                    className={styles.licenseIcon}
                                >
                                    <title>{`${corp.name} License Holder`}</title>
                                </circle>
                            ));
                        })()}
                    </g>
                )}
            </svg>

            {/* 3. Floating Tooltip for Issues */}
            {audit && !audit.isHealthy && (
                <div style={{
                    position: 'absolute',
                    top: '30px',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    background: 'rgba(239, 68, 68, 0.9)',
                    color: 'white',
                    padding: '8px 16px',
                    borderRadius: '4px',
                    fontSize: '11px',
                    pointerEvents: 'auto',
                    maxHeight: '150px',
                    overflowY: 'auto',
                    border: '1px solid white'
                }}>
                    <strong>Audit Faults:</strong>
                    <ul style={{ margin: '4px 0 0 16px', padding: 0 }}>
                        {audit.issues.map((iss, i) => <li key={i}>{iss}</li>)}
                    </ul>
                </div>
            )}
        </div>
    );
}
