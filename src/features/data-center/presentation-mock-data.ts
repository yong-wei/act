import type { DataCenterSourceQuality } from './shared/data-center-contracts';

export interface PresentationInteractionStat {
  type: string;
  count: number;
  avgPerStudent: number;
}

export interface PresentationSimulationVisitStat {
  simulation: string;
  visits: number;
  avgDurationMinutes: number;
  completionRate: number;
}

export interface PresentationMonthlyTrendStat {
  month: string;
  activeStudents: number;
  totalVisits: number;
  interactions: number;
  simulationVisits: number;
  completionRate: number;
}

export interface PresentationModuleShare {
  module: string;
  visits: number;
}

export interface PresentationDataCenterData {
  _meta: { sourceQuality: DataCenterSourceQuality; generatedAt: string; semester: string };
  userScale: { teachers: number; students: number; admins: number };
  estimatedPerStudent: {
    interactiveActions: number;
    simulationVisits: number;
    simulationMinutes: number;
    exerciseAttempts: number;
    controlOdysseyVisits: number;
    knowledgeGraphInteractions: number;
  };
  interactionByType: PresentationInteractionStat[];
  simulationVisits: PresentationSimulationVisitStat[];
  controlOdysseyVisits: number;
  moduleVisitShare: PresentationModuleShare[];
  monthlyTrend: PresentationMonthlyTrendStat[];
}

export const presentationDataCenterMock: PresentationDataCenterData = {
  _meta: {
    sourceQuality: 'demo' as DataCenterSourceQuality,
    generatedAt: '2026-05-30',
    semester: '2025-2026-2',
  },
  userScale: {
    teachers: 18,
    students: 1890,
    admins: 4,
  },
  estimatedPerStudent: {
    interactiveActions: 15,
    simulationVisits: 38,
    simulationMinutes: 210,
    exerciseAttempts: 382,
    controlOdysseyVisits: 24,
    knowledgeGraphInteractions: 34,
  },
  interactionByType: [
    { type: '指标速判', count: 5292, avgPerStudent: 2.8 },
    { type: '指标裁判手册', count: 4536, avgPerStudent: 2.4 },
    { type: '裁判席计分器', count: 4158, avgPerStudent: 2.2 },
    { type: '幅相概念速判', count: 4914, avgPerStudent: 2.6 },
    { type: '稳定裕度速判', count: 3969, avgPerStudent: 2.1 },
    { type: '串联校正策略实验室', count: 4725, avgPerStudent: 2.5 },
  ],
  simulationVisits: [
    { simulation: '052D驱逐舰仿真', visits: 15020, avgDurationMinutes: 31, completionRate: 87 },
    { simulation: '集装箱船仿真', visits: 10170, avgDurationMinutes: 24, completionRate: 83 },
    { simulation: '豪华邮轮仿真', visits: 14280, avgDurationMinutes: 28, completionRate: 85 },
    { simulation: 'LNG运输船仿真', visits: 8740, avgDurationMinutes: 22, completionRate: 81 },
    { simulation: '挖泥船仿真', visits: 7560, avgDurationMinutes: 20, completionRate: 79 },
    { simulation: '钻井平台仿真', visits: 6810, avgDurationMinutes: 19, completionRate: 78 },
    { simulation: '破冰船仿真', visits: 8290, avgDurationMinutes: 21, completionRate: 82 },
  ],
  controlOdysseyVisits: 45800,
  moduleVisitShare: [
    { module: '互动课程', visits: 96300 },
    { module: '虚拟仿真', visits: 70870 },
    { module: 'Control Odyssey', visits: 45800 },
    { module: '自适应评测', visits: 61200 },
    { module: '知识图谱', visits: 35600 },
    { module: '评审入口', visits: 12800 },
  ],
  monthlyTrend: [
    { month: '2025-09', activeStudents: 1260, totalVisits: 28400, interactions: 8700, simulationVisits: 7200, completionRate: 67 },
    { month: '2025-10', activeStudents: 1390, totalVisits: 30200, interactions: 9300, simulationVisits: 7800, completionRate: 72 },
    { month: '2025-11', activeStudents: 1500, totalVisits: 31800, interactions: 9800, simulationVisits: 8100, completionRate: 76 },
    { month: '2025-12', activeStudents: 1570, totalVisits: 33400, interactions: 10400, simulationVisits: 8400, completionRate: 79 },
    { month: '2026-01', activeStudents: 1450, totalVisits: 30500, interactions: 9200, simulationVisits: 7600, completionRate: 81 },
    { month: '2026-02', activeStudents: 1630, totalVisits: 34100, interactions: 11200, simulationVisits: 8700, completionRate: 84 },
    { month: '2026-03', activeStudents: 1710, totalVisits: 35800, interactions: 11900, simulationVisits: 9100, completionRate: 86 },
    { month: '2026-04', activeStudents: 1780, totalVisits: 37200, interactions: 12500, simulationVisits: 9400, completionRate: 88 },
  ],
};
