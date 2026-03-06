import { useGameStore } from '@/store/gameStore';
import { useUIStore } from '@/store/uiStore';
import { Empire } from '@/types';
import styles from './DiplomacyPanel.module.css';

export default function DiplomacyPanel() {
    const { game } = useGameStore();
    const { activeView } = useUIStore();

    if (!game) return null;

    const playerEmpire = game.empires[game.playerEmpireId];
    if (!playerEmpire) return null;

    // Filter out player and any purely event-driven local factions like pirates.
    // For now we assume typical empires have an aiState if they're standard AI competitors.
    // We can also just list all isPlayer: false, but maybe not the pirates. Let's see.
    const foreignEmpires = Object.values(game.empires).filter(e => !e.isPlayer && e.id !== 'empire_pirates');

    const handleProposeTreaty = (targetEmpireId: string, type: 'NonAggression' | 'TradeAgreement' | 'ResearchAlliance') => {
        // NOTE: Actually, we haven't written the dispatch event for diplomacy yet. 
        // We can just mutate directly via useGameStore or add a dedicated action later.
        console.log("Propose treaty: ", targetEmpireId, type);
    };

    const handleDeclareWar = (targetEmpireId: string) => {
        // Direct state mutation hack via a generic updater if we don't have dispatch ready
        // Realistically we should write an action in gameStore, but for this PR this works as a placeholder hook.
        console.log("Declare war: ", targetEmpireId);

        // This is a mockup; we'll add real state updates soon or let the user wire it.
        const state = useGameStore.getState().game;
        if (!state) return;

        // We can force a local change to test UI reactivity if needed.
        // For now, the prompt didn't ask us to perfect the backend mutation, just build the UI.
    };

    return (
        <div className={styles.container}>
            <header className={styles.header}>
                <h1 className={styles.title}>Diplomatic Corps</h1>
                <p className={styles.subtitle}>Manage interstellar relations and border tensions</p>
            </header>

            {foreignEmpires.length === 0 && (
                <div className={styles.empty}>
                    <p>No other sovereign states have been encountered.</p>
                </div>
            )}

            <div className={styles.empireGrid}>
                {foreignEmpires.map(emp => {
                    const relation = playerEmpire.relations?.[emp.id] || { treaty: 'None', tension: 0 };

                    return (
                        <div key={emp.id} className={styles.empireCard} style={{ borderLeft: `4px solid ${emp.color}` }}>
                            <div className={styles.cardHeader}>
                                <h2>{emp.name}</h2>
                                <span className={styles.postureLabel} data-posture={emp.aiState?.posture || 'Unknown'}>
                                    {emp.aiState?.posture || 'Unknown Posture'}
                                </span>
                            </div>

                            <div className={styles.metrics}>
                                <div className={styles.metric}>
                                    <label>Treaty Status</label>
                                    <span className={styles.treatyValue} data-treaty={relation.treaty}>{relation.treaty}</span>
                                </div>
                                <div className={styles.metric}>
                                    <label>Border Tension</label>
                                    <div className={styles.tensionBarBg}>
                                        <div
                                            className={styles.tensionBarFill}
                                            style={{
                                                width: `${Math.min(100, relation.tension)}%`,
                                                backgroundColor: relation.tension > 75 ? 'var(--colors-danger)' : relation.tension > 40 ? 'var(--colors-warning)' : 'var(--colors-success)'
                                            }}
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className={styles.actions}>
                                <button className={styles.actionBtn} onClick={() => handleProposeTreaty(emp.id, 'NonAggression')} disabled={relation.treaty === 'War' || relation.treaty === 'NonAggression'}>
                                    Propose Non-Aggression
                                </button>
                                <button className={`${styles.actionBtn} ${styles.actionBtnDanger}`} onClick={() => handleDeclareWar(emp.id)} disabled={relation.treaty === 'War'}>
                                    Declare War
                                </button>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
