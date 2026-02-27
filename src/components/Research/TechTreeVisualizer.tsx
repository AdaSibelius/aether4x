'use client';
import { Technology } from '@/types';
import styles from './Research.module.css';

interface Props {
    technologies: Technology[];
    completedTechs: Set<string>;
    availableTechs: Set<string>;
    activeTechIds: Set<string>;
    onSelect: (tech: Technology) => void;
}

const TIER_WIDTH = 320;
const NODE_HEIGHT = 160;
const CARD_WIDTH = 240;
const CARD_HEIGHT = 120;

export default function TechTreeVisualizer({ technologies, completedTechs, availableTechs, activeTechIds, onSelect }: Props) {
    // 1. Calculate Positions based on Tier and within-tier index
    const nodes = technologies.map((tech, i) => {
        const tierNodes = technologies.filter(t => t.tier === tech.tier);
        const tierIndex = tierNodes.indexOf(tech);

        return {
            ...tech,
            x: tech.tier * TIER_WIDTH + 40,
            y: tierIndex * NODE_HEIGHT + 60
        };
    });

    const connections: { x1: number, y1: number, x2: number, y2: number, id: string, isCompleted: boolean }[] = [];
    nodes.forEach(node => {
        node.prerequisites.forEach(prereqId => {
            const prereqNode = nodes.find(n => n.id === prereqId);
            if (prereqNode) {
                connections.push({
                    x1: prereqNode.x + CARD_WIDTH,
                    y1: prereqNode.y + CARD_HEIGHT / 2,
                    x2: node.x,
                    y2: node.y + CARD_HEIGHT / 2,
                    id: `${prereqId}-${node.id}`,
                    isCompleted: completedTechs.has(prereqId)
                });
            }
        });
    });

    const maxTier = Math.max(...technologies.map(t => t.tier), 0);
    const maxNodesInTier = Math.max(...[0, 1, 2, 3, 4, 5, 6, 7, 8].map(tier => technologies.filter(t => t.tier === tier).length), 1);

    const width = (maxTier + 1) * TIER_WIDTH + 100;
    const height = maxNodesInTier * NODE_HEIGHT + 100;

    return (
        <div className={styles.treeScrollContainer}>
            <svg width={width} height={height} className={styles.treeSvg}>
                <defs>
                    <filter id="nodeShadow">
                        <feDropShadow dx="0" dy="2" stdDeviation="4" floodOpacity="0.4" />
                    </filter>
                </defs>

                {/* Draw Connections */}
                {connections.map(conn => (
                    <path
                        key={conn.id}
                        d={`M ${conn.x1} ${conn.y1} C ${conn.x1 + 40} ${conn.y1}, ${conn.x2 - 40} ${conn.y2}, ${conn.x2} ${conn.y2}`}
                        className={styles.connector}
                        style={{
                            stroke: conn.isCompleted ? 'var(--accent-blue)' : 'var(--border-dim)',
                            opacity: conn.isCompleted ? 0.7 : 0.25
                        }}
                    />
                ))}

                {/* Draw Nodes using foreignObject for HTML cards */}
                {nodes.map(node => {
                    const isDone = completedTechs.has(node.id);
                    const isAvail = availableTechs.has(node.id);
                    const isActive = activeTechIds.has(node.id);
                    const isLocked = !isDone && !isAvail;

                    let statusClass = styles.nodeLocked;
                    if (isDone) statusClass = styles.nodeDone;
                    else if (isActive) statusClass = styles.nodeActive;
                    else if (isAvail) statusClass = styles.nodeAvailable;

                    return (
                        <foreignObject
                            key={node.id}
                            x={node.x}
                            y={node.y}
                            width={CARD_WIDTH}
                            height={CARD_HEIGHT}
                            className={`${styles.nodeGroup} ${statusClass}`}
                        >
                            <div
                                className={styles.treeNodeCard}
                                onClick={() => !isDone && isAvail && !isActive && onSelect(node)}
                            >
                                <div className={styles.nodeCardHeader}>
                                    <span className={styles.nodeCardName}>{node.name}</span>
                                    <span className={styles.nodeCardCost}>T{node.tier}</span>
                                </div>
                                <div className={styles.nodeCardDesc}>{node.description}</div>
                                <div className={styles.nodeCardEffects}>
                                    {node.effects.slice(0, 2).map((e, idx) => (
                                        <span key={idx} className={styles.effect} style={{ fontSize: 8 }}>
                                            {e.type.replace(/_/g, ' ')}
                                        </span>
                                    ))}
                                    {node.effects.length > 2 && <span className={styles.effect} style={{ fontSize: 8 }}>...</span>}
                                </div>
                                {isActive && <div className={styles.activeIndicator} style={{
                                    position: 'absolute',
                                    bottom: 4,
                                    right: 4,
                                    width: 8,
                                    height: 8,
                                    background: 'var(--accent-blue)',
                                    borderRadius: '50%',
                                    boxShadow: '0 0 5px var(--accent-blue)'
                                }} />}
                                <div style={{
                                    marginTop: 4,
                                    fontSize: 9,
                                    fontWeight: 'bold',
                                    color: isDone ? 'var(--accent-green)' : isActive ? 'var(--accent-blue)' : isAvail ? 'var(--accent-gold)' : 'var(--accent-red)'
                                }}>
                                    {isDone ? 'COMPLETED' : isActive ? 'ACTIVE' : isAvail ? `${node.cost} RP` : 'LOCKED'}
                                </div>
                            </div>
                        </foreignObject>
                    );
                })}
            </svg>
        </div>
    );
}
