import { LogisticsValidation } from './LogisticsValidation';
import { MarsIsolation, ManufacturingCrash, KnowledgeDesert, GrandArmada } from './StressTests';
import { SectorHealthAudit } from './SectorHealthAudit';
import { Economy50YearRun } from './Economy50YearRun';
import { CombatStressTest } from './CombatStressTest';
import { Scenario } from './types';

export const SCENARIO_REGISTRY: Record<string, Scenario> = {
    LogisticsValidation,
    MarsIsolation,
    ManufacturingCrash,
    KnowledgeDesert,
    GrandArmada,
    SectorHealthAudit,
    Economy50YearRun,
    CombatStressTest
};
