'use client';

import { useState } from 'react';
import { useGameStore } from '@/store/gameStore';
import { useUIStore } from '@/store/uiStore';
import Sidebar from '@/components/Sidebar/Sidebar';
import ControlBar from '@/components/ControlBar/ControlBar';
import GalaxyMap from '@/components/GalaxyMap/GalaxyMap';
import SystemMap from '@/components/SystemMap/SystemMap';
import Dashboard from '@/components/Dashboard/Dashboard';
import Research from '@/components/Research/Research';
import ShipDesign from '@/components/ShipDesign/ShipDesign';
import FleetManager from '@/components/FleetManager/FleetManager';
import OfficerManager from '@/components/Officers/OfficerManager';
import ColonyManager from '@/components/ColonyManager/ColonyManager';
import CelestialBodiesView from '@/components/CelestialBodiesView/CelestialBodiesView';
import Production from '@/components/Production/Production';
import Events from '@/components/Events/Events';
import EconomyView from '@/components/Economy/Economy';
import CorporateManager from '@/components/Economy/CorporateManager';
import CompanyDetailsView from '@/components/Economy/CompanyDetails';
import Toaster from '@/components/Notifications/Toaster';
import CombatEventMonitor from '@/components/Notifications/CombatEventMonitor';
import DiplomacyPanel from '@/components/DiplomacyPanel/DiplomacyPanel';
import styles from './page.module.css';

// ─── Main Menu ───────────────────────────────────────────────────────────────
function MainMenu() {
  const { newGame } = useGameStore();
  const [name, setName] = useState('Terran Federation');
  const [seed, setSeed] = useState('');
  const [realSpace, setRealSpace] = useState(true);
  const [loading, setLoading] = useState(false);

  const handleNew = () => {
    setLoading(true);
    setTimeout(() => {
      newGame(name || 'Terran Federation', seed ? parseInt(seed) : undefined, realSpace);
      const state = useGameStore.getState().game;
      if (state) {
        useUIStore.getState().selectStar(state.empires[state.playerEmpireId].homeSystemId);
      }
      setLoading(false);
    }, 100);
  };

  return (
    <div className={styles.menuOverlay}>
      <div className={styles.menuBg} />
      {/* Star particles - seeded deterministic positions to avoid hydration mismatch */}
      <div className={styles.particles} suppressHydrationWarning>
        {Array.from({ length: 60 }).map((_, i) => {
          const s = (i * 9301 + 49297) % 233280;
          const s2 = (s * 9301 + 49297) % 233280;
          const s3 = (s2 * 9301 + 49297) % 233280;
          const s4 = (s3 * 9301 + 49297) % 233280;
          const s5 = (s4 * 9301 + 49297) % 233280;
          return (
            <div key={i} className={styles.particle} style={{
              left: `${(s / 233280) * 100}%`,
              top: `${(s2 / 233280) * 100}%`,
              width: `${(s3 / 233280) * 2 + 1}px`,
              height: `${(s3 / 233280) * 2 + 1}px`,
              animationDelay: `${(s4 / 233280) * 5}s`,
              animationDuration: `${3 + (s5 / 233280) * 4}s`,
            }} />
          );
        })}
      </div>

      <div className={styles.menuCard}>
        {/* Title */}
        <div className={styles.menuTitle}>
          <span className={styles.menuTitleMain}>AETHER</span>
          <span className={styles.menuTitleSub}>4X</span>
        </div>
        <div className={styles.menuTagline}>A space strategy experience</div>

        <div className={styles.divider} />

        <div className={styles.menuForm}>
          <label className={styles.fieldLabel}>Empire Name</label>
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Terran Federation"
            style={{ width: '100%' }}
          />

          <label className={styles.fieldLabel} style={{ marginTop: 14 }}>Galaxy Seed (optional)</label>
          <input
            value={seed}
            onChange={e => setSeed(e.target.value)}
            placeholder="Random"
            type="number"
            style={{ width: '100%' }}
          />

          <label className={styles.fieldLabel} style={{ marginTop: 14 }}>Scenario</label>
          <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
            <button
              type="button"
              onClick={() => setRealSpace(false)}
              style={{
                flex: 1, padding: '8px 0', borderRadius: 6,
                border: `1px solid ${!realSpace ? 'var(--accent-blue)' : 'var(--border-dim)'}`,
                background: !realSpace ? 'rgba(0,180,255,0.12)' : 'transparent',
                color: !realSpace ? 'var(--accent-blue)' : 'var(--text-muted)',
                cursor: 'pointer', fontSize: 12, fontWeight: 600,
                transition: 'all 0.2s',
              }}
            >
              🌌 Random Galaxy
            </button>
            <button
              type="button"
              onClick={() => setRealSpace(true)}
              style={{
                flex: 1, padding: '8px 0', borderRadius: 6,
                border: `1px solid ${realSpace ? 'var(--accent-blue)' : 'var(--border-dim)'}`,
                background: realSpace ? 'rgba(0,180,255,0.12)' : 'transparent',
                color: realSpace ? 'var(--accent-blue)' : 'var(--text-muted)',
                cursor: 'pointer', fontSize: 12, fontWeight: 600,
                transition: 'all 0.2s',
              }}
            >
              🌍 Real Space
            </button>
          </div>
          {realSpace && (
            <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 8, lineHeight: 1.5 }}>
              Start on Earth with 25 real star systems within 15 light-years of Sol,
              including asteroids, comets, and accurate planetary data.
            </div>
          )}

          <button
            className={`btn btn-primary ${styles.startBtn}`}
            onClick={handleNew}
            disabled={loading}
          >
            {loading ? '⏳ Generating Galaxy...' : '🚀 New Game'}
          </button>
        </div>

        <div className={styles.menuFeatures}>
          <div className={styles.feature}><span>🌌</span><span>Procedural Galaxy</span></div>
          <div className={styles.feature}><span>🔬</span><span>20+ Technologies</span></div>
          <div className={styles.feature}><span>🚀</span><span>Ship Design</span></div>
          <div className={styles.feature}><span>🪐</span><span>Colonization</span></div>
        </div>
      </div>
    </div>
  );
}

// ─── Officers ─────────────────────────────────────────────────────────────────
function Officers() {
  return <OfficerManager />;
}

// ─── View Router ──────────────────────────────────────────────────────────────
function ViewContent() {
  const activeView = useUIStore(s => s.activeView);
  switch (activeView) {
    case 'Galaxy': return <GalaxyMap />;
    case 'System': return <SystemMap />;
    case 'Dashboard': return <Dashboard />;
    case 'Research': return <Research />;
    case 'ShipDesign': return <ShipDesign />;
    case 'Fleets': return <FleetManager />;
    case 'Colonies': return <ColonyManager />;
    case 'Planets': return <CelestialBodiesView />;
    case 'Production': return <Production />;
    case 'Officers': return <Officers />;
    case 'Events': return <Events />;
    case 'Economy': return <EconomyView />;
    case 'Companies': return <CorporateManager />;
    case 'CompanyDetails': return <CompanyDetailsView />;
    case 'Diplomacy': return <DiplomacyPanel />;
    default: return <GalaxyMap />;
  }
}

// ─── Main App (Build Trigger: 2026-03-01) ────────────────────────────────────
export default function Home() {
  const game = useGameStore(s => s.game);

  if (!game || game.phase === 'MainMenu') {
    return <MainMenu />;
  }

  return (
    <div className={styles.shell}>
      <Toaster />
      <CombatEventMonitor />
      <div className={styles.starfield} />
      <Sidebar />
      <div className={styles.main}>
        <div className={styles.content}>
          <ViewContent />
        </div>
        <ControlBar />
      </div>
    </div>
  );
}
