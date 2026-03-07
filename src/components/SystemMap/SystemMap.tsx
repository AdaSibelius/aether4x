import { useGameStore } from '@/store/gameStore';
import { useUIStore } from '@/store/uiStore';
import styles from './SystemMap.module.css';
import SystemMapBabylon from './SystemMapBabylon';

export default function SystemMap() {
    const game = useGameStore(s => s.game);

    const {
        selectedStarId,
        showTradeOverlay, toggleTradeOverlay,
        contextMenu, setContextMenu,
        selectPlanet, selectFleet
    } = useUIStore();

    const star = selectedStarId ? game?.galaxy.stars[selectedStarId] : null;

    if (!star) {
        return (
            <div className={styles.empty}>
                <span>Select a star system in the Galaxy Map</span>
            </div>
        );
    }

    return (
        <div className={styles.container}>
            <div className={styles.header}>
                <span className={styles.starName}>{star.name}</span>
                <span className={styles.spectral}>{star.spectralType}</span>
                <div style={{ marginLeft: 'auto', display: 'flex', gap: 15, alignItems: 'center' }}>
                    <label style={{ fontSize: 11, display: 'flex', gap: 4, alignItems: 'center', cursor: 'pointer', color: showTradeOverlay ? '#69f0ae' : 'var(--text-muted)' }}>
                        <input type="checkbox" checked={showTradeOverlay} onChange={toggleTradeOverlay} style={{ width: 12, height: 12, accentColor: '#69f0ae' }} />
                        Trade Routes
                    </label>
                    <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                        {star.planets.length} bodies · {star.jumpPoints.filter(j => j.discovered).length} jump points
                    </span>
                </div>
            </div>

            <div className={styles.canvasWrapper}>
                <SystemMapBabylon
                    onContextMenu={(targets, x, y) => setContextMenu({ x, y, targets })}
                />
            </div>

            {/* Selection Disambiguation Menu */}
            {contextMenu && (
                <div
                    className={styles.contextMenu}
                    style={{ left: contextMenu.x, top: contextMenu.y }}
                    onClick={e => e.stopPropagation()}
                >
                    <div className={styles.menuHeader}>Select Target</div>
                    {contextMenu.targets.map((t: { id: string, name: string, type: 'Planet' | 'Fleet' | 'Star' }) => (
                        <div
                            key={t.id}
                            className={styles.menuItem}
                            onClick={() => {
                                if (t.type === 'Fleet') {
                                    selectPlanet(null);
                                    selectFleet(t.id);
                                    useUIStore.getState().setView('Fleets');
                                } else { // t.type === 'Planet'
                                    selectPlanet(t.id);
                                    selectFleet(null);
                                    const hasColony = Object.values(useGameStore.getState().game?.colonies || {}).some(c => c.planetId === t.id);
                                    useUIStore.getState().setView(hasColony ? 'Colonies' : 'Planets');
                                }
                                useUIStore.getState().setContextMenu(null);
                            }}
                        >
                            <span className={styles.icon}>{t.type === 'Fleet' ? '🚀' : '🪐'}</span>
                            <span className={styles.name}>{t.name}</span>
                        </div>
                    ))}
                    <div
                        className={styles.menuItem}
                        style={{ borderTop: '1px solid rgba(255,255,255,0.1)', color: 'var(--text-muted)' }}
                        onClick={() => useUIStore.getState().setContextMenu(null)}
                    >
                        Cancel
                    </div>
                </div>
            )}
        </div>
    );
}
