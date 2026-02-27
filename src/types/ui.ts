export type UIView = 'Galaxy' | 'System' | 'Dashboard' | 'Research' | 'ShipDesign' | 'Colonies' | 'Planets' | 'Production' | 'Officers' | 'Events' | 'Fleets' | 'Economy' | 'Companies' | 'CompanyDetails';

export interface UIState {
    activeView: UIView;
    selectedStarId: string | null;
    selectedPlanetId: string | null;
    selectedFleetId: string | null;
    selectedShipDesignId: string | null;
    selectedCompanyId: string | null;
    selectedColonyId: string | null;
    selectedOfficerId: string | null;
    galaxyMapCamera: { x: number; y: number; zoom: number };
    systemMapCamera: { x: number; y: number; zoom: number };
    showTradeOverlay: boolean;
    showDebugConsole: boolean;
    notifications: string[];
    contextMenu: { x: number, y: number, targets: { id: string, name: string, type: 'Planet' | 'Fleet' }[] } | null;
    showDebugOverlay: boolean;
}
