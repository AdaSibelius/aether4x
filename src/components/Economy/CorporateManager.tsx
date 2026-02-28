import React from 'react';
import { useGameStore } from '@/store/gameStore';
import { useUIStore } from '@/store/uiStore';
import type { Company, CompanyType } from '@/types';
import CompanyDetailsView from './CompanyDetails';
import { RosterShell, SidebarSection, RosterGroup, RosterItem, MainArea } from '@/components/Roster/Roster';
import CompanyHQGenerator from './CompanyHQGenerator';

// ─── Sector badge colors ───────────────────────────────────────────────────────
const SECTOR_COLORS: Record<CompanyType, string> = {
    'Extraction': 'var(--accent-gold)',
    'Transport': 'var(--accent-blue)',
    'Manufacturing': 'var(--accent-green)',
    'Agricultural': '#27ae60',
    'Commercial': '#9b59b6',
    'AethericSiphon': '#af7ac5',
    'DeepCoreMining': '#e67e22',
    'Reclamation': '#1abc9c'
};

const SECTOR_ICONS: Record<CompanyType, string> = {
    'Extraction': '⛏️',
    'Transport': '🚀',
    'Manufacturing': '🏭',
    'Agricultural': '🌾',
    'Commercial': '⚖️',
    'AethericSiphon': '🌀',
    'DeepCoreMining': '🌋',
    'Reclamation': '♻️'
};

export default function CorporateManager() {
    const game = useGameStore(s => s.game);
    const { selectedCompanyId, selectCompany } = useUIStore();

    if (!game) return null;
    const empire = game.empires[game.playerEmpireId];
    if (!empire) return null;

    const companies = empire.companies || [];

    // Group companies by sector
    const sectors: CompanyType[] = ['Extraction', 'Transport', 'Manufacturing', 'Agricultural', 'Commercial', 'AethericSiphon', 'DeepCoreMining', 'Reclamation'];
    const grouped = sectors.reduce((acc, s) => {
        const list = companies.filter(c => c.type === s);
        if (list.length > 0) acc[s] = list;
        return acc;
    }, {} as Record<CompanyType, Company[]>);

    const activeCompany = companies.find(c => c.id === selectedCompanyId) || (companies.length > 0 ? companies[0] : null);

    return (
        <RosterShell>
            <SidebarSection
                header={
                    <div style={{
                        fontFamily: 'Orbitron',
                        fontSize: 11,
                        color: 'var(--accent-blue)',
                        textTransform: 'uppercase',
                        letterSpacing: '0.1em',
                    }}>
                        Private Sector Registry ({companies.length})
                    </div>
                }
            >
                {Object.entries(grouped).map(([sector, list]) => (
                    <RosterGroup
                        key={sector}
                        title={`${sector}s (${list.length})`}
                        icon={SECTOR_ICONS[sector as CompanyType]}
                        titleColor={SECTOR_COLORS[sector as CompanyType]}
                    >
                        {list.map(c => {
                            const homeColony = Object.values(game.colonies).find(col => col.id === c.homeColonyId);
                            return (
                                <RosterItem
                                    key={c.id}
                                    name={c.name}
                                    active={activeCompany?.id === c.id}
                                    onClick={() => selectCompany(c.id)}
                                    thumbnail={<CompanyHQGenerator company={c} width={40} height={40} />}
                                    subtitle={
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                            <span style={{ color: 'var(--accent-green)', fontWeight: 700 }}>
                                                {Math.floor(c.wealth).toLocaleString()} W
                                            </span>
                                            <span style={{ opacity: 0.5 }}>•</span>
                                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                {homeColony?.name || 'Local'}
                                            </span>
                                        </div>
                                    }
                                />
                            );
                        })}
                    </RosterGroup>
                ))}

                {companies.length === 0 && (
                    <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
                        No private corporations have been founded yet.
                    </div>
                )}
            </SidebarSection>

            <MainArea
                isEmpty={!activeCompany}
                emptyMessage="Select a member of the private sector from the registry"
                title={activeCompany?.name || undefined}
                subtitle={activeCompany ? `${activeCompany.type} Corporation · HQ: ${Object.values(game.colonies).find(col => col.id === activeCompany.homeColonyId)?.name || 'Unknown'}` : undefined}
            >
                {activeCompany && (
                    <CompanyDetailsView key={activeCompany.id} isEmbedded={true} />
                )}
            </MainArea>
        </RosterShell>
    );
}
