'use client';
import React from 'react';
import styles from './Roster.module.css';

interface RosterShellProps {
    children: React.ReactNode;
}

export function RosterShell({ children }: RosterShellProps) {
    return <div className={styles.shell}>{children}</div>;
}

interface SidebarSectionProps {
    children: React.ReactNode;
    header?: React.ReactNode;
    width?: number | string;
}

export function SidebarSection({ children, header, width }: SidebarSectionProps) {
    return (
        <div className={styles.sidebar} style={width ? { width } : {}}>
            {header && <div className={styles.sidebarHeader}>{header}</div>}
            <div className={styles.sidebarScroll}>
                {children}
            </div>
        </div>
    );
}

interface RosterGroupProps {
    children: React.ReactNode;
    title: string;
    icon?: React.ReactNode;
    titleColor?: string;
}

export function RosterGroup({ children, title, icon, titleColor }: RosterGroupProps) {
    return (
        <div className={styles.sidebarGroup}>
            <div className={styles.groupHeader} style={titleColor ? { color: titleColor } : {}}>
                {icon && <span>{icon}</span>}
                <span>{title}</span>
            </div>
            {children}
        </div>
    );
}

interface RosterItemProps {
    name: string;
    subtitle?: React.ReactNode;
    thumbnail?: React.ReactNode;
    active?: boolean;
    onClick: () => void;
    className?: string;
    nested?: boolean;
}

export function RosterItem({ name, subtitle, thumbnail, active, onClick, className, nested }: RosterItemProps) {
    return (
        <button
            className={`${styles.sidebarItem} ${active ? styles.sidebarItemActive : ''} ${className || ''}`}
            onClick={onClick}
        >
            {thumbnail && (
                <div className={styles.thumbnailContainer} style={nested ? { width: 24, height: 24 } : {}}>
                    {thumbnail}
                </div>
            )}
            <div className={styles.sidebarItemMain}>
                <div className={styles.sidebarItemName}>
                    {nested && <span style={{ marginRight: 4, opacity: 0.5 }}>↳</span>}
                    {name}
                </div>
                {subtitle && <div className={styles.sidebarItemStats}>{subtitle}</div>}
            </div>
        </button>
    );
}

interface MainAreaProps {
    children: React.ReactNode;
    title?: string;
    subtitle?: string;
    headerActions?: React.ReactNode;
    isEmpty?: boolean;
    emptyMessage?: string;
}

export function MainArea({ children, title, subtitle, headerActions, isEmpty, emptyMessage }: MainAreaProps) {
    return (
        <div className={styles.mainArea}>
            {(title || headerActions) && (
                <div className={styles.headerBar}>
                    <div className={styles.headerInfo}>
                        {title && <h2 className={styles.title}>{title}</h2>}
                        {subtitle && <span className={styles.subtitle}>{subtitle}</span>}
                    </div>
                    {headerActions && <div>{headerActions}</div>}
                </div>
            )}
            {isEmpty ? (
                <div className={styles.empty}>{emptyMessage || 'Select an item to view details'}</div>
            ) : (
                children
            )}
        </div>
    );
}

export function NestedList({ children }: { children: React.ReactNode }) {
    return <div className={styles.nestedList}>{children}</div>;
}
