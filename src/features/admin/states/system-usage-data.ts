export type InteractionStat = {
  type: string;
  count: number;
  avgPerStudent: number;
};

export type SimulationVisitStat = {
  simulation: string;
  visits: number;
  avgDurationMinutes: number;
  completionRate: number;
};

export type MonthlyTrendStat = {
  month: string;
  activeStudents: number;
  totalVisits: number;
  interactions: number;
  simulationVisits: number;
  completionRate: number;
};

export type SystemUsageData = {
  generatedAt: string;
  semester: string;
  userScale: {
    teachers: number;
    students: number;
    admins: number;
  };
  estimatedPerStudent: Record<string, number>;
  interactionByType: InteractionStat[];
  simulationVisits: SimulationVisitStat[];
  controlOdysseyVisits: number;
  moduleVisitShare: Array<{ module: string; visits: number }>;
  monthlyTrend: MonthlyTrendStat[];
};

export type SystemUsageSource = {
  now: Date;
  users: {
    students: number;
    teachers: number;
    admins: number;
  };
  interactionLogs: Array<{
    userId: string;
    eventType: string;
    resourceKey: string | null;
    lessonKey: string | null;
    createdAt: Date;
  }>;
  simulationSessions: Array<{
    userId: string;
    simType: string;
    createdAt: Date;
  }>;
  simulationLogs: Array<{
    duration: number | null;
    inputParams: unknown;
    createdAt: Date;
  }>;
  learningFacts: Array<{
    factType: string;
    outcome: string;
    createdAt: Date;
  }>;
  llmSessions: Array<{
    userId: string;
    module: string | null;
    createdAt: Date;
  }>;
  ethicalLogCount: number;
};

const INTERACTION_LABELS: Record<string, string> = {
  view: '查看',
  interact: '互动',
  param_change: '参数调整',
  submit: '提交',
  ai_query: 'AI 提问',
  complete: '完成',
  error: '异常',
};

const FACT_LABELS: Record<string, string> = {
  question: '习题作答',
  simulation: '仿真实验',
  ai_intervention: 'AI 干预',
  prompt_design: '提示词设计',
  ethical: '伦理决策',
};

const SIMULATION_LABELS: Record<string, string> = {
  destroyer: '052D驱逐舰仿真',
  cruise: '豪华邮轮仿真',
  container: '集装箱船仿真',
  lng: 'LNG运输船仿真',
  drilling: '钻井平台仿真',
  dredger: '挖泥船仿真',
  icebreaker: '破冰船仿真',
};

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function formatMonth(date: Date) {
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  return `${date.getFullYear()}-${month}`;
}

function getSemesterLabel(date: Date) {
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  if (month >= 2 && month <= 7) {
    return `${year - 1}-${year}-2`;
  }
  if (month === 1) {
    return `${year - 1}-${year}-1`;
  }
  return `${year}-${year + 1}-1`;
}

function round(value: number) {
  return Number(value.toFixed(1));
}

function averagePerStudent(value: number, students: number) {
  if (students <= 0) {
    return 0;
  }
  return round(value / students);
}

function normalizeSimulationLabel(raw: string | null | undefined) {
  const normalized = (raw || '').toLowerCase();
  for (const [key, label] of Object.entries(SIMULATION_LABELS)) {
    if (normalized.includes(key)) {
      return label;
    }
  }
  return raw || '未分类仿真';
}

function extractSimulationType(inputParams: unknown) {
  if (!inputParams || typeof inputParams !== 'object') {
    return null;
  }
  const candidate = inputParams as Record<string, unknown>;
  const simulationType = candidate.simulationType;
  return typeof simulationType === 'string' ? simulationType : null;
}

function createMonthBuckets(now: Date) {
  const current = startOfMonth(now);
  const months: string[] = [];
  const monthDateMap = new Map<string, Date>();

  for (let index = 11; index >= 0; index -= 1) {
    const date = new Date(current.getFullYear(), current.getMonth() - index, 1);
    const key = formatMonth(date);
    months.push(key);
    monthDateMap.set(key, date);
  }

  return { months, monthDateMap };
}

function isKnowledgeGraphSession(module: string | null) {
  return (module || '').toLowerCase().includes('knowledge');
}

function isControlOdysseyInteraction(value: string | null) {
  const normalized = (value || '').toLowerCase();
  return normalized.includes('odyssey') || normalized.includes('control');
}

export function buildSystemUsageData(source: SystemUsageSource): SystemUsageData {
  const { now, users, interactionLogs, simulationSessions, simulationLogs, learningFacts, llmSessions, ethicalLogCount } = source;
  const { months } = createMonthBuckets(now);
  const students = users.students;

  const interactionCountMap = new Map<string, number>();
  for (const log of interactionLogs) {
    interactionCountMap.set(log.eventType, (interactionCountMap.get(log.eventType) || 0) + 1);
  }

  const interactionByType = Array.from(interactionCountMap.entries())
    .sort((left, right) => right[1] - left[1])
    .map(([type, count]) => ({
      type: INTERACTION_LABELS[type] || type,
      count,
      avgPerStudent: averagePerStudent(count, students),
    }));

  const simulationDurationMap = new Map<string, { totalMinutes: number; count: number }>();
  for (const log of simulationLogs) {
    const simulationType = normalizeSimulationLabel(extractSimulationType(log.inputParams));
    const entry = simulationDurationMap.get(simulationType) || { totalMinutes: 0, count: 0 };
    entry.totalMinutes += (log.duration || 0) / 60;
    entry.count += 1;
    simulationDurationMap.set(simulationType, entry);
  }

  const simulationVisitMap = new Map<string, number>();
  for (const session of simulationSessions) {
    const label = normalizeSimulationLabel(session.simType);
    simulationVisitMap.set(label, (simulationVisitMap.get(label) || 0) + 1);
  }

  const simulationSuccessMap = new Map<string, { total: number; success: number }>();
  for (const fact of learningFacts.filter((item) => item.factType === 'simulation')) {
    const label = '仿真实验';
    const entry = simulationSuccessMap.get(label) || { total: 0, success: 0 };
    entry.total += 1;
    if (fact.outcome === 'success') {
      entry.success += 1;
    }
    simulationSuccessMap.set(label, entry);
  }

  const simulationVisits = Array.from(simulationVisitMap.entries())
    .sort((left, right) => right[1] - left[1])
    .map(([simulation, visits]) => {
      const durationEntry = simulationDurationMap.get(simulation);
      const successEntry = simulationSuccessMap.get('仿真实验');
      return {
        simulation,
        visits,
        avgDurationMinutes: durationEntry?.count ? round(durationEntry.totalMinutes / durationEntry.count) : 0,
        completionRate:
          successEntry && successEntry.total > 0 ? round((successEntry.success / successEntry.total) * 100) : 0,
      };
    });

  const controlOdysseyVisits = interactionLogs.filter(
    (item) =>
      isControlOdysseyInteraction(item.resourceKey) ||
      isControlOdysseyInteraction(item.lessonKey)
  ).length;

  const knowledgeGraphInteractions =
    interactionLogs.filter(
      (item) =>
        (item.resourceKey || '').toLowerCase().includes('knowledge') ||
        (item.lessonKey || '').toLowerCase().includes('knowledge')
    ).length +
    llmSessions.filter((item) => isKnowledgeGraphSession(item.module)).length;

  const moduleVisitShare = [
    { module: '互动课程', visits: interactionLogs.length },
    { module: '虚拟仿真', visits: simulationSessions.length },
    { module: 'AI 助手', visits: llmSessions.length },
    { module: '知识图谱', visits: knowledgeGraphInteractions },
    { module: '学习事实', visits: learningFacts.length },
    { module: '风险治理', visits: ethicalLogCount },
  ].filter((item) => item.visits > 0);

  const monthlyTrend = months.map((month) => {
    const activeUserIds = new Set<string>();
    let interactions = 0;
    let simulationVisitsCount = 0;
    let llmVisits = 0;
    let totalFacts = 0;
    let successFacts = 0;

    for (const log of interactionLogs) {
      if (formatMonth(log.createdAt) !== month) continue;
      interactions += 1;
      activeUserIds.add(log.userId);
    }

    for (const session of simulationSessions) {
      if (formatMonth(session.createdAt) !== month) continue;
      simulationVisitsCount += 1;
      activeUserIds.add(session.userId);
    }

    for (const session of llmSessions) {
      if (formatMonth(session.createdAt) !== month) continue;
      llmVisits += 1;
      activeUserIds.add(session.userId);
    }

    for (const fact of learningFacts) {
      if (formatMonth(fact.createdAt) !== month) continue;
      totalFacts += 1;
      if (fact.outcome === 'success') {
        successFacts += 1;
      }
    }

    return {
      month,
      activeStudents: activeUserIds.size,
      totalVisits: interactions + simulationVisitsCount + llmVisits,
      interactions,
      simulationVisits: simulationVisitsCount,
      completionRate: totalFacts > 0 ? round((successFacts / totalFacts) * 100) : 0,
    };
  });

  const totalSimulationMinutes = simulationLogs.reduce((sum, item) => sum + (item.duration || 0) / 60, 0);
  const questionFacts = learningFacts.filter((item) => item.factType === 'question').length;

  return {
    generatedAt: now.toISOString(),
    semester: getSemesterLabel(now),
    userScale: {
      students: users.students,
      teachers: users.teachers,
      admins: users.admins,
    },
    estimatedPerStudent: {
      interactiveActions: averagePerStudent(interactionLogs.length, students),
      simulationVisits: averagePerStudent(simulationSessions.length, students),
      simulationMinutes: averagePerStudent(totalSimulationMinutes, students),
      exerciseAttempts: averagePerStudent(questionFacts, students),
      controlOdysseyVisits: averagePerStudent(controlOdysseyVisits, students),
      knowledgeGraphInteractions: averagePerStudent(knowledgeGraphInteractions, students),
    },
    interactionByType,
    simulationVisits,
    controlOdysseyVisits,
    moduleVisitShare,
    monthlyTrend,
  };
}

export function summarizeLearningFactTypes(
  learningFacts: Array<{ factType: string }>
): Array<{ label: string; count: number }> {
  const counts = new Map<string, number>();
  for (const fact of learningFacts) {
    const label = FACT_LABELS[fact.factType] || fact.factType;
    counts.set(label, (counts.get(label) || 0) + 1);
  }
  return Array.from(counts.entries())
    .sort((left, right) => right[1] - left[1])
    .map(([label, count]) => ({ label, count }));
}
