'use client';
import { useEffect, useRef } from 'react';
import { useGameStore } from '@/store/gameStore';
import { useUIStore } from '@/store/uiStore';
import type { TickLength } from '@/types';
import styles from './ControlBar.module.css';

const TICK_OPTIONS: { label: string; value: TickLength }[] = [
    { label: '5s', value: 5 },
    { label: '1m', value: 60 },
    { label: '1h', value: 3600 },
    { label: '1d', value: 86400 },
    { label: '5d', value: 432000 },
    { label: '30d', value: 2592000 },
];

export default function ControlBar() {
    const { game, advanceTurn, setTickLength, isRunning, setAutoRun, quitToMenu } = useGameStore();
    const { showDebugConsole, toggleDebugConsole } = useUIStore();
    const intervalRef = useRef<NodeJS.Timeout | null>(null);

    useEffect(() => {
        if (isRunning) {
            intervalRef.current = setInterval(() => {
                advanceTurn();
            }, 500);
        } else {
            if (intervalRef.current) clearInterval(intervalRef.current);
        }
        return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
    }, [isRunning, advanceTurn]);

    if (!game) return null;

    const date = new Date(game.date).toISOString().split('T')[0];
    const turn = game.turn;
    const years = Math.floor(turn / 31536000);
    const days = Math.floor((turn % 31536000) / 86400);

    return (
        <div className={styles.bar}>
            {/* Date / Turn */}
            <div className={styles.dateBlock}>
                <span className={styles.date}>{date}</span>
                <span className={styles.turnInfo}>Turn {game.turn / 86400 | 0} · Year {years} · Day {days}</span>
            </div>

            {/* Tick length selector */}
            <div className={styles.tickGroup}>
                <span className={styles.label}>Tick:</span>
                {TICK_OPTIONS.map(opt => (
                    <button
                        key={opt.value}
                        className={`btn btn-secondary btn-sm ${game.tickLength === opt.value ? styles.activeTick : ''}`}
                        onClick={() => setTickLength(opt.value)}
                    >
                        {opt.label}
                    </button>
                ))}
            </div>

            {/* Controls */}
            <div className={styles.controls}>
                <button
                    className={`btn btn-secondary ${styles.advanceBtn}`}
                    onClick={() => advanceTurn()}
                    disabled={isRunning}
                    title="Advance one tick (Space)"
                >
                    ▶ Advance
                </button>
                <button
                    className={`btn ${isRunning ? 'btn-danger' : 'btn-primary'} ${styles.autoBtn}`}
                    onClick={() => setAutoRun(!isRunning)}
                    title={isRunning ? 'Pause' : 'Auto-advance'}
                >
                    {isRunning ? '⏸ Pause' : '⏩ Auto'}
                </button>
                <div style={{ width: 1, height: 24, background: 'rgba(255,255,255,0.2)', margin: '0 8px' }} />
                <button
                    className={`btn btn-secondary`}
                    onClick={quitToMenu}
                    title="Quit to Main Menu"
                >
                    ⏏️ Quit
                </button>
                <div style={{ width: 1, height: 24, background: 'rgba(255,255,255,0.2)', margin: '0 8px' }} />
                <button
                    className={`btn btn-secondary ${showDebugConsole ? styles.activeDebug : ''}`}
                    onClick={() => toggleDebugConsole()}
                    title="Toggle Developer Console"
                >
                    🛠️ Debug
                </button>
            </div>
        </div>
    );
}
