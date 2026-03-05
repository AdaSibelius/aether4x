'use client';
import { useEffect, useRef } from 'react';
import { useGameStore } from '@/store/gameStore';
import { useUIStore } from '@/store/uiStore';

const COMBAT_EVENT_TYPES = new Set(['CombatEngagement', 'ShipDestroyed', 'CombatResult']);

/**
 * Monitors the player's event log for new combat-related events.
 * Triggers a transient Notification (toast) when a battle occurs or a ship is lost.
 */
export default function CombatEventMonitor() {
    const game = useGameStore(s => s.game);
    const addNotification = useUIStore(s => s.addNotification);
    const lastEventIdRef = useRef<string | null>(null);

    useEffect(() => {
        if (!game) return;

        const playerEmpire = game.empires[game.playerEmpireId];
        if (!playerEmpire || !playerEmpire.events || playerEmpire.events.length === 0) return;

        const latestEvent = playerEmpire.events[0];

        // If this is a new event and it's combat related
        if (latestEvent.id !== lastEventIdRef.current) {
            lastEventIdRef.current = latestEvent.id;

            if (COMBAT_EVENT_TYPES.has(latestEvent.type)) {
                // Short, punchy message for the toaster
                let msg = '';
                switch (latestEvent.type) {
                    case 'CombatEngagement':
                        msg = `🛑 ALERT: Engagement detected!`;
                        break;
                    case 'ShipDestroyed':
                        msg = `⚠️ CRITICAL: Ship Lost! ${latestEvent.message}`;
                        break;
                    case 'CombatResult':
                        msg = `📊 Combat Resolved: ${latestEvent.message}`;
                        break;
                    default:
                        msg = latestEvent.message;
                }

                if (msg) {
                    addNotification(msg);
                }
            }
        }
    }, [game, addNotification]);

    return null;
}
