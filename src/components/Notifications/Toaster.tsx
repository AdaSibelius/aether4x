'use client';
import React, { useEffect } from 'react';
import { useUIStore } from '@/store/uiStore';
import styles from './Toaster.module.css';

export default function Toaster() {
    const notifications = useUIStore(s => s.notifications);
    const clearNotifications = useUIStore(s => s.clearNotifications);

    useEffect(() => {
        if (notifications.length > 0) {
            const timer = setTimeout(() => {
                clearNotifications();
            }, 8000);
            return () => clearTimeout(timer);
        }
    }, [notifications, clearNotifications]);

    if (notifications.length === 0) return null;

    return (
        <div className={styles.toaster}>
            {notifications.map((msg, i) => (
                <div key={i} className={styles.toast} onClick={() => clearNotifications()}>
                    <div className={styles.toastGlitch} />
                    {msg}
                </div>
            ))}
        </div>
    );
}
