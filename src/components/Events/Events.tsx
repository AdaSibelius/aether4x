'use client';
import { useGameStore } from '@/store/gameStore';
import styles from './Events.module.css';

const EVENT_ICONS: Record<string, string> = {
    ResearchComplete: '🔬',
    ColonyFounded: '🏙️',
    ShipBuilt: '🚀',
    ContactMade: '📡',
    CombatResult: '⚔️',
    MineralsFound: '⛏️',
    JumpPointFound: '🌀',
    SystemExplored: '🌟',
    PopulationMilestone: '👥',
};

export default function Events() {
    const game = useGameStore(s => s.game);
    if (!game) return <div className={styles.empty}>No game in progress.</div>;

    const empire = game.empires[game.playerEmpireId];
    const events = empire.events.slice(0, 50);

    return (
        <div className={styles.container}>
            <div className={styles.header}>
                <h2>Event Log</h2>
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{events.length} events</span>
            </div>
            <div className={styles.list}>
                {events.length === 0 && (
                    <div className={styles.empty}>No events yet. Advance time to see activity.</div>
                )}
                {events.map(evt => (
                    <div key={evt.id} className={`${styles.eventItem} ${evt.important ? styles.important : ''}`}>
                        <div className={styles.eventIcon}>{EVENT_ICONS[evt.type] ?? '📋'}</div>
                        <div className={styles.eventBody}>
                            <div className={styles.eventMessage}>{evt.message}</div>
                            <div className={styles.eventMeta}>
                                <span>{evt.date}</span>
                                <span className={`badge ${evt.important ? 'badge-gold' : 'badge-blue'}`}>{evt.type}</span>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
