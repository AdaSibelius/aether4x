'use client';
import { useGameStore } from '@/store/gameStore';
import { useUIStore } from '@/store/uiStore';
import type { UIView } from '@/types';
import styles from './Sidebar.module.css';

const NAV_ITEMS: { view: UIView; label: string; icon: string }[] = [
    { view: 'Galaxy', label: 'Galaxy', icon: '🌌' },
    { view: 'System', label: 'System', icon: '🪐' },
    { view: 'Dashboard', label: 'Empire', icon: '🏛️' },
    { view: 'Economy', label: 'Economy', icon: '📈' },
    { view: 'Companies', label: 'Companies', icon: '🏢' },
    { view: 'Research', label: 'Research', icon: '🔬' },
    { view: 'ShipDesign', label: 'Designs', icon: '🛠️' },
    { view: 'Fleets', label: 'Fleets', icon: '🚀' },
    { view: 'Colonies', label: 'Colonies', icon: '🏙️' },
    { view: 'Planets', label: 'Celestial Bodies', icon: '🌍' },
    { view: 'Officers', label: 'Officers', icon: '👨‍✈️' },
    { view: 'Events', label: 'Events', icon: '📡' },
];

export default function Sidebar() {
    const game = useGameStore(s => s.game);
    const { activeView, setView } = useUIStore();

    const empire = game ? game.empires[game.playerEmpireId] : null;
    const date = game ? new Date(game.date).toISOString().split('T')[0] : '—';
    const unreadEvents = empire?.events.filter(e => e.important).length ?? 0;

    return (
        <aside className={styles.sidebar}>
            {/* Logo */}
            <div className={styles.logo}>
                <span className={styles.logoText}>NEBULA</span>
                <span className={styles.logo4x}>4X</span>
            </div>

            {/* Empire info */}
            {empire && (
                <div className={styles.empireCard}>
                    <div className={styles.empireName}>{empire.name}</div>
                    <div className={styles.empireDate}>{date}</div>
                    <div className={styles.empireStat}>
                        <span>Treasury</span>
                        <span className="stat-value good">{empire.treasury.toLocaleString()}</span>
                    </div>
                </div>
            )}

            {/* Navigation */}
            <nav className={styles.nav}>
                {NAV_ITEMS.map(item => (
                    <button
                        key={item.view}
                        className={`${styles.navItem} ${activeView === item.view ? styles.active : ''}`}
                        onClick={() => setView(item.view)}
                        title={item.label}
                    >
                        <span className={styles.navIcon}>{item.icon}</span>
                        <span className={styles.navLabel}>{item.label}</span>
                        {item.view === 'Events' && unreadEvents > 0 && (
                            <span className={styles.badge}>{unreadEvents}</span>
                        )}
                    </button>
                ))}
            </nav>

            {/* Bottom minerals quick-view */}
            {empire && (
                <div className={styles.minerals}>
                    <div className={styles.mineralsTitle}>Stockpiles</div>
                    {Object.entries(empire.minerals)
                        .filter(([, v]) => v > 0)
                        .slice(0, 5)
                        .map(([name, amount]) => (
                            <div key={name} className={styles.mineralRow}>
                                <span>{name}</span>
                                <span className="stat-value">{Math.floor(amount).toLocaleString()}</span>
                            </div>
                        ))}
                </div>
            )}
        </aside>
    );
}
