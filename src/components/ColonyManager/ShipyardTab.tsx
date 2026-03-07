import React, { useState } from 'react';
import { Colony, Empire, ProductionItem, ProductionItemType } from '@/types';
import { STRUCTURE_BP_COST, STRUCTURE_MINERAL_COST } from './ColonyManager';
import styles from './ColonyManager.module.css';

export default function ShipyardTab({ colony, updateColony, empire }: {
    colony: Colony;
    updateColony: (patch: Partial<Colony>) => void;
    empire: Empire;
}) {
    const [selectedDesignId, setSelectedDesignId] = useState<string | 'expand_slipway' | 'expand_tonnage'>(empire.designLibrary[0]?.id || 'expand_slipway');

    const addToShipyardQueue = (shipyardId: string) => {
        const sy = colony.shipyards.find(s => s.id === shipyardId);
        if (!sy) return;

        if (selectedDesignId === 'expand_slipway' || selectedDesignId === 'expand_tonnage') {
            const type: ProductionItemType = selectedDesignId === 'expand_slipway' ? 'ShipyardExpansion_Slipway' : 'ShipyardExpansion_Tonnage';
            const bpCost = STRUCTURE_BP_COST[type] ?? 1000;
            const mineralCost = STRUCTURE_MINERAL_COST[type] ?? {};
            const label = selectedDesignId === 'expand_slipway' ? 'Add Slipway' : 'Expand Tonnage';

            const newItem: ProductionItem = {
                id: `exp_${Date.now()}`,
                type,
                name: label,
                quantity: 1,
                progress: 0,
                costPerUnit: mineralCost,
                bpCostPerUnit: bpCost,
                targetId: shipyardId,
            };
            updateColony({ productionQueue: [...colony.productionQueue, newItem] });
        } else {
            const design = empire.designLibrary.find(d => d.id === selectedDesignId);
            if (!design) return;

            const newItem: ProductionItem = {
                id: `ship_${Date.now()}`,
                type: 'Ship',
                name: design.name,
                designId: design.id,
                quantity: 1,
                progress: 0,
                costPerUnit: design.mineralCost,
                bpCostPerUnit: design.bpCost,
            };

            const updatedShipyards = colony.shipyards.map(s =>
                s.id === shipyardId ? { ...s, activeBuilds: [...(s.activeBuilds || []), newItem] } : s
            );
            updateColony({ shipyards: updatedShipyards });
        }
    };

    const removeShipItem = (shipyardId: string, itemId: string) => {
        const updatedShipyards = colony.shipyards.map(s =>
            s.id === shipyardId ? { ...s, activeBuilds: (s.activeBuilds || []).filter(i => i.id !== itemId) } : s
        );
        updateColony({ shipyards: updatedShipyards });
    };

    return (
        <div className={styles.tabContent}>
            <div className={styles.shipyardLayout}>

                <div className={styles.shipyardGrid}>
                    {colony.shipyards.length === 0 ? (
                        <div className={styles.emptyState}>
                            <h3>No Shipyards Detected</h3>
                            <p>Build a Shipyard structure in the Industry tab to begin naval construction.</p>
                        </div>
                    ) : (
                        colony.shipyards.map(sy => (
                            <div key={sy.id} className="panel">
                                <div className="panel-header">
                                    <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
                                        <h3>⚓ {sy.name}</h3>
                                        <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                                            {sy.slipways} Slipways · {sy.maxTonnage.toLocaleString()}t Max
                                        </div>
                                    </div>
                                </div>
                                <div className="panel-body" style={{ padding: '12px' }}>
                                    {/* Queue */}
                                    <div className={styles.syQueue}>
                                        {((sy.activeBuilds || []).length === 0 && !colony.productionQueue.some(i => i.targetId === sy.id)) ? (
                                            <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 12, border: '1px dashed var(--border-dim)', borderRadius: 8 }}>
                                                Queue Empty
                                            </div>
                                        ) : (
                                            <>
                                                {/* Global expansions targeted here */}
                                                {colony.productionQueue.filter(i => i.targetId === sy.id).map(item => (
                                                    <div key={item.id} className={styles.syQueueItem} style={{ borderLeft: '2px solid var(--accent-gold)' }}>
                                                        <div className={styles.syQueueHeader}>
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                                <span style={{ fontWeight: 600 }}>🛠️ {item.name}</span>
                                                                <span className="badge badge-gold" style={{ fontSize: 8 }}>EXPANDING</span>
                                                            </div>
                                                        </div>
                                                        <div className="progress-bar" style={{ height: 6, margin: '4px 0' }}>
                                                            <div className="progress-fill" style={{ width: `${item.progress}%`, background: 'var(--accent-gold)' }} />
                                                        </div>
                                                        <div style={{ fontSize: 9, color: 'var(--text-muted)' }}>
                                                            {item.progress.toFixed(1)}% complete
                                                        </div>
                                                    </div>
                                                ))}

                                                {/* Ship builds */}
                                                {(sy.activeBuilds || []).map((item, idx) => (
                                                    <div key={item.id} className={styles.syQueueItem}>
                                                        <div className={styles.syQueueHeader}>
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                                <span className={styles.syQueuePos}>{idx + 1}</span>
                                                                <span style={{ fontWeight: 600 }}>{item.name}</span>
                                                                {idx < sy.slipways && <span className="badge badge-blue" style={{ fontSize: 8 }}>IN PROGRESS</span>}
                                                            </div>
                                                            <button className="btn btn-danger btn-xs" onClick={() => removeShipItem(sy.id, item.id)}>×</button>
                                                        </div>
                                                        <div className="progress-bar" style={{ height: 6, margin: '4px 0' }}>
                                                            <div className="progress-fill" style={{ width: `${item.progress}%` }} />
                                                        </div>
                                                        <div style={{ fontSize: 9, color: 'var(--text-muted)', display: 'flex', justifyContent: 'space-between' }}>
                                                            <span>{item.progress.toFixed(1)}% complete</span>
                                                            <span>Ordered by: {item.sourceCompanyId ? 'Private Sector' : 'Imperial Government'}</span>
                                                        </div>
                                                    </div>
                                                ))}
                                            </>
                                        )}
                                    </div>

                                    {/* Add Controls */}
                                    <div className={styles.syControls} style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--border-dim)' }}>
                                        <div style={{ display: 'flex', gap: 8 }}>
                                            <select
                                                className="form-control"
                                                style={{ flex: 1, fontSize: 11 }}
                                                value={selectedDesignId}
                                                onChange={e => setSelectedDesignId(e.target.value)}
                                            >
                                                <optgroup label="Ship Designs">
                                                    {empire.designLibrary.map(d => (
                                                        <option key={d.id} value={d.id}>{d.name} ({d.maxHullPoints * 10}t)</option>
                                                    ))}
                                                </optgroup>
                                                <optgroup label="Expansions">
                                                    <option value="expand_slipway">Add Slipway</option>
                                                    <option value="expand_tonnage">Expand Tonnage</option>
                                                </optgroup>
                                            </select>
                                            <button className="btn btn-primary btn-sm" onClick={() => addToShipyardQueue(sy.id)}>
                                                Add Order
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
}
