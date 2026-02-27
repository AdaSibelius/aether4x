'use client';
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { GameState, TickLength, Fleet, ShipDesign, MiningTender, Colony, ProductionItem } from '@/types';
import { generateId } from '@/utils/id';
import { BALANCING } from '@/engine/constants';
import { setupNewGame } from '@/engine/setup';
import { advanceTick } from '@/engine/time';
import { useUIStore } from './uiStore';

interface GameStore {
    game: GameState | null;
    isRunning: boolean;    // auto-advance timer active

    // Actions
    newGame: (playerName: string, seed?: number, realSpace?: boolean) => void;
    quitToMenu: () => void;
    advanceTurn: () => void;
    setTickLength: (tl: TickLength) => void;
    setAutoRun: (running: boolean) => void;
    loadGame: () => void;
    saveGame: () => void;
    updateFleet: (empireId: string, fleetId: string, updates: Partial<Fleet>) => void;
    saveDesign: (design: ShipDesign) => void;
    deleteDesign: (designId: string) => void;
    transferShip: (empireId: string, fromFleetId: string, toFleetId: string, shipId: string) => void;
    splitFleet: (empireId: string, fleetId: string, shipId: string) => void;
    // Snapshot Actions
    snapshots: { id: string; name: string; date: Date; turn: number }[];
    createSnapshot: (name: string) => void;
    loadSnapshot: (id: string) => void;
    deleteSnapshot: (id: string) => void;
    // Debug Actions
    debug: {
        addWealth: (amount: number) => void;
        addResearchPoints: (amount: number) => void;
        addMinerals: (colonyId: string, amount: number) => void;
        setColonyStockpile: (colonyId: string, minerals: Record<string, number>) => void;
        instantQueue: (colonyId: string) => void;
        timeWarp: (days: number) => void;
        triggerCorporateOrder: (companyId: string, designId: string) => void;
        teleportFleet: (fleetId: string, starId: string, planetId?: string) => void;
    };
    openMiningTender: (systemId: string) => void;
    establishColony: (planetId: string, name: string) => void;
    diffSnapshots: (idA: string, idB: string) => any;
}

export const useGameStore = create<GameStore>()(
    persist(
        (set, get) => ({
            game: null,
            isRunning: false,

            newGame: (playerName: string, seed?: number, realSpace?: boolean) => {
                const gameSeed = seed ?? Math.floor(Math.random() * 999999);
                const game = setupNewGame(playerName, gameSeed, realSpace);
                set({ game, isRunning: false });
            },

            quitToMenu: () => {
                const { game } = get();
                if (game) {
                    set({ game: { ...game, phase: 'MainMenu' }, isRunning: false });
                }
            },

            advanceTurn: () => {
                const game = get().game;
                if (!game) return;

                const empireId = game.playerEmpireId;
                const prevEventIds = new Set((game.empires[empireId]?.events || []).map(e => e.id));

                const next = advanceTick({ ...game });
                set({ game: next });

                // Show toasts for new important events
                const nextEvents = next.empires[empireId]?.events || [];
                const newImportantEvents = nextEvents.filter(e => e.important && !prevEventIds.has(e.id));

                newImportantEvents.forEach(e => {
                    useUIStore.getState().addNotification(e.message);
                });
            },

            setTickLength: (tl: TickLength) => {
                const { game } = get();
                if (!game) return;
                set({ game: { ...game, tickLength: tl } });
            },

            setAutoRun: (running: boolean) => set({ isRunning: running }),

            updateFleet: (empireId: string, fleetId: string, updates: Partial<Fleet>) => {
                const { game } = get();
                if (!game) return;
                const empire = game.empires[empireId];
                if (!empire) return;
                const fleetIndex = empire.fleets.findIndex(f => f.id === fleetId);
                if (fleetIndex !== -1) {
                    const newFleets = [...empire.fleets];
                    newFleets[fleetIndex] = { ...newFleets[fleetIndex], ...updates };

                    // If assigning an admiral, unset them from other places
                    if (updates.admiralId) {
                        const newOfficers = [...empire.officers];
                        const officerIndex = newOfficers.findIndex(o => o.id === updates.admiralId);
                        if (officerIndex !== -1) {
                            // If admiral was assigned to another fleet, unassign them
                            newFleets.forEach(f => {
                                if (f.id !== fleetId && f.admiralId === updates.admiralId) f.admiralId = undefined;
                            });
                            // Unassign from colony if necessary
                            if (newOfficers[officerIndex].assignedTo) {
                                const targetColony = Object.values(game.colonies).find(c => c.empireId === empireId && c.governorId === updates.admiralId);
                                if (targetColony) {
                                    const newColonies = { ...game.colonies, [targetColony.id]: { ...targetColony, governorId: undefined } };
                                    set({ game: { ...game, colonies: newColonies } });
                                }
                            }
                            newOfficers[officerIndex] = { ...newOfficers[officerIndex], assignedTo: fleetId };
                            set({ game: { ...get().game!, empires: { ...game.empires, [empireId]: { ...empire, fleets: newFleets, officers: newOfficers } } } });
                            return;
                        }
                    }

                    // Normal update
                    set({ game: { ...game, empires: { ...game.empires, [empireId]: { ...empire, fleets: newFleets } } } });
                }
            },

            saveDesign: (design: ShipDesign) => {
                const { game } = get();
                if (!game) return;
                const next = structuredClone(game);
                const empire = next.empires[next.playerEmpireId];
                empire.designLibrary.push(design);
                set({ game: next });
                useUIStore.getState().addNotification(`Ship design "${design.name}" committed to the bureau.`);
            },

            deleteDesign: (designId: string) => {
                const { game } = get();
                if (!game) return;
                const next = structuredClone(game);
                const empire = next.empires[next.playerEmpireId];
                const design = empire.designLibrary.find(d => d.id === designId);
                if (design) {
                    empire.designLibrary = empire.designLibrary.filter(d => d.id !== designId);
                    set({ game: next });
                    useUIStore.getState().addNotification(`Ship design "${design.name}" decommissioned.`);
                    if (useUIStore.getState().selectedShipDesignId === designId) {
                        useUIStore.getState().selectShipDesign(null);
                    }
                }
            },

            transferShip: (empireId: string, fromFleetId: string, toFleetId: string, shipId: string) => {
                const { game } = get();
                if (!game) return;
                const empire = game.empires[empireId];
                if (!empire) return;

                const fromFleet = empire.fleets.find(f => f.id === fromFleetId);
                const toFleet = empire.fleets.find(f => f.id === toFleetId);

                if (fromFleet && toFleet && fromFleet.shipIds.includes(shipId)) {
                    const newFleets = empire.fleets.map(f => {
                        if (f.id === fromFleetId) {
                            return { ...f, shipIds: f.shipIds.filter((id: string) => id !== shipId) };
                        }
                        if (f.id === toFleetId) {
                            return { ...f, shipIds: [...f.shipIds, shipId] };
                        }
                        return f;
                    }).filter(f => f.shipIds.length > 0); // Cleanup empty fleets

                    set({ game: { ...game, empires: { ...game.empires, [empireId]: { ...empire, fleets: newFleets } } } });
                }
            },

            splitFleet: (empireId: string, fleetId: string, shipId: string) => {
                const { game } = get();
                if (!game) return;
                const empire = game.empires[empireId];
                if (!empire) return;

                const sourceFleet = empire.fleets.find(f => f.id === fleetId);
                if (sourceFleet && sourceFleet.shipIds.includes(shipId) && sourceFleet.shipIds.length > 1) {
                    const newFleetId = generateId('fleet');
                    const newFleet: Fleet = {
                        ...sourceFleet,
                        id: newFleetId,
                        name: `${sourceFleet.name} (Split)`,
                        shipIds: [shipId],
                        orders: [],
                        admiralId: undefined
                    };

                    const newFleets = empire.fleets.map(f => {
                        if (f.id === fleetId) {
                            return { ...f, shipIds: f.shipIds.filter((id: string) => id !== shipId) };
                        }
                        return f;
                    });
                    newFleets.push(newFleet);

                    set({ game: { ...game, empires: { ...game.empires, [empireId]: { ...empire, fleets: newFleets } } } });
                }
            },

            loadGame: () => { /* handled by Zustand persist */ },
            saveGame: () => { /* handled by Zustand persist */ },

            snapshots: [],

            createSnapshot: (name: string) => {
                const { game, snapshots } = get();
                if (!game) return;
                const id = `snap_${Date.now()}`;
                const newSnapshot = {
                    id,
                    name,
                    date: new Date(),
                    turn: game.turn,
                    gameState: structuredClone(game)
                };
                // We store the full state in a separate key to keep the main store slim if possible,
                // but since we use Zustand persist, we'll just add it to the snapshots array for now.
                // In a real app we might use IndexedDB for large states.
                set({ snapshots: [...snapshots, newSnapshot as any] });
            },

            loadSnapshot: (id: string) => {
                const { snapshots } = get();
                const snap = snapshots.find((s: any) => s.id === id);
                if (snap) {
                    set({ game: structuredClone((snap as any).gameState), isRunning: false });
                }
            },

            deleteSnapshot: (id: string) => {
                const { snapshots } = get();
                set({ snapshots: snapshots.filter((s: any) => s.id !== id) });
            },

            debug: {
                addWealth: (amount: number) => {
                    const { game } = get();
                    if (!game) return;
                    const next = structuredClone(game);
                    next.empires[next.playerEmpireId].treasury += amount;
                    set({ game: next });
                },
                addResearchPoints: (amount: number) => {
                    const { game } = get();
                    if (!game) return;
                    const next = structuredClone(game);
                    const empire = next.empires[next.playerEmpireId];
                    if (empire.research.activeProjects.length > 0) {
                        empire.research.activeProjects[0].investedPoints += amount;
                    }
                    set({ game: next });
                },
                addMinerals: (colonyId: string, amount: number) => {
                    const { game } = get();
                    if (!game) return;
                    const next = structuredClone(game);
                    const colony = next.colonies[colonyId];
                    if (colony) {
                        BALANCING.MINERAL_NAMES.forEach((m: string) => {
                            colony.minerals[m] = (colony.minerals[m] || 0) + amount;
                        });
                    }
                    set({ game: next });
                },
                setColonyStockpile: (colonyId: string, minerals: Record<string, number>) => {
                    const { game } = get();
                    if (!game) return;
                    const next = structuredClone(game);
                    const colony = next.colonies[colonyId];
                    if (colony) {
                        colony.minerals = { ...colony.minerals, ...minerals };
                    }
                    set({ game: next });
                },
                instantQueue: (colonyId: string) => {
                    const { game } = get();
                    if (!game) return;
                    const next = structuredClone(game);
                    const colony = next.colonies[colonyId];
                    if (colony && colony.productionQueue[0]) {
                        colony.productionQueue[0].progress = 100;
                    }
                    set({ game: next });
                },
                timeWarp: (days: number) => {
                    const { game } = get();
                    if (!game) return;
                    let next = structuredClone(game);
                    // Force daily ticks (86400s) for precision during warp
                    const originalTL = next.tickLength;
                    next.tickLength = 86400 as any;
                    for (let i = 0; i < days; i++) {
                        next = advanceTick(next);
                    }
                    next.tickLength = originalTL;
                    set({ game: next });
                },
                triggerCorporateOrder: (companyId: string, designId: string) => {
                    const { game } = get();
                    if (!game) return;
                    const next = structuredClone(game);
                    const empire = next.empires[next.playerEmpireId];
                    const company = empire.companies.find(c => c.id === companyId);
                    const design = empire.designLibrary.find(d => d.id === designId);
                    const colony = next.colonies[company?.homeColonyId || ''];

                    if (company && design && colony && colony.shipyards.length > 0) {
                        const sy = colony.shipyards[0];
                        sy.activeBuilds.push({
                            id: `item_${Date.now()}`,
                            type: 'Ship',
                            name: design.name,
                            designId: design.id,
                            quantity: 1,
                            progress: 0,
                            bpCostPerUnit: design.bpCost,
                            costPerUnit: design.mineralCost,
                            sourceCompanyId: company.id
                        });
                        set({ game: next });
                    }
                },
                teleportFleet: (fleetId: string, starId: string, planetId?: string) => {
                    const { game } = get();
                    if (!game) return;
                    const next = structuredClone(game);
                    const empire = next.empires[next.playerEmpireId];
                    const fleet = empire.fleets.find(f => f.id === fleetId);
                    if (fleet) {
                        fleet.currentStarId = starId;
                        fleet.orbitingPlanetId = planetId;
                        if (planetId) {
                            const star = next.galaxy.stars[starId];
                            const planet = star?.planets.find(p => p.id === planetId);
                            if (planet) {
                                // Position will be snapped during tickFleets
                                fleet.position = { x: 0, y: 0 };
                            }
                        }
                        fleet.destination = undefined;
                        fleet.orders = [];
                        set({ game: next });
                    }
                }
            },

            openMiningTender: (systemId: string) => {
                const { game } = get();
                if (!game) return;
                const next = structuredClone(game);
                const currentDate = new Date(next.date);

                const closingDate = new Date(currentDate);
                closingDate.setDate(closingDate.getDate() + 30);

                const newTender: MiningTender = {
                    id: generateId('tender'),
                    systemId,
                    openingDate: currentDate.toISOString().split('T')[0],
                    closingDate: closingDate.toISOString().split('T')[0],
                    highestBid: 1000, // Starting bid
                    bids: [],
                    empireId: next.playerEmpireId
                };

                next.tenders.push(newTender);
                set({ game: next });
                useUIStore.getState().addNotification(`Mining tender opened for system ${systemId}.`);
            },

            establishColony: (planetId: string, name: string) => {
                const { game } = get();
                if (!game) return;
                const next = structuredClone(game);
                const empireId = next.playerEmpireId;

                const colonyId = generateId('colony');
                const newColony: Colony = {
                    id: colonyId,
                    empireId: empireId,
                    planetId: planetId,
                    name: name,
                    population: 0,
                    populationSegments: [],
                    maxPopulation: 50, // Default for non-Breathable
                    populationGrowthRate: 0.02,
                    happiness: 50,
                    infrastructure: 10,
                    colonyType: 'Core',
                    policy: 'Normal',
                    laborAllocation: { industry: 30, mining: 20, research: 15, construction: 15, agriculture: 5, commerce: 15 },
                    productionQueue: [],
                    factories: 0,
                    mines: 0,
                    civilianFactories: 0,
                    civilianMines: 0,
                    researchLabs: 0,
                    spaceport: 0,
                    shipyards: [],
                    groundDefenses: 0,
                    constructionOffices: 0,
                    farms: 0,
                    commercialCenters: 0,
                    terraformProgress: 0,
                    aethericDistillery: 0,
                    logisticsHubs: 0,
                    migrationMode: 'Stable',
                    minerals: {
                        Iron: 600, // Enough to build the Spaceport (cost: 500)
                        Copper: 300,
                        Food: 1000 // Initial food supply to prevent immediate starvation
                    },
                    demand: {},
                    privateWealth: 0,
                    history: [],
                };

                // Queue the Spaceport project as requested by the user
                newColony.productionQueue.push({
                    id: generateId('item'),
                    type: 'Spaceport',
                    name: 'Planetary Spaceport',
                    quantity: 1,
                    progress: 0,
                    costPerUnit: { Iron: 500, Copper: 200 }, // Standard costs from colonies.ts
                    bpCostPerUnit: 3000
                });

                next.colonies[colonyId] = newColony;

                // Also update the planet's reference if it exists
                for (const star of Object.values(next.galaxy.stars)) {
                    const planet = star.planets.find(p => p.id === planetId);
                    if (planet) {
                        if (!planet.colonies) planet.colonies = [];
                        planet.colonies.push(newColony as any);
                        break;
                    }
                    for (const p of star.planets) {
                        if (p.moons) {
                            const moon = p.moons.find(m => m.id === planetId);
                            if (moon) {
                                if (!moon.colonies) moon.colonies = [];
                                moon.colonies.push(newColony as any);
                                break;
                            }
                        }
                    }
                }

                set({ game: next });
                useUIStore.getState().addNotification(`New colony established on ${name}. Construction of Planetary Spaceport initiated.`);
            },

            diffSnapshots: (idA: string, idB: string) => {
                const { snapshots } = get();
                const snapA = snapshots.find(s => s.id === idA);
                const snapB = snapshots.find(s => s.id === idB);
                if (!snapA || !snapB) return null;

                const stateA = (snapA as any).gameState;
                const stateB = (snapB as any).gameState;
                const pId = stateA.playerEmpireId;

                const getStats = (state: any) => {
                    const empire = state.empires[pId];
                    const colonies = Object.values(state.colonies) as any[];

                    const totalPop = colonies.reduce((sum, c) => sum + (c.population || 0), 0);
                    const totalMinerals = colonies.reduce((sum, c) => {
                        return sum + Object.values(c.minerals || {}).reduce((mSum: number, m: any) => mSum + (m || 0), 0);
                    }, 0);

                    const fleetCount = empire?.fleets?.length || 0;
                    const shipCount = Object.keys(state.ships || {}).length;
                    const totalValuation = empire?.companies?.reduce((sum: number, c: any) => sum + (c.valuation || 0), 0) || 0;

                    return { totalPop, totalMinerals, fleetCount, shipCount, totalValuation, treasury: empire?.treasury || 0, privateWealth: empire?.privateWealth || 0 };
                };

                const statsA = getStats(stateA);
                const statsB = getStats(stateB);

                return {
                    turnDelta: stateB.turn - stateA.turn,
                    treasury: statsB.treasury - statsA.treasury,
                    privateWealth: statsB.privateWealth - statsA.privateWealth,
                    popDelta: statsB.totalPop - statsA.totalPop,
                    mineralDelta: statsB.totalMinerals - statsA.totalMinerals,
                    fleetDelta: statsB.fleetCount - statsA.fleetCount,
                    shipDelta: statsB.shipCount - statsA.shipCount,
                    valuationDelta: statsB.totalValuation - statsA.totalValuation
                };
            }
        }),
        {
            name: 'aether-4x-game',
            storage: createJSONStorage(() => localStorage),
            partialize: (state) => ({ game: state.game, snapshots: state.snapshots }),
        }
    )
);
