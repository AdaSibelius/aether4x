import React, { useState } from 'react';
import { useGameStore } from '@/store/gameStore';
import { getPlanetPosition } from '@/engine/fleets';
import { useUIStore } from '@/store/uiStore';
import { RosterShell, SidebarSection, RosterGroup, RosterItem, MainArea } from '@/components/Roster/Roster';
import styles from './FleetManager.module.css';

export default function FleetManager() {
    const game = useGameStore(s => s.game);
    const { selectedFleetId, selectFleet } = useUIStore();
    const [selectedShipId, setSelectedShipId] = useState<string | null>(null);
    const [showCivilian, setShowCivilian] = useState(false);

    const [orderType, setOrderType] = useState<'MoveTo' | 'Survey' | 'Transport'>('MoveTo');
    const [targetPlanetId, setTargetPlanetId] = useState<string>('');
    const [cargoAction, setCargoAction] = useState<'Load' | 'Unload'>('Load');
    const [resourceName, setResourceName] = useState<string>('Iron');

    if (!game) return null;
    const empire = game.empires[game.playerEmpireId];
    if (!empire) return null;

    const fleets = empire.fleets;
    const militaryFleets = fleets.filter(f => !f.isCivilian);
    const civilianFleets = fleets.filter(f => f.isCivilian);

    console.log('[FleetManager] Total fleets:', fleets.length, 'Military:', militaryFleets.length, 'Civilian:', civilianFleets.length);
    console.log('[FleetManager] showCivilian state:', showCivilian);

    const selectedFleet = fleets.find(f => f.id === selectedFleetId);

    // Diagnostic for transfer dropdown
    if (selectedFleet) {
        const matchingFleets = fleets.filter(f => f.id !== selectedFleet.id && f.currentStarId === selectedFleet.currentStarId);
        console.log('[FleetManager] Selected Fleet:', selectedFleet.name, 'StarId:', selectedFleet.currentStarId);
        console.log('[FleetManager] Matching fleets in system:', matchingFleets.map(f => `${f.name} (${f.currentStarId})`));
    }

    return (
        <RosterShell>
            <SidebarSection
                header={
                    <div style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 8,
                        paddingBottom: 8,
                        borderBottom: '1px solid rgba(255,255,255,0.1)'
                    }}>
                        <div style={{
                            fontFamily: 'Orbitron',
                            fontSize: 11,
                            color: 'var(--accent-blue)',
                            textTransform: 'uppercase',
                            letterSpacing: '0.1em',
                        }}>
                            Admiralty Board ({fleets.length})
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10, color: 'var(--text-muted)' }}>
                            <input
                                type="checkbox"
                                checked={showCivilian}
                                onChange={e => setShowCivilian(e.target.checked)}
                                id="show-civilian-toggle"
                            />
                            <label htmlFor="show-civilian-toggle" style={{ cursor: 'pointer' }}>Show Corporate Fleets</label>
                        </div>
                    </div>
                }
            >
                <RosterGroup title="MILITARY FLEETS" icon="⚓">
                    {militaryFleets.map(fleet => {
                        const admiral = empire.officers.find(o => o.id === fleet.admiralId);
                        return (
                            <RosterItem
                                key={fleet.id}
                                name={fleet.name}
                                active={fleet.id === selectedFleetId}
                                onClick={() => selectFleet(fleet.id)}
                                subtitle={
                                    <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
                                        <span>{fleet.shipIds.length} Ships</span>
                                        <span style={{ fontSize: 9 }}>{admiral?.name || 'No Admiral'}</span>
                                    </div>
                                }
                            />
                        );
                    })}
                </RosterGroup>

                {showCivilian && civilianFleets.length > 0 && (
                    <RosterGroup title="CORPORATE FLEETS" icon="🏢">
                        {civilianFleets.map(fleet => (
                            <RosterItem
                                key={fleet.id}
                                name={fleet.name}
                                active={fleet.id === selectedFleetId}
                                onClick={() => selectFleet(fleet.id)}
                                className={styles.civilianItem}
                                subtitle={
                                    <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
                                        <span>{fleet.shipIds.length} Ships</span>
                                        <span style={{ fontSize: 9, color: 'var(--accent-gold)' }}>Civilian</span>
                                    </div>
                                }
                            />
                        ))}
                    </RosterGroup>
                )}
            </SidebarSection>

            <MainArea
                title={selectedFleet?.name || 'No Fleet Selected'}
                subtitle={selectedFleet && `Fleet HQ · ${game.galaxy.stars[selectedFleet.currentStarId]?.name || 'Unknown'}`}
                isEmpty={!selectedFleet}
                emptyMessage="Select a fleet to view details"
            >
                {selectedFleet && (
                    <div style={{ padding: '0 16px' }}>
                        <div className="data-grid" style={{ marginBottom: 24 }}>
                            <div>
                                <label>Location</label>
                                <div className="value">
                                    {game.galaxy.stars[selectedFleet.currentStarId]?.name ?? 'Unknown Space'}
                                    {selectedFleet.orbitingPlanetId && (
                                        <span style={{ fontSize: 10, color: 'var(--accent-blue)', marginLeft: 8 }}>
                                            (Orbiting {game.galaxy.stars[selectedFleet.currentStarId]?.planets.find(p => p.id === selectedFleet.orbitingPlanetId)?.name || 'Unknown Body'})
                                        </span>
                                    )}
                                </div>
                            </div>
                            <div>
                                <label>Status</label>
                                <div className="value">
                                    {selectedFleet.destination ? 'In Transit' : selectedFleet.orbitingPlanetId ? 'Stable Orbit' : 'Idle'}
                                </div>
                            </div>
                            <div>
                                <label>Commanding Officer</label>
                                <div className="value">
                                    {selectedFleet.isCivilian ? (
                                        <span style={{ color: 'var(--accent-gold)', fontSize: 11 }}>Civilian Control</span>
                                    ) : (
                                        <select
                                            className="input-field"
                                            value={selectedFleet.admiralId || ''}
                                            onChange={e => {
                                                const newAdmiralId = e.target.value || undefined;
                                                useGameStore.getState().updateFleet(empire.id, selectedFleet.id, { admiralId: newAdmiralId });
                                            }}
                                            style={{ padding: '4px', fontSize: 12 }}
                                        >
                                            <option value="">No Admiral</option>
                                            {empire.officers.filter(o => o.role === 'Admiral').map(o => (
                                                <option key={o.id} value={o.id}>{o.name}</option>
                                            ))}
                                        </select>
                                    )}
                                </div>
                            </div>
                            <div>
                                <label>Current Orders</label>
                                <div className="value">
                                    {selectedFleet.orders.length > 0 ? (
                                        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                                            <span>{selectedFleet.orders[0].type}</span>
                                            <button
                                                className="btn btn-secondary"
                                                style={{ padding: '2px 8px', fontSize: 10 }}
                                                onClick={() => useGameStore.getState().updateFleet(empire.id, selectedFleet.id, { orders: [], destination: undefined })}
                                            >
                                                Cancel
                                            </button>
                                        </div>
                                    ) : 'Idle - Holding Position'}
                                </div>
                            </div>
                            {selectedFleet.destination && (
                                <>
                                    <div>
                                        <label>ETA</label>
                                        <div className="value" style={{ color: 'var(--accent-blue)' }}>
                                            {selectedFleet.destination.etaSeconds ?
                                                `${Math.ceil(selectedFleet.destination.etaSeconds / 86400)} days` :
                                                'Calculating...'}
                                        </div>
                                    </div>
                                    <div>
                                        <label>Fuel Consumption</label>
                                        <div className="value" style={{ color: 'var(--accent-gold)' }}>
                                            {(selectedFleet.shipIds.reduce((acc: number, sid: string) => {
                                                const s = game.ships[sid];
                                                const d = empire.designLibrary.find(d => d.id === s?.designId);
                                                return acc + (d?.components.reduce((cAcc: number, comp: any) => cAcc + (comp.stats.fuelPerTick || 0), 0) || 0);
                                            }, 0) * 86400).toFixed(1)} / day
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>

                        {/* Order Issuance */}
                        <div className="panel" style={{ marginBottom: 24 }}>
                            <div className="panel-header"><h3>Navigation & Missions</h3></div>
                            <div className="panel-body">
                                <div style={{ marginBottom: 16 }}>
                                    <h4 style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 10 }}>Star System Operations</h4>
                                    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                                        <select
                                            className="input-field"
                                            value={orderType}
                                            onChange={e => setOrderType(e.target.value as typeof orderType)}
                                        >
                                            <option value="MoveTo">Move To Planet</option>
                                            <option value="Survey">Survey Planet</option>
                                            <option value="Transport">Trade / Transport Cargo</option>
                                        </select>

                                        <select
                                            className="input-field"
                                            value={targetPlanetId}
                                            onChange={e => setTargetPlanetId(e.target.value)}
                                        >
                                            <option value="">Select Target...</option>
                                            {game.galaxy.stars[selectedFleet.currentStarId]?.planets.map(p => (
                                                <option key={p.id} value={p.id}>{p.name}</option>
                                            ))}
                                        </select>

                                        {orderType === 'Transport' && (
                                            <>
                                                <select className="input-field" value={cargoAction} onChange={e => setCargoAction(e.target.value as typeof cargoAction)}>
                                                    <option value="Load">Load</option>
                                                    <option value="Unload">Unload</option>
                                                </select>
                                                <select className="input-field" value={resourceName} onChange={e => setResourceName(e.target.value)}>
                                                    {Object.keys(empire.minerals).map(m => (
                                                        <option key={m} value={m}>{m}</option>
                                                    ))}
                                                </select>
                                            </>
                                        )}

                                        <button
                                            className="btn btn-primary"
                                            disabled={!targetPlanetId}
                                            onClick={() => {
                                                const star = game.galaxy.stars[selectedFleet.currentStarId];
                                                const payload: any = { type: orderType, targetPlanetId };
                                                if (orderType === 'Transport') {
                                                    payload.cargoAction = cargoAction;
                                                    payload.resourceName = resourceName;
                                                } else if (orderType === 'MoveTo') {
                                                    const p = star?.planets.find(pl => pl.id === targetPlanetId);
                                                    if (p) payload.targetPosition = getPlanetPosition(p, game.turn);
                                                }
                                                useGameStore.getState().updateFleet(empire.id, selectedFleet.id, { orders: [payload] });
                                            }}
                                        >
                                            Issue Missions
                                        </button>
                                    </div>
                                </div>

                                <div>
                                    <h4 style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 10 }}>Interstellar Jumps</h4>
                                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                                        {game.galaxy.stars[selectedFleet.currentStarId]?.jumpPoints.filter(j => j.discovered).map(jp => {
                                            const dest = game.galaxy.stars[jp.targetStarId];
                                            return (
                                                <button
                                                    key={jp.id}
                                                    className="btn btn-secondary"
                                                    onClick={() => useGameStore.getState().updateFleet(empire.id, selectedFleet.id, { orders: [{ type: 'Jump', targetStarId: jp.targetStarId } as any] })}
                                                >
                                                    Jump: {dest?.name ?? 'Unknown'}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="panel">
                            <div className="panel-header"><h3>Fleet Manifest ({selectedFleet.shipIds.length} Vessels)</h3></div>
                            <div className="panel-body">
                                <div className={styles.shipList}>
                                    {selectedFleet.shipIds.map((sid: string) => {
                                        const ship = game.ships[sid];
                                        if (!ship) return null;
                                        const design = empire.designLibrary.find(d => d.id === ship.designId);
                                        const isSelected = selectedShipId === ship.id;

                                        // Other fleets in same system for transfer target
                                        const otherFleetsInSystem = empire.fleets.filter(f =>
                                            f.id !== selectedFleet.id &&
                                            String(f.currentStarId) === String(selectedFleet.currentStarId)
                                        );

                                        return (
                                            <div key={ship.id} className={`${styles.shipItem} ${isSelected ? styles.shipActive : ''}`} onClick={() => setSelectedShipId(isSelected ? null : ship.id)}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                                    <div>
                                                        <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>{ship.name}</div>
                                                        <div style={{ fontSize: 10, color: 'var(--text-muted)', display: 'flex', gap: 8 }}>
                                                            <span>{design?.name ?? 'Unknown Class'}</span>
                                                            <span>HP: {ship.hullPoints}/{ship.maxHullPoints}</span>
                                                            <span>Fuel: {ship.fuel.toFixed(0)}</span>
                                                        </div>
                                                    </div>

                                                    {isSelected && (
                                                        <div style={{ display: 'flex', gap: 4 }}>
                                                            {otherFleetsInSystem.length > 0 && (
                                                                <select
                                                                    className="input-field"
                                                                    style={{ fontSize: 10, padding: '2px 4px' }}
                                                                    onChange={(e) => {
                                                                        const targetFleetId = e.target.value;
                                                                        if (targetFleetId) {
                                                                            useGameStore.getState().transferShip(empire.id, selectedFleet.id, targetFleetId, ship.id);
                                                                            setSelectedShipId(null);
                                                                        }
                                                                    }}
                                                                    value=""
                                                                >
                                                                    <option value="" disabled>Transfer...</option>
                                                                    {otherFleetsInSystem.map(f => (
                                                                        <option key={f.id} value={f.id}>{f.name}</option>
                                                                    ))}
                                                                </select>
                                                            )}
                                                            <button
                                                                className="btn btn-secondary"
                                                                style={{ padding: '2px 8px', fontSize: 10 }}
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    useGameStore.getState().splitFleet(empire.id, selectedFleet.id, ship.id);
                                                                    setSelectedShipId(null);
                                                                }}
                                                                disabled={selectedFleet.shipIds.length <= 1}
                                                            >
                                                                Split
                                                            </button>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </MainArea>
        </RosterShell>
    );
}
