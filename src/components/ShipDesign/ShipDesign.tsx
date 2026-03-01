import { useMemo, useState } from 'react';
import { useGameStore } from '@/store/gameStore';
import { HULL_SPECS, COMPONENT_LIBRARY } from '@/engine/ships';
import type { HullClass, ShipComponent, ShipDesign as ShipDesignType } from '@/types';
import { generateId } from '@/utils/id';
import styles from './ShipDesign.module.css';
import { useUIStore } from '@/store/uiStore';
import ShipVisualizer from './ShipVisualizer';
import { RosterShell, SidebarSection, RosterGroup, RosterItem, MainArea } from '@/components/Roster/Roster';

export default function ShipDesign() {
    const game = useGameStore(s => s.game);
    const [selectedHull, setSelectedHull] = useState<HullClass>('Destroyer');
    const { selectedShipDesignId, selectShipDesign } = useUIStore();
    const [selectedComponents, setSelectedComponents] = useState<ShipComponent[]>([]);
    const [designName, setDesignName] = useState('New Design');

    if (!game) return <div style={{ padding: 20, color: 'var(--text-muted)' }}>No game in progress.</div>;

    const empire = game.empires[game.playerEmpireId];
    const completedTechs = new Set(empire.research.completedTechs);
    const hullSpec = HULL_SPECS[selectedHull];
    const usedSize = selectedComponents.reduce((a, c) => a + c.size, 0);
    const pctUsed = (usedSize / hullSpec.maxSize) * 100;

    const addComponent = (comp: ShipComponent) => {
        if (usedSize + comp.size > hullSpec.maxSize) return;
        setSelectedComponents(prev => [...prev, comp]);
    };
    const removeComponent = (idx: number) => setSelectedComponents(prev => prev.filter((_, i) => i !== idx));

    const duplicateDesign = (design: ShipDesignType) => {
        setDesignName(`${design.name} (Copy)`);
        setSelectedHull(design.hullClass);
        setSelectedComponents(design.components);
        selectShipDesign(null);
    };

    const deleteDesign = (id: string) => {
        if (confirm('Are you sure you want to decommission this design?')) {
            useGameStore.getState().deleteDesign(id);
        }
    };

    const saveDesign = () => {
        const hull = HULL_SPECS[selectedHull];
        const totalThrust = selectedComponents.filter(c => c.type === 'Engine').reduce((a, c) => a + (c.stats.thrust || 0), 0);
        const fuel = selectedComponents.filter(c => c.type === 'FuelTank').reduce((a, c) => a + (c.stats.capacity || 0), 0);
        const sensor = Math.max(2, ...selectedComponents.filter(c => c.type === 'Sensor').map(c => c.stats.range || 0));
        const powerSupply = selectedComponents.filter(c => c.type === 'Reactor').reduce((a, c) => a + (c.stats.powerOutput || 0), 0);
        const powerDraw = selectedComponents.reduce((a, c) => a + c.powerDraw, 0);

        if (!designName.trim() || selectedComponents.length === 0) return;

        const baseBP = hull.buildCostBase;
        const mineralCost: Record<string, number> = {
            Iron: Math.floor(baseBP * 0.8),
            Titanium: Math.floor(baseBP * 0.2)
        };
        const bpCost = Math.floor(baseBP + selectedComponents.reduce((sum, c) => sum + (c.size * 0.5), 0));

        const newDesign: ShipDesignType = {
            id: generateId('design'),
            name: designName,
            hullClass: selectedHull,
            components: selectedComponents,
            maxHullPoints: hull.maxSize,
            speed: totalThrust / 100,
            fuelCapacity: fuel,
            sensorRange: sensor,
            weaponSystems: selectedComponents.filter(c => c.type === 'Weapon'),
            powerSupply,
            powerDraw,
            mineralCost,
            bpCost
        };

        useGameStore.getState().saveDesign(newDesign);
        setSelectedComponents([]);
        setDesignName('New Design');
    };

    // Calculate Expanded Metrics
    const totalThrust = selectedComponents.reduce((a, c) => a + (c.stats.thrust ?? 0), 0);
    // Derived Engineering Metrics
    const stats = useMemo(() => {
        const totalThrust = selectedComponents.filter(c => c.type === 'Engine').reduce((a, c) => a + (c.stats.thrust || 0), 0);
        const speed = totalThrust / 100;
        const fuelCapacity = selectedComponents.filter(c => c.type === 'FuelTank').reduce((a, c) => a + (c.stats.capacity || 0), 0);
        const fuelPerTick = selectedComponents.filter(c => c.type === 'Engine').reduce((a, c) => a + (c.stats.fuelPerTick || 0), 0);
        const powerSupply = selectedComponents.filter(c => c.type === 'Reactor').reduce((sum, c) => sum + (c.stats.powerOutput || 0), 0);
        const powerDraw = selectedComponents.reduce((sum, c) => sum + c.powerDraw, 0);

        let totalDps = 0;
        selectedComponents.filter(c => c.type === 'Weapon').forEach(w => {
            if (w.stats.damage && w.stats.rof) {
                totalDps += w.stats.damage * w.stats.rof;
            }
        });

        const sensorRange = Math.max(2, ...selectedComponents.filter(c => c.type === 'Sensor').map(c => c.stats.range || 0));

        const armorRating = selectedComponents.reduce((a, c) => a + (c.stats.armorRating ?? 0), 0);
        const hullBonus = selectedComponents.reduce((a, c) => a + (c.stats.hullBonus ?? 0), 0);
        const shieldPoints = selectedComponents.reduce((a, c) => a + (c.stats.shieldPoints ?? 0), 0);
        const defenseRating = hullSpec.maxSize + hullBonus + armorRating + shieldPoints;

        return {
            speed,
            fuelCapacity,
            fuelPerTick,
            powerSupply,
            powerDraw,
            totalDps,
            sensorRange,
            defenseRating,
            opRange: fuelPerTick > 0 ? (fuelCapacity / fuelPerTick) * speed : 0,
            isValid: usedSize <= hullSpec.maxSize && powerSupply >= powerDraw && (totalThrust > 0 || hullSpec.maxSize < 100)
        };
    }, [selectedComponents, hullSpec, usedSize]);

    const groupedLibrary = useMemo(() => {
        const order = ['Reactor', 'Engine', 'FuelTank', 'Weapon', 'Shield', 'Armor', 'Sensor', 'Cargo', 'ColonizationModule', 'SurveyModule'];
        const groups: Record<string, ShipComponent[]> = {};
        COMPONENT_LIBRARY.forEach(c => {
            if (!groups[c.type]) groups[c.type] = [];
            groups[c.type].push(c);
        });
        return order.filter(t => groups[t]);
    }, []);

    const selectedDesign = empire.designLibrary.find(d => d.id === selectedShipDesignId);

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
                        Naval Engineering
                    </div>
                }
            >
                <RosterGroup title="DESIGN LIBRARY" icon="📐">
                    {empire.designLibrary.map(d => (
                        <RosterItem
                            key={d.id}
                            name={d.name}
                            active={selectedShipDesignId === d.id}
                            onClick={() => selectShipDesign(d.id === selectedShipDesignId ? null : d.id)}
                            subtitle={
                                <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                                    {d.hullClass} · Spd {d.speed.toFixed(1)} · HP {d.maxHullPoints}
                                </div>
                            }
                        />
                    ))}
                    {empire.designLibrary.length === 0 && (
                        <div style={{ padding: 12, fontSize: 11, color: 'var(--text-muted)', textAlign: 'center' }}>
                            No designs saved
                        </div>
                    )}
                </RosterGroup>
            </SidebarSection>

            <MainArea
                isEmpty={false}
                title={selectedDesign ? selectedDesign.name : 'New Design Specification'}
                subtitle={selectedDesign ? `${selectedDesign.hullClass} Class Vessel` : 'Engineering Bay'}
                headerActions={
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        {!selectedDesign ? (
                            <>
                                <input
                                    value={designName}
                                    onChange={e => setDesignName(e.target.value)}
                                    style={{ width: 150 }}
                                    className="input-field"
                                    placeholder="Design Name"
                                />
                                <button className="btn btn-primary btn-sm" onClick={saveDesign} disabled={!stats.isValid || !designName.trim()}>
                                    Save Design
                                </button>
                            </>
                        ) : (
                            <>
                                <button className="btn btn-secondary btn-sm" onClick={() => duplicateDesign(selectedDesign)}>
                                    Duplicate
                                </button>
                                <button className="btn btn-danger btn-sm" onClick={() => deleteDesign(selectedDesign.id)}>
                                    Decommission
                                </button>
                                <button className="btn btn-secondary btn-sm" onClick={() => selectShipDesign(null)}>
                                    Create New
                                </button>
                            </>
                        )}
                    </div>
                }
            >
                <div style={{ padding: '0 16px', height: '100%', overflowY: 'auto' }}>
                    {/* VISUALIZER + Hull Picker Row */}
                    {!selectedDesign && (
                        <div style={{ display: 'flex', gap: 16, marginBottom: 16 }}>
                            <div style={{ flex: 1 }}>
                                <div className={styles.hullPicker}>
                                    {(Object.keys(HULL_SPECS) as HullClass[]).map(hull => (
                                        <button key={hull} className={`btn btn-secondary btn-sm ${selectedHull === hull ? 'btn-primary' : ''}`}
                                            onClick={() => { setSelectedHull(hull); setSelectedComponents([]); }}>
                                            {hull}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div style={{ border: '1px solid var(--border-med)', borderRadius: 'var(--radius-sm)', background: 'var(--bg-deep)' }}>
                                <ShipVisualizer
                                    design={{
                                        id: 'preview',
                                        name: designName,
                                        hullClass: selectedHull,
                                        components: selectedComponents
                                    }}
                                    width={240}
                                    height={120}
                                />
                            </div>
                        </div>
                    )}

                    {selectedDesign && (
                        <div style={{ border: '1px solid var(--border-med)', borderRadius: 'var(--radius-sm)', background: 'var(--bg-deep)', marginBottom: 16, display: 'flex', justifyContent: 'center', padding: 12 }}>
                            <ShipVisualizer design={selectedDesign} width={400} height={200} />
                        </div>
                    )}

                    {/* Size bar */}
                    {!selectedDesign && (
                        <div style={{ marginTop: 12 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, marginBottom: 4 }}>
                                <span style={{ color: 'var(--text-muted)' }}>Tonnage Utilization</span>
                                <span style={{ fontWeight: 600, color: usedSize > hullSpec.maxSize ? 'var(--accent-red)' : usedSize > hullSpec.maxSize * 0.9 ? 'var(--accent-orange)' : 'var(--text-main)' }}>
                                    {usedSize} / {hullSpec.maxSize} tons
                                </span>
                            </div>
                            <div style={{ height: 6, background: 'rgba(255,255,255,0.05)', borderRadius: 3, overflow: 'hidden' }}>
                                <div style={{
                                    height: '100%',
                                    width: `${Math.min(100, (usedSize / hullSpec.maxSize) * 100)}%`,
                                    background: usedSize > hullSpec.maxSize ? 'var(--accent-red)' : usedSize > hullSpec.maxSize * 0.9 ? 'var(--accent-orange)' : 'var(--accent-blue)',
                                    transition: 'width 0.3s ease, background 0.3s ease'
                                }} />
                            </div>
                        </div>
                    )}

                    {/* Expanded Metrics Panel */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 16, padding: 12, background: 'var(--bg-panel-alt)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-med)' }}>
                        <div>
                            <div style={{ fontSize: 9, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Build Cost</div>
                            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-main)', fontFamily: 'var(--font-mono)' }}>
                                {selectedDesign ? selectedDesign.bpCost : Math.floor(hullSpec.buildCostBase + usedSize * 0.5)} BP
                            </div>
                        </div>
                        <div>
                            <div style={{ fontSize: 9, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Power Flux</div>
                            <div style={{ fontSize: 13, fontWeight: 600, color: stats.powerSupply < stats.powerDraw ? 'var(--accent-red)' : 'var(--accent-green)', fontFamily: 'var(--font-mono)' }}>
                                {selectedDesign ? `${selectedDesign.powerSupply}/${selectedDesign.powerDraw}` : `${stats.powerSupply}/${stats.powerDraw}`} GW
                            </div>
                        </div>
                        <div>
                            <div style={{ fontSize: 9, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Op. Range</div>
                            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--accent-orange)', fontFamily: 'var(--font-mono)' }}>
                                {selectedDesign ?
                                    (selectedDesign.components.filter((c: ShipComponent) => c.type === 'Engine').reduce((a: number, c: ShipComponent) => a + (c.stats.fuelPerTick || 0), 0) > 0 ?
                                        Math.floor((selectedDesign.fuelCapacity / selectedDesign.components.filter((c: ShipComponent) => c.type === 'Engine').reduce((a: number, c: ShipComponent) => a + (c.stats.fuelPerTick || 0), 0)) * selectedDesign.speed) : 0) :
                                    Math.floor(stats.opRange)} Bkm
                            </div>
                        </div>
                        <div>
                            <div style={{ fontSize: 9, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Fleet DPS</div>
                            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--accent-red)', fontFamily: 'var(--font-mono)' }}>
                                {(selectedDesign ? selectedDesign.weaponSystems.reduce((a: number, w: ShipComponent) => a + (w.stats.damage || 0) * (w.stats.rof || 0), 0) : stats.totalDps).toFixed(1)}
                            </div>
                        </div>
                        <div>
                            <div style={{ fontSize: 9, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Defense Rating</div>
                            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--accent-cyan)', fontFamily: 'var(--font-mono)' }}>
                                {(selectedDesign ? (selectedDesign.maxHullPoints + selectedDesign.components.reduce((a: number, c: ShipComponent) => a + (c.stats.armorRating || 0) + (c.stats.shieldPoints || 0), 0)) : stats.defenseRating).toLocaleString()}
                            </div>
                        </div>
                    </div>

                    {!selectedDesign && !stats.isValid && (
                        <div style={{ marginBottom: 16, padding: 12, border: '1px solid var(--accent-red)', borderRadius: 'var(--radius-sm)', background: 'rgba(239, 68, 68, 0.1)', color: 'var(--accent-red)', fontSize: 11 }}>
                            <div style={{ fontWeight: 600, marginBottom: 4 }}>⚠️ ENGINEERING CONSTRAINTS VIOLATED:</div>
                            {usedSize > hullSpec.maxSize && <div>• Vessel exceeds hull tonnage capacity.</div>}
                            {stats.powerSupply < stats.powerDraw && <div>• Critical power deficit detected. Install more Aetheric Hearths.</div>}
                            {stats.speed === 0 && hullSpec.maxSize >= 100 && <div>• No propulsion systems installed.</div>}
                        </div>
                    )}

                    <div className={styles.columns}>
                        {/* Components library */}
                        {!selectedDesign && (
                            <div className={styles.compLib}>
                                <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-muted)', marginBottom: 8 }}>
                                    Available Components
                                </div>
                                {groupedLibrary.map(type => (
                                    <div key={type} style={{ marginBottom: 12 }}>
                                        <div className={styles.typeHeader}>{type}</div>
                                        {COMPONENT_LIBRARY.filter(c => c.type === type).map(comp => {
                                            const locked = comp.requiredTech && !completedTechs.has(comp.requiredTech);
                                            return (
                                                <div key={comp.id}
                                                    className={`list-item ${locked ? styles.locked : ''}`}
                                                    onClick={() => !locked && addComponent(comp)}
                                                    title={locked ? `Requires: ${comp.requiredTech}` : comp.name}
                                                >
                                                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                                        <span style={{ fontWeight: 500, fontSize: 11 }}>{comp.name}</span>
                                                        <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{comp.size}t</span>
                                                    </div>
                                                    <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                                                        {comp.powerDraw > 0 ? `Power: -${comp.powerDraw}` : comp.type === 'Reactor' ? `Power: +${comp.stats.powerOutput}` : ''}
                                                        {comp.stats.thrust && ` · Thrust: ${comp.stats.thrust}`}
                                                        {comp.stats.capacity && ` · Cap: ${comp.stats.capacity}`}
                                                    </div>
                                                    {locked && <div style={{ fontSize: 9, color: 'var(--accent-red)', marginTop: 2 }}>🔒 Locked (Requires: {comp.requiredTech})</div>}
                                                </div>
                                            );
                                        })}
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Fitted components */}
                        <div className={selectedDesign ? undefined : styles.fitted} style={selectedDesign ? { flex: 1 } : {}}>
                            <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-muted)', marginBottom: 8 }}>
                                Fitted Modules ({(selectedDesign ? selectedDesign.components : selectedComponents).length})
                            </div>
                            {(selectedDesign ? selectedDesign.components : selectedComponents).map((comp: ShipComponent, i: number) => (
                                <div key={i} className="list-item" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <div>
                                        <div style={{ fontSize: 11, fontWeight: 500 }}>{comp.name}</div>
                                        <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{comp.type} · {comp.size}t</div>
                                    </div>
                                    {!selectedDesign && (
                                        <button className="btn btn-danger btn-sm btn-icon" onClick={() => removeComponent(i)} title="Remove">×</button>
                                    )}
                                </div>
                            ))}
                            {(selectedDesign ? selectedDesign.components : selectedComponents).length === 0 && (
                                <div style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'center', padding: 12 }}>
                                    {selectedDesign ? 'No modules installed' : 'Click components to fit them'}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </MainArea>
        </RosterShell>
    );
}
