import { LogisticsValidation } from './LogisticsValidation';
import { MarsIsolation, ManufacturingCrash, KnowledgeDesert, GrandArmada } from './StressTests';
import { SectorHealthAudit } from './SectorHealthAudit';
import { Scenario } from './types';

export const SCENARIO_REGISTRY: Record<string, Scenario> = {
    LogisticsValidation,
    MarsIsolation,
    ManufacturingCrash,
    KnowledgeDesert,
    GrandArmada,
    SectorHealthAudit
};
