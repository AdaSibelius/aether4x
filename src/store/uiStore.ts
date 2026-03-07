'use client';
import { create } from 'zustand';
import type { UIState, UIView } from '@/types';

interface UIStore extends UIState {
    setView: (view: UIView) => void;
    selectStar: (id: string | null) => void;
    selectPlanet: (id: string | null) => void;
    selectFleet: (id: string | null) => void;
    selectShipDesign: (id: string | null) => void;
    selectCompany: (id: string | null) => void;
    selectColony: (id: string | null) => void;
    selectOfficer: (id: string | null) => void;
    updateGalaxyCamera: (cam: Partial<UIState['galaxyMapCamera']>) => void;
    updateSystemCamera: (cam: Partial<UIState['systemMapCamera']>) => void;
    toggleTradeOverlay: () => void;
    toggleDebugConsole: () => void;
    toggleDebugOverlay: () => void;
    addNotification: (msg: string) => void;
    clearNotification: (index: number) => void;
    clearNotifications: () => void;
    setContextMenu: (menu: { x: number, y: number, targets: { id: string, name: string, type: 'Planet' | 'Fleet' | 'Star' }[] } | null) => void;
}

export const useUIStore = create<UIStore>((set) => ({
    activeView: 'Galaxy',
    selectedStarId: null,
    selectedPlanetId: null,
    selectedFleetId: null,
    selectedShipDesignId: null,
    selectedCompanyId: null,
    selectedColonyId: null,
    selectedOfficerId: null,
    galaxyMapCamera: { x: 0, y: 0, zoom: 1 },
    systemMapCamera: { x: 0, y: 0, zoom: 1 },
    showTradeOverlay: false,
    showDebugConsole: false,
    showDebugOverlay: false,
    notifications: [],

    setView: (view) => set({ activeView: view }),
    selectStar: (id) => set({ selectedStarId: id }),
    selectPlanet: (id) => set({ selectedPlanetId: id }),
    selectFleet: (id) => set({ selectedFleetId: id }),
    selectShipDesign: (id) => set({ selectedShipDesignId: id }),
    selectCompany: (id) => set({ selectedCompanyId: id }),
    selectColony: (id) => set({ selectedColonyId: id }),
    selectOfficer: (id) => set({ selectedOfficerId: id }),
    updateGalaxyCamera: (cam) => set(s => ({ galaxyMapCamera: { ...s.galaxyMapCamera, ...cam } })),
    updateSystemCamera: (cam) => set(s => ({ systemMapCamera: { ...s.systemMapCamera, ...cam } })),
    toggleTradeOverlay: () => set(s => ({ showTradeOverlay: !s.showTradeOverlay })),
    toggleDebugConsole: () => set(s => ({ showDebugConsole: !s.showDebugConsole })),
    toggleDebugOverlay: () => set(s => ({ showDebugOverlay: !s.showDebugOverlay })),
    addNotification: (msg) => set(s => ({ notifications: [msg, ...s.notifications.slice(0, 4)] })),
    clearNotification: (index) => set(s => ({ notifications: s.notifications.filter((_, i) => i !== index) })),
    clearNotifications: () => set({ notifications: [] }),
    contextMenu: null,
    setContextMenu: (menu) => set({ contextMenu: menu }),
}));
