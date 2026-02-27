'use client';
import { useGameStore } from '@/store/gameStore';
import styles from './Production.module.css';

export default function Production() {
    const game = useGameStore(s => s.game);
    if (!game) return <div className={styles.empty}>No game in progress.</div>;

    const colonies = Object.values(game.colonies).filter(c => c.empireId === game.playerEmpireId);

    return (
        <div className={styles.container}>
            {colonies.map(colony => (
                <div key={colony.id} className="panel" style={{ marginBottom: 12 }}>
                    <div className="panel-header">
                        <h3>{colony.name}</h3>
                        <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{colony.population.toFixed(1)}M · {colony.factories} factories</span>
                    </div>
                    <div className="panel-body">
                        <div className="stat-row"><span className="stat-label">Factories</span><span className="stat-value">{colony.factories}</span></div>
                        <div className="stat-row"><span className="stat-label">Mines</span><span className="stat-value">{colony.mines}</span></div>
                        <div className="stat-row"><span className="stat-label">Research Labs</span><span className="stat-value">{colony.researchLabs}</span></div>
                        {colony.productionQueue.length > 0 ? (
                            <>
                                <div className="divider" />
                                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>Production Queue</div>
                                {colony.productionQueue.map((item, i) => (
                                    <div key={i} style={{ padding: '6px 0' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                                            <span style={{ fontSize: 12 }}>{item.quantity}x {item.name}</span>
                                            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{item.progress.toFixed(1)}%</span>
                                        </div>
                                        <div className="progress-bar"><div className="progress-fill" style={{ width: `${item.progress}%` }} /></div>
                                    </div>
                                ))}
                            </>
                        ) : (
                            <div style={{ marginTop: 8, fontSize: 11, color: 'var(--text-muted)' }}>Production queue empty.</div>
                        )}
                        <div className="divider" />
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6 }}>Shipyards</div>
                        {colony.shipyards.map(sy => (
                            <div key={sy.id} className="list-item">
                                <span style={{ fontSize: 12 }}>{sy.name}</span>
                                <span style={{ fontSize: 10, color: 'var(--text-muted)' }}> · Max Tonnage: {sy.maxTonnage.toLocaleString()} tons</span>
                            </div>
                        ))}
                    </div>
                </div>
            ))}
            {colonies.length === 0 && (
                <div className={styles.empty}>No colonies yet. Explore and colonize a planet first.</div>
            )}
        </div>
    );
}
