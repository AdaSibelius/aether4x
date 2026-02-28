import React, { useState } from 'react';
import { useGameStore } from '@/store/gameStore';
import { useUIStore } from '@/store/uiStore';
import { BALANCING } from '@/engine/constants';
import { SurfaceTab, AtmosphereTab, PlanetVisualizer } from '@/components/SharedTabs/SharedTabs';
import { RosterShell, SidebarSection, RosterGroup, RosterItem, MainArea, NestedList } from '@/components/Roster/Roster';
import type { Planet } from '@/types';
import styles from './CelestialBodiesView.module.css';

type Tab = 'Surface' | 'Atmosphere';
type SortKey = 'name' | 'bodyType' | 'atmosphere' | string;

export default function CelestialBodiesView() {
    const game = useGameStore(s => s.game);
    const { selectedStarId, selectedPlanetId, selectPlanet, selectStar } = useUIStore();
    const [activeTab, setActiveTab] = useState<Tab>('Surface');
    const [showSummary, setShowSummary] = useState(false);
    const [sortConfig, setSortConfig] = useState<{ key: SortKey; direction: 'asc' | 'desc' } | null>(null);

    if (!game) return null;

    // Get all stars for the system selector
    const allStars = Object.values(game.galaxy.stars).sort((a, b) => a.name.localeCompare(b.name));

    // Fallback if no star selected
    const starId = selectedStarId || allStars[0]?.id;
    const star = starId ? game.galaxy.stars[starId] : null;

    if (!star) {
        return (
            <div className={styles.empty}>
                <span>No star systems discovered</span>
            </div>
        );
    }

    // Helper to find any body (planet or moon) by ID
    const findBodyById = (id: string | null): Planet | null => {
        if (!id || !star) return null;
        for (const p of star.planets) {
            if (p.id === id) return p;
            if (p.moons) {
                const moon = p.moons.find(m => m.id === id);
                if (moon) return moon;
            }
        }
        return null;
    };

    const selectedPlanet = findBodyById(selectedPlanetId);
    // If selectedPlanetId is "star_[id]", then we are selecting the star itself
    const isStarSelected = selectedPlanetId === `star_${star.id}`;

    const allPlanetLikeBodies = star.planets.flatMap(p => [p, ...(p.moons || [])]);

    const handleSort = (key: SortKey) => {
        let direction: 'asc' | 'desc' = 'asc';
        if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ key, direction });
    };

    const sortedPlanets = [...allPlanetLikeBodies].sort((a, b) => {
        if (!sortConfig) return 0;
        const { key, direction } = sortConfig;

        let aVal: string | number;
        let bVal: string | number;

        if (key === 'name' || key === 'bodyType' || key === 'atmosphere') {
            aVal = a[key as keyof Planet] as string | number;
            bVal = b[key as keyof Planet] as string | number;
        } else {
            aVal = a.minerals.find(m => m.name === key)?.amount || 0;
            bVal = b.minerals.find(m => m.name === key)?.amount || 0;
        }

        if (aVal < bVal) return direction === 'asc' ? -1 : 1;
        if (aVal > bVal) return direction === 'asc' ? 1 : -1;
        return 0;
    });

    const getSortIcon = (key: SortKey) => {
        if (sortConfig?.key !== key) return null;
        return <span className={styles.sortIcon}>{sortConfig.direction === 'asc' ? '▲' : '▼'}</span>;
    };

    const sidebarHeader = (
        <select
            value={star.id}
            onChange={(e) => {
                selectStar(e.target.value);
                const newStar = game.galaxy.stars[e.target.value];
                if (newStar && newStar.planets.length > 0) {
                    selectPlanet(newStar.planets[0].id);
                }
            }}
            className={styles.systemDropdown}
        >
            {allStars.map(s => (
                <option key={s.id} value={s.id}>{s.name} System</option>
            ))}
        </select>
    );

    return (
        <RosterShell>
            <SidebarSection header={sidebarHeader}>
                {/* Stars Group */}
                <RosterGroup title="STARS">
                    <RosterItem
                        name={star.name}
                        subtitle={`${star.spectralType} Type Star`}
                        active={isStarSelected}
                        onClick={() => selectPlanet(`star_${star.id}`)}
                        thumbnail={
                            <PlanetVisualizer
                                planet={{
                                    id: star.id,
                                    name: star.name,
                                    type: 'Star',
                                    subtype: 'MainSequence',
                                    bodyType: 'MainSequence',
                                    atmosphere: 'None',
                                } as Planet}
                                compact
                            />
                        }
                    />
                </RosterGroup>

                {/* Planets Group */}
                {star.planets.filter(p => p.type === 'Planet').length > 0 && (
                    <RosterGroup title="PLANETS">
                        {star.planets.filter(p => p.type === 'Planet').map(planet => (
                            <React.Fragment key={planet.id}>
                                <RosterItem
                                    name={planet.name}
                                    subtitle={planet.subtype || planet.bodyType}
                                    active={planet.id === selectedPlanetId}
                                    onClick={() => selectPlanet(planet.id)}
                                    thumbnail={<PlanetVisualizer planet={planet} compact />}
                                />
                                {planet.moons && planet.moons.length > 0 && (
                                    <NestedList>
                                        {planet.moons.map(moon => (
                                            <RosterItem
                                                key={moon.id}
                                                name={moon.name}
                                                subtitle={`${moon.subtype} Moon`}
                                                active={moon.id === selectedPlanetId}
                                                onClick={() => selectPlanet(moon.id)}
                                                nested
                                                thumbnail={<PlanetVisualizer planet={moon} compact />}
                                            />
                                        ))}
                                    </NestedList>
                                )}
                            </React.Fragment>
                        ))}
                    </RosterGroup>
                )}

                {/* Asteroids Group */}
                {star.planets.filter(p => p.type === 'Asteroid').length > 0 && (
                    <RosterGroup title="ASTEROIDS">
                        {star.planets.filter(p => p.type === 'Asteroid').map(asteroid => (
                            <RosterItem
                                key={asteroid.id}
                                name={asteroid.name}
                                subtitle={asteroid.subtype || asteroid.bodyType}
                                active={asteroid.id === selectedPlanetId}
                                onClick={() => selectPlanet(asteroid.id)}
                                thumbnail={<PlanetVisualizer planet={asteroid} compact />}
                            />
                        ))}
                    </RosterGroup>
                )}

                {/* Comets Group */}
                {star.planets.filter(p => p.type === 'Comet').length > 0 && (
                    <RosterGroup title="COMETS">
                        {star.planets.filter(p => p.type === 'Comet').map(comet => (
                            <RosterItem
                                key={comet.id}
                                name={comet.name}
                                subtitle={comet.subtype || comet.bodyType}
                                active={comet.id === selectedPlanetId}
                                onClick={() => selectPlanet(comet.id)}
                                thumbnail={<PlanetVisualizer planet={comet} compact />}
                            />
                        ))}
                    </RosterGroup>
                )}
            </SidebarSection>

            <MainArea
                title={isStarSelected ? star.name : (selectedPlanet?.name || 'No Object Selected')}
                subtitle={isStarSelected ? `Primary Star · ${star.spectralType} Type` : (selectedPlanet ? `${selectedPlanet.type} · ${selectedPlanet.subtype}` : undefined)}
                headerActions={
                    <div style={{ display: 'flex', gap: 8 }}>
                        {isStarSelected && (() => {
                            const isTenderOpen = (game.tenders || []).some(t => t.systemId === star.id);
                            return (
                                <button
                                    className="btn btn-primary"
                                    onClick={() => useGameStore.getState().openMiningTender(star.id)}
                                    disabled={isTenderOpen}
                                    title={isTenderOpen ? "Tender already in progress" : "Open system extraction rights to corporate bidding"}
                                >
                                    <span style={{ marginRight: 6 }}>📜</span> {isTenderOpen ? "Tender Active" : "Release for Mining Tender"}
                                </button>
                            );
                        })()}
                        {!isStarSelected && selectedPlanet && !Object.values(game.colonies).some(c => c.planetId === selectedPlanet.id) && (
                            <button
                                className="btn btn-primary"
                                onClick={() => useGameStore.getState().establishColony(selectedPlanet.id, `${selectedPlanet.name} Prime`)}
                            >
                                <span style={{ marginRight: 6 }}>🚩</span> Mark as Colony
                            </button>
                        )}
                        <button className="btn btn-secondary" onClick={() => setShowSummary(true)}>
                            <span style={{ marginRight: 6 }}>📋</span> System Summary
                        </button>
                    </div>
                }
                isEmpty={!selectedPlanet && !isStarSelected}
                emptyMessage="Select an object from the sidebar"
            >
                {isStarSelected ? (
                    <div className={styles.tabContentContainer}>
                        <PlanetVisualizer
                            planet={{
                                id: star.id,
                                name: star.name,
                                type: 'Star',
                                subtype: 'MainSequence',
                                bodyType: 'MainSequence',
                                atmosphere: 'None',
                            } as Planet}
                        />
                    </div>
                ) : (
                    <>
                        <div className={styles.tabs}>
                            {(['Surface', 'Atmosphere'] as Tab[]).map(tab => (
                                <button
                                    key={tab}
                                    className={`${styles.tabBtn} ${activeTab === tab ? styles.active : ''}`}
                                    onClick={() => setActiveTab(tab)}
                                >
                                    {tab}
                                </button>
                            ))}
                        </div>

                        <div className={styles.tabContentContainer}>
                            {activeTab === 'Surface' && <SurfaceTab planet={selectedPlanet} colony={undefined} />}
                            {activeTab === 'Atmosphere' && <AtmosphereTab planet={selectedPlanet} />}
                        </div>
                    </>
                )}
            </MainArea>

            {/* System Summary Modal (keeping existing logic) */}
            {showSummary && (
                <div className={styles.modalOverlay} onClick={() => setShowSummary(false)}>
                    <div className={styles.modalContent} onClick={e => e.stopPropagation()}>
                        <div className={styles.modalHeader}>
                            <h3>{star.name} System Summary</h3>
                            <button className={styles.closeBtn} onClick={() => setShowSummary(false)}>×</button>
                        </div>
                        <div className={styles.modalBody}>
                            <table className={`data-table ${styles.modalTable}`}>
                                <thead>
                                    <tr>
                                        <th className={styles.sortableHeader} onClick={() => handleSort('name')} style={{ minWidth: 120 }}>
                                            Name {getSortIcon('name')}
                                        </th>
                                        <th className={styles.sortableHeader} onClick={() => handleSort('bodyType')} style={{ minWidth: 100 }}>
                                            Type {getSortIcon('bodyType')}
                                        </th>
                                        <th className={styles.sortableHeader} onClick={() => handleSort('atmosphere')} style={{ minWidth: 120 }}>
                                            Atmosphere {getSortIcon('atmosphere')}
                                        </th>
                                        {BALANCING.MINERAL_NAMES.map(m => (
                                            <th key={m} className={styles.sortableHeader} onClick={() => handleSort(m)} style={{ minWidth: 100 }}>
                                                {m} {getSortIcon(m)}
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {sortedPlanets.map(planet => (
                                        <tr key={planet.id} className={styles.modalRow}>
                                            <td style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{planet.name}</td>
                                            <td>{planet.bodyType}</td>
                                            <td>{planet.atmosphere}</td>
                                            {BALANCING.MINERAL_NAMES.map(mName => {
                                                const mins = planet.minerals.find(m => m.name === mName);
                                                if (!mins) return <td key={mName} className={styles.mineralEmpty}>-</td>;

                                                const totalAmount = mins.amount;
                                                const avgAccess = mins.accessibility;

                                                return (
                                                    <td key={mName} className={styles.mineralCell}>
                                                        <span className={styles.mineralAmount}>{Math.floor(totalAmount)}</span>
                                                        <span className={styles.mineralAcc}>{(avgAccess * 100).toFixed(0)}%</span>
                                                    </td>
                                                );
                                            })}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}
        </RosterShell>
    );
}
