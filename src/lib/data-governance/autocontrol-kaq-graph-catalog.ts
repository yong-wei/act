import {
  validateKaqObjectiveCatalog,
  type KaqCapabilityObjective,
  type KaqEvidencePolicy,
  type KaqGraphBindingPolicy,
  type KaqKnowledgeObjective,
  type KaqObjectiveSeedCatalog,
  type KaqObjectiveValidationResult,
  type KaqQualityObjective,
  type PortraitV2DimensionId,
} from './kaq-objective-taxonomy';
import {
  validateKaqGraphCatalog,
  type KaqCapabilityGraphNode,
  type KaqGraphCatalog,
  type KaqGraphEdge,
  type KaqGraphValidationResult,
  type KaqKnowledgeGraphNode,
  type KaqQualityGraphNode,
} from './kaq-graph-schema';

type KaqObjectiveBaseInput = {
  id: string;
  level: 'overall' | 'secondary' | 'tertiary';
  parentId: string | null;
  title: string;
  description: string;
  portraitDimensions: PortraitV2DimensionId[];
  bindingRefs: string[];
  moduleId?: string;
};

export type AutocontrolKaqRuntimeCoverageState = 'runtime-bound' | 'partial';

export interface AutocontrolKaqRuntimeKnowledgeCoverage {
  graphNodeId: string;
  coverageState: AutocontrolKaqRuntimeCoverageState;
  runtimeKnowledgeRefs: string[];
  limitation?: string;
}

export interface AutocontrolKaqGraphCatalogValidationReport {
  objectiveValidation: KaqObjectiveValidationResult;
  graphValidation: KaqGraphValidationResult;
}

const MODULE_ID = 'automatic-control';

const KNOWLEDGE_REFS = {
  feedbackLoop: ['反馈_1_1', '负反馈_1_0cffeeab'],
  transferFunctionModel: ['建模_1_2', '传递函数_2_2c5e2589', '零初值传递函数_2_21001'],
  timeDomainPerformance: ['时域分析法_3_0f0489e0', '动态性能指标_3_a10733c1', '稳态误差双路径判断_3_37002', '终值定理_3_be8fe1ad'],
  rootLocus: ['根轨迹法_2_e3f6c0c1', '根轨迹完整法则_3_0f2e7b11', '时域指标到目标极点区域_3_36001'],
  frequencyResponse: ['频率特性_5_404adfdd', 'Bode首轮骨架_5_1e07d9da', '奈奎斯特稳定判据_5_a1b34560', '截止频率_5_c7d09ff7', '穿越频率_5_c4c2b93c'],
  stabilityMargin: ['相角裕度_5_5a74b451', '幅值裕度_5_73af26a5'],
  controllerCorrection: ['PID控制器_6_656b8b52', '串联校正_6_fede5751', '前馈补偿_6_3bd3eb3b'],
  simulationValidation: ['跨模型验证比较_4_47006', '数据驱动控制_5_54003'],
  modernTransfer: ['船舶航向控制对象_2_21004', '状态空间_9_98b2feda', '可控性_9_b22a45c8', '可观测性_9_b26c542c', '现代控制理论_9_0b54b9a0', '最优控制_10_65717117', '鲁棒控制_3_a7fa1491', 'MASS自动化等级责任边界_5_53008'],
} as const;

const KNOWLEDGE_NODE_IDS = {
  feedbackLoop: 'kn:autocontrol:feedback-loop',
  transferFunctionModel: 'kn:autocontrol:transfer-function-model',
  timeDomainPerformance: 'kn:autocontrol:time-domain-performance',
  rootLocus: 'kn:autocontrol:root-locus',
  frequencyResponse: 'kn:autocontrol:frequency-response',
  stabilityMargin: 'kn:autocontrol:stability-margin',
  controllerCorrection: 'kn:autocontrol:controller-correction',
  simulationValidation: 'kn:autocontrol:simulation-validation',
  modernTransfer: 'kn:autocontrol:modern-transfer',
} as const;

const CAPABILITY_NODE_IDS = {
  modeling: 'cap:autocontrol:model-feedback-system',
  analysis: 'cap:autocontrol:interpret-time-frequency-response',
  synthesis: 'cap:autocontrol:synthesize-controller-correction',
  validation: 'cap:autocontrol:validate-with-simulation-evidence',
  constraints: 'cap:autocontrol:trade-off-engineering-constraints',
  transfer: 'cap:autocontrol:transfer-to-ship-ocean-mission',
  reflection: 'cap:autocontrol:reflect-with-ai-collaboration',
} as const;

const QUALITY_NODE_IDS = {
  safetyResponsibility: 'qual:autocontrol:safety-responsibility',
  evidenceIntegrity: 'qual:autocontrol:evidence-integrity',
  modelBoundaryAwareness: 'qual:autocontrol:model-boundary-awareness',
  systemTradeoff: 'qual:autocontrol:system-tradeoff',
  aiUseResponsibility: 'qual:autocontrol:ai-use-responsibility',
  continuousImprovement: 'qual:autocontrol:continuous-improvement',
  shipOceanMission: 'qual:autocontrol:ship-ocean-mission',
} as const;

function evidencePolicy(requiredFamilies: string[], minimumEvidenceCount = 2): KaqEvidencePolicy {
  return {
    requiredFamilies,
    minimumEvidenceCount,
    confidenceFloor: 0.55,
  };
}

function graphBinding(nodeKinds: string[], bindingRefs: string[]): KaqGraphBindingPolicy {
  return {
    required: true,
    nodeKinds,
    bindingRefs,
  };
}

function knowledgeObjective(input: KaqObjectiveBaseInput & {
  knowledgeNodeRefs?: string[];
}): KaqKnowledgeObjective {
  const { bindingRefs, ...objective } = input;
  return {
    ...objective,
    domain: 'knowledge',
    status: 'active',
    moduleId: objective.moduleId ?? MODULE_ID,
    evidencePolicy: evidencePolicy(['knowledge-check', 'teacher-review']),
    graphBinding: graphBinding(['knowledge'], bindingRefs),
    knowledgeNodeRefs: objective.knowledgeNodeRefs,
  };
}

function capabilityObjective(input: KaqObjectiveBaseInput & {
  behaviorVerb: string;
  successCriteria: string[];
}): KaqCapabilityObjective {
  const { bindingRefs, ...objective } = input;
  return {
    ...objective,
    domain: 'capability',
    status: 'active',
    moduleId: objective.moduleId ?? MODULE_ID,
    evidencePolicy: evidencePolicy(['performance-task', 'simulation-run', 'teacher-review']),
    graphBinding: graphBinding(['capability'], bindingRefs),
    behaviorVerb: objective.behaviorVerb,
    successCriteria: objective.successCriteria,
  };
}

function qualityObjective(input: KaqObjectiveBaseInput & {
  qualityMarker: string;
}): KaqQualityObjective {
  const { bindingRefs, ...objective } = input;
  return {
    ...objective,
    domain: 'quality',
    status: 'active',
    moduleId: objective.moduleId ?? MODULE_ID,
    evidencePolicy: evidencePolicy(['reflection', 'rubric-review', 'governed-evidence']),
    graphBinding: graphBinding(['quality'], bindingRefs),
    qualityMarker: objective.qualityMarker,
  };
}

export const AUTOCONTROL_KAQ_OBJECTIVE_CATALOG: KaqObjectiveSeedCatalog = {
  knowledge: [
    knowledgeObjective({
      id: 'knowledge:autocontrol',
      level: 'overall',
      parentId: null,
      title: '自动控制知识主干',
      description: '覆盖反馈结构、模型表征、系统分析、控制器校正、仿真验证与工程迁移的自动控制知识体系。',
      portraitDimensions: ['controlModelingRepresentation', 'systemAnalysisInterpretation'],
      bindingRefs: Object.values(KNOWLEDGE_NODE_IDS),
    }),
    knowledgeObjective({
      id: 'knowledge:autocontrol:feedback-loop',
      level: 'secondary',
      parentId: 'knowledge:autocontrol',
      title: '反馈与闭环结构',
      description: '解释反馈、闭环控制和误差信号在自动控制系统中的结构意义。',
      portraitDimensions: ['controlModelingRepresentation'],
      bindingRefs: [KNOWLEDGE_NODE_IDS.feedbackLoop],
      knowledgeNodeRefs: [...KNOWLEDGE_REFS.feedbackLoop],
    }),
    knowledgeObjective({
      id: 'knowledge:autocontrol:transfer-function-model',
      level: 'secondary',
      parentId: 'knowledge:autocontrol',
      title: '传递函数与误差模型',
      description: '用传递函数和误差传递函数建立输入、输出、扰动与误差之间的可分析模型。',
      portraitDimensions: ['controlModelingRepresentation'],
      bindingRefs: [KNOWLEDGE_NODE_IDS.transferFunctionModel],
      knowledgeNodeRefs: [...KNOWLEDGE_REFS.transferFunctionModel],
    }),
    knowledgeObjective({
      id: 'knowledge:autocontrol:time-domain-performance',
      level: 'secondary',
      parentId: 'knowledge:autocontrol',
      title: '时域响应与性能指标',
      description: '识别超调量、调节时间、稳态误差等时域指标，并把响应曲线转化为可验证要求。',
      portraitDimensions: ['systemAnalysisInterpretation'],
      bindingRefs: [KNOWLEDGE_NODE_IDS.timeDomainPerformance],
      knowledgeNodeRefs: [...KNOWLEDGE_REFS.timeDomainPerformance],
    }),
    knowledgeObjective({
      id: 'knowledge:autocontrol:root-locus',
      level: 'secondary',
      parentId: 'knowledge:autocontrol',
      title: '根轨迹分析与零点作用',
      description: '用根轨迹解释闭环极点迁移、零点引入和动态性能变化。',
      portraitDimensions: ['systemAnalysisInterpretation', 'controllerDesignSynthesis'],
      bindingRefs: [KNOWLEDGE_NODE_IDS.rootLocus],
      knowledgeNodeRefs: [...KNOWLEDGE_REFS.rootLocus],
    }),
    knowledgeObjective({
      id: 'knowledge:autocontrol:frequency-response',
      level: 'secondary',
      parentId: 'knowledge:autocontrol',
      title: '频域响应与稳定裕度',
      description: '用 Bode、Nyquist 和稳定裕度判断频域性能与鲁棒性。',
      portraitDimensions: ['systemAnalysisInterpretation', 'engineeringConstraintSafety'],
      bindingRefs: [KNOWLEDGE_NODE_IDS.frequencyResponse, KNOWLEDGE_NODE_IDS.stabilityMargin],
      knowledgeNodeRefs: [...KNOWLEDGE_REFS.frequencyResponse, ...KNOWLEDGE_REFS.stabilityMargin],
    }),
    knowledgeObjective({
      id: 'knowledge:autocontrol:controller-correction',
      level: 'secondary',
      parentId: 'knowledge:autocontrol',
      title: '控制器与校正方法',
      description: '选择 PID、超前、滞后和串联校正等方法，并说明方法适用条件。',
      portraitDimensions: ['controllerDesignSynthesis'],
      bindingRefs: [KNOWLEDGE_NODE_IDS.controllerCorrection],
      knowledgeNodeRefs: [...KNOWLEDGE_REFS.controllerCorrection],
    }),
    knowledgeObjective({
      id: 'knowledge:autocontrol:simulation-validation',
      level: 'secondary',
      parentId: 'knowledge:autocontrol',
      title: '仿真验证与跨模型比较',
      description: '用受治理的仿真和跨模型比较验证控制方案是否满足目标与约束。',
      portraitDimensions: ['simulationValidationEvidence'],
      bindingRefs: [KNOWLEDGE_NODE_IDS.simulationValidation],
      knowledgeNodeRefs: [...KNOWLEDGE_REFS.simulationValidation],
    }),
    knowledgeObjective({
      id: 'knowledge:autocontrol:modern-transfer',
      level: 'secondary',
      parentId: 'knowledge:autocontrol',
      title: '现代控制与航海场景迁移',
      description: '把经典控制判断迁移到 MPC、MASS 责任边界和船海任务的综合场景。',
      portraitDimensions: ['transferIntegratedApplication', 'engineeringConstraintSafety'],
      bindingRefs: [KNOWLEDGE_NODE_IDS.modernTransfer],
      knowledgeNodeRefs: [...KNOWLEDGE_REFS.modernTransfer],
    }),
  ],
  capability: [
    capabilityObjective({
      id: 'capability:autocontrol',
      level: 'overall',
      parentId: null,
      title: '自动控制能力主干',
      description: '面向建模、分析、综合、验证、约束取舍、迁移应用和反思协作的能力体系。',
      portraitDimensions: ['controlModelingRepresentation', 'controllerDesignSynthesis'],
      bindingRefs: Object.values(CAPABILITY_NODE_IDS),
      behaviorVerb: 'integrate',
      successCriteria: ['在控制任务中完整说明模型、分析、方案、验证证据与改进路径。'],
    }),
    capabilityObjective({
      id: 'capability:autocontrol:model-feedback-system',
      level: 'secondary',
      parentId: 'capability:autocontrol',
      title: '建立反馈系统模型',
      description: '从对象、变量、输入输出关系和反馈结构建立可分析的控制系统表征。',
      portraitDimensions: ['controlModelingRepresentation'],
      bindingRefs: [CAPABILITY_NODE_IDS.modeling],
      behaviorVerb: 'model',
      successCriteria: ['画出闭环结构并写出关键传递函数。', '说明模型假设和误差信号定义。'],
    }),
    capabilityObjective({
      id: 'capability:autocontrol:interpret-time-frequency-response',
      level: 'secondary',
      parentId: 'capability:autocontrol',
      title: '解释时频域响应',
      description: '把时域曲线、根轨迹、频域曲线和稳定裕度转化为系统性能判断。',
      portraitDimensions: ['systemAnalysisInterpretation'],
      bindingRefs: [CAPABILITY_NODE_IDS.analysis],
      behaviorVerb: 'interpret',
      successCriteria: ['用响应和裕度证据解释性能瓶颈。', '区分模型内结论和需要实验验证的判断。'],
    }),
    capabilityObjective({
      id: 'capability:autocontrol:synthesize-controller-correction',
      level: 'secondary',
      parentId: 'capability:autocontrol',
      title: '综合控制器校正方案',
      description: '根据目标、约束和分析结果选择并综合控制器或校正方案。',
      portraitDimensions: ['controllerDesignSynthesis'],
      bindingRefs: [CAPABILITY_NODE_IDS.synthesis],
      behaviorVerb: 'synthesize',
      successCriteria: ['给出参数选择依据。', '说明方案如何改变极点、零点或频域裕度。'],
    }),
    capabilityObjective({
      id: 'capability:autocontrol:validate-with-simulation-evidence',
      level: 'secondary',
      parentId: 'capability:autocontrol',
      title: '用仿真证据验证方案',
      description: '通过可复现仿真、指标对比和记录证据判断方案是否满足目标。',
      portraitDimensions: ['simulationValidationEvidence'],
      bindingRefs: [CAPABILITY_NODE_IDS.validation],
      behaviorVerb: 'validate',
      successCriteria: ['提交可复现仿真记录。', '把验证结果和原始目标逐项对应。'],
    }),
    capabilityObjective({
      id: 'capability:autocontrol:trade-off-engineering-constraints',
      level: 'secondary',
      parentId: 'capability:autocontrol',
      title: '权衡工程约束与安全边界',
      description: '识别饱和、扰动、稳定裕度、责任边界和安全约束，并作出有证据的取舍。',
      portraitDimensions: ['engineeringConstraintSafety'],
      bindingRefs: [CAPABILITY_NODE_IDS.constraints],
      behaviorVerb: 'evaluate',
      successCriteria: ['列出不可突破的硬约束。', '解释性能提升与安全裕度之间的取舍。'],
    }),
    capabilityObjective({
      id: 'capability:autocontrol:transfer-to-ship-ocean-mission',
      level: 'secondary',
      parentId: 'capability:autocontrol',
      title: '迁移到船海任务场景',
      description: '把经典控制方法迁移到船舶、MASS 或跨模型任务，并识别迁移失配。',
      portraitDimensions: ['transferIntegratedApplication'],
      bindingRefs: [CAPABILITY_NODE_IDS.transfer],
      behaviorVerb: 'transfer',
      successCriteria: ['说明源模型和目标场景的共同结构。', '标记至少一个迁移风险或补充验证需求。'],
    }),
    capabilityObjective({
      id: 'capability:autocontrol:reflect-with-ai-collaboration',
      level: 'secondary',
      parentId: 'capability:autocontrol',
      title: '反思并治理 AI 协作',
      description: '基于教师、同伴、仿真和 AI 反馈修订方案，并记录 AI 协作的可追溯边界。',
      portraitDimensions: ['reflectionImprovementAiCollab'],
      bindingRefs: [CAPABILITY_NODE_IDS.reflection],
      behaviorVerb: 'reflect',
      successCriteria: ['说明一次方案修订的证据来源。', '区分 AI 建议、个人判断和已验证结果。'],
    }),
  ],
  quality: [
    qualityObjective({
      id: 'quality:autocontrol',
      level: 'overall',
      parentId: null,
      title: '自动控制素养主干',
      description: '面向安全责任、证据诚信、模型边界、系统取舍、AI 责任、持续改进和船海使命的素养体系。',
      portraitDimensions: ['engineeringConstraintSafety', 'reflectionImprovementAiCollab'],
      bindingRefs: Object.values(QUALITY_NODE_IDS),
      qualityMarker: 'governed-control-judgement',
    }),
    qualityObjective({
      id: 'quality:autocontrol:safety-responsibility',
      level: 'secondary',
      parentId: 'quality:autocontrol',
      title: '安全责任意识',
      description: '在控制方案中优先识别可能影响人、设备和航行安全的风险。',
      portraitDimensions: ['engineeringConstraintSafety'],
      bindingRefs: [QUALITY_NODE_IDS.safetyResponsibility],
      qualityMarker: 'safety-responsibility',
    }),
    qualityObjective({
      id: 'quality:autocontrol:evidence-integrity',
      level: 'secondary',
      parentId: 'quality:autocontrol',
      title: '证据诚信',
      description: '准确标注仿真、测评、课堂观察和 AI 协作证据来源，不用孤立结果替代结论链。',
      portraitDimensions: ['simulationValidationEvidence', 'reflectionImprovementAiCollab'],
      bindingRefs: [QUALITY_NODE_IDS.evidenceIntegrity],
      qualityMarker: 'evidence-integrity',
    }),
    qualityObjective({
      id: 'quality:autocontrol:model-boundary-awareness',
      level: 'secondary',
      parentId: 'quality:autocontrol',
      title: '模型边界意识',
      description: '说明线性化、简化假设、数据覆盖和场景迁移带来的适用边界。',
      portraitDimensions: ['controlModelingRepresentation', 'engineeringConstraintSafety'],
      bindingRefs: [QUALITY_NODE_IDS.modelBoundaryAwareness],
      qualityMarker: 'model-boundary-awareness',
    }),
    qualityObjective({
      id: 'quality:autocontrol:system-tradeoff',
      level: 'secondary',
      parentId: 'quality:autocontrol',
      title: '系统取舍意识',
      description: '在速度、稳态精度、稳定裕度、执行约束和可靠性之间作出透明取舍。',
      portraitDimensions: ['systemAnalysisInterpretation', 'engineeringConstraintSafety'],
      bindingRefs: [QUALITY_NODE_IDS.systemTradeoff],
      qualityMarker: 'system-tradeoff',
    }),
    qualityObjective({
      id: 'quality:autocontrol:ai-use-responsibility',
      level: 'secondary',
      parentId: 'quality:autocontrol',
      title: 'AI 使用责任',
      description: '把 AI 输出作为待验证建议，保留提示、改写、验证和人工判断记录。',
      portraitDimensions: ['reflectionImprovementAiCollab'],
      bindingRefs: [QUALITY_NODE_IDS.aiUseResponsibility],
      qualityMarker: 'ai-use-responsibility',
    }),
    qualityObjective({
      id: 'quality:autocontrol:continuous-improvement',
      level: 'secondary',
      parentId: 'quality:autocontrol',
      title: '持续改进',
      description: '根据失败证据、教师反馈和自我反思迭代控制方案与学习策略。',
      portraitDimensions: ['reflectionImprovementAiCollab'],
      bindingRefs: [QUALITY_NODE_IDS.continuousImprovement],
      qualityMarker: 'continuous-improvement',
    }),
    qualityObjective({
      id: 'quality:autocontrol:ship-ocean-mission',
      level: 'secondary',
      parentId: 'quality:autocontrol',
      title: '船海使命关联',
      description: '把控制判断放入船舶、航行安全、MASS 协同和海洋工程责任场景中解释。',
      portraitDimensions: ['transferIntegratedApplication', 'engineeringConstraintSafety'],
      bindingRefs: [QUALITY_NODE_IDS.shipOceanMission],
      qualityMarker: 'ship-ocean-mission',
    }),
  ],
};

const knowledgeNodes: KaqKnowledgeGraphNode[] = [
  {
    id: KNOWLEDGE_NODE_IDS.feedbackLoop,
    domain: 'knowledge',
    kind: 'concept',
    title: '反馈与闭环控制',
    description: '把反馈、误差、闭环结构和控制作用组织为控制系统的基础结构节点。',
    objectiveIds: ['knowledge:autocontrol:feedback-loop'],
    moduleId: MODULE_ID,
    portraitDimensions: ['controlModelingRepresentation'],
    status: 'active',
    knowledgeRefs: [...KNOWLEDGE_REFS.feedbackLoop],
  },
  {
    id: KNOWLEDGE_NODE_IDS.transferFunctionModel,
    domain: 'knowledge',
    kind: 'model',
    title: '传递函数模型',
    description: '连接对象、输入输出、误差和扰动的可计算模型节点。',
    objectiveIds: ['knowledge:autocontrol:transfer-function-model'],
    moduleId: MODULE_ID,
    portraitDimensions: ['controlModelingRepresentation'],
    status: 'active',
    knowledgeRefs: [...KNOWLEDGE_REFS.transferFunctionModel],
  },
  {
    id: KNOWLEDGE_NODE_IDS.timeDomainPerformance,
    domain: 'knowledge',
    kind: 'criterion',
    title: '时域响应与性能指标',
    description: '描述响应曲线、超调、调节时间和稳态误差等时域判断依据。',
    objectiveIds: ['knowledge:autocontrol:time-domain-performance'],
    moduleId: MODULE_ID,
    portraitDimensions: ['systemAnalysisInterpretation'],
    status: 'active',
    knowledgeRefs: [...KNOWLEDGE_REFS.timeDomainPerformance],
  },
  {
    id: KNOWLEDGE_NODE_IDS.rootLocus,
    domain: 'knowledge',
    kind: 'method',
    title: '根轨迹分析',
    description: '用开环参数变化解释闭环极点迁移和校正设计方向。',
    objectiveIds: ['knowledge:autocontrol:root-locus'],
    moduleId: MODULE_ID,
    portraitDimensions: ['systemAnalysisInterpretation', 'controllerDesignSynthesis'],
    status: 'active',
    knowledgeRefs: [...KNOWLEDGE_REFS.rootLocus],
  },
  {
    id: KNOWLEDGE_NODE_IDS.frequencyResponse,
    domain: 'knowledge',
    kind: 'method',
    title: '频域响应判读',
    description: '用 Bode 和 Nyquist 图识别频段特征与稳定性风险。',
    objectiveIds: ['knowledge:autocontrol:frequency-response'],
    moduleId: MODULE_ID,
    portraitDimensions: ['systemAnalysisInterpretation'],
    status: 'active',
    knowledgeRefs: [...KNOWLEDGE_REFS.frequencyResponse],
  },
  {
    id: KNOWLEDGE_NODE_IDS.stabilityMargin,
    domain: 'knowledge',
    kind: 'criterion',
    title: '稳定裕度',
    description: '用幅值裕度和相角裕度表达鲁棒性和工程安全余量。',
    objectiveIds: ['knowledge:autocontrol:frequency-response'],
    moduleId: MODULE_ID,
    portraitDimensions: ['systemAnalysisInterpretation', 'engineeringConstraintSafety'],
    status: 'active',
    knowledgeRefs: [...KNOWLEDGE_REFS.stabilityMargin],
  },
  {
    id: KNOWLEDGE_NODE_IDS.controllerCorrection,
    domain: 'knowledge',
    kind: 'method',
    title: '控制器与校正',
    description: '承载 PID、串联校正、超前滞后设计等控制综合方法。',
    objectiveIds: ['knowledge:autocontrol:controller-correction'],
    moduleId: MODULE_ID,
    portraitDimensions: ['controllerDesignSynthesis'],
    status: 'active',
    knowledgeRefs: [...KNOWLEDGE_REFS.controllerCorrection],
  },
  {
    id: KNOWLEDGE_NODE_IDS.simulationValidation,
    domain: 'knowledge',
    kind: 'case',
    title: '仿真验证与跨模型比较',
    description: '把设计方案放入仿真、四联图和跨模型比较中形成验证证据。',
    objectiveIds: ['knowledge:autocontrol:simulation-validation'],
    moduleId: MODULE_ID,
    portraitDimensions: ['simulationValidationEvidence'],
    status: 'active',
    knowledgeRefs: [...KNOWLEDGE_REFS.simulationValidation],
  },
  {
    id: KNOWLEDGE_NODE_IDS.modernTransfer,
    domain: 'knowledge',
    kind: 'case',
    title: '现代控制与船海迁移',
    description: '用 MPC、MASS 责任边界和多路线比较承接现代控制与船海任务迁移。',
    objectiveIds: ['knowledge:autocontrol:modern-transfer'],
    moduleId: MODULE_ID,
    portraitDimensions: ['transferIntegratedApplication', 'engineeringConstraintSafety'],
    status: 'active',
    knowledgeRefs: [...KNOWLEDGE_REFS.modernTransfer],
  },
];

const capabilityNodes: KaqCapabilityGraphNode[] = [
  {
    id: CAPABILITY_NODE_IDS.modeling,
    domain: 'capability',
    title: '建立反馈系统模型',
    description: '从任务描述中抽取对象、变量、反馈结构和传递函数。',
    objectiveIds: ['capability:autocontrol:model-feedback-system'],
    moduleId: MODULE_ID,
    portraitDimensions: ['controlModelingRepresentation'],
    status: 'active',
    knowledgeNodeIds: [KNOWLEDGE_NODE_IDS.feedbackLoop, KNOWLEDGE_NODE_IDS.transferFunctionModel],
    bloomLevel: 'apply',
    behaviorVerb: 'model',
    taskContext: 'automatic-control modeling task',
    successCriteria: ['Produces a feedback block diagram.', 'Defines transfer functions and error signals.'],
    observableEvidenceTypes: ['diagram-submission', 'formula-response'],
    evaluationMethods: ['teacher rubric review', 'structured model checklist'],
  },
  {
    id: CAPABILITY_NODE_IDS.analysis,
    domain: 'capability',
    title: '解释时频域响应',
    description: '把时域、根轨迹、频域和稳定裕度证据解释为系统性能判断。',
    objectiveIds: ['capability:autocontrol:interpret-time-frequency-response'],
    moduleId: MODULE_ID,
    portraitDimensions: ['systemAnalysisInterpretation'],
    status: 'active',
    knowledgeNodeIds: [
      KNOWLEDGE_NODE_IDS.timeDomainPerformance,
      KNOWLEDGE_NODE_IDS.rootLocus,
      KNOWLEDGE_NODE_IDS.frequencyResponse,
      KNOWLEDGE_NODE_IDS.stabilityMargin,
    ],
    bloomLevel: 'analyze',
    behaviorVerb: 'interpret',
    taskContext: 'time and frequency response diagnosis',
    successCriteria: ['Cites at least two response indicators.', 'Separates analysis evidence from design preference.'],
    observableEvidenceTypes: ['analysis-answer', 'chart-annotation'],
    evaluationMethods: ['diagnostic item review', 'teacher explanation rubric'],
  },
  {
    id: CAPABILITY_NODE_IDS.synthesis,
    domain: 'capability',
    title: '综合控制器校正方案',
    description: '选择并参数化控制器或校正方案以满足目标和约束。',
    objectiveIds: ['capability:autocontrol:synthesize-controller-correction'],
    moduleId: MODULE_ID,
    portraitDimensions: ['controllerDesignSynthesis'],
    status: 'active',
    knowledgeNodeIds: [
      KNOWLEDGE_NODE_IDS.rootLocus,
      KNOWLEDGE_NODE_IDS.frequencyResponse,
      KNOWLEDGE_NODE_IDS.controllerCorrection,
    ],
    bloomLevel: 'create',
    behaviorVerb: 'synthesize',
    taskContext: 'controller correction design task',
    successCriteria: ['Selects a method with rationale.', 'Shows expected pole, zero, or margin change.'],
    observableEvidenceTypes: ['design-submission', 'parameter-selection'],
    evaluationMethods: ['design rubric review', 'simulation comparison'],
  },
  {
    id: CAPABILITY_NODE_IDS.validation,
    domain: 'capability',
    title: '用仿真证据验证方案',
    description: '用受治理的仿真记录验证控制方案是否满足目标。',
    objectiveIds: ['capability:autocontrol:validate-with-simulation-evidence'],
    moduleId: MODULE_ID,
    portraitDimensions: ['simulationValidationEvidence'],
    status: 'active',
    knowledgeNodeIds: [
      KNOWLEDGE_NODE_IDS.timeDomainPerformance,
      KNOWLEDGE_NODE_IDS.controllerCorrection,
      KNOWLEDGE_NODE_IDS.simulationValidation,
    ],
    bloomLevel: 'evaluate',
    behaviorVerb: 'validate',
    taskContext: 'simulation-backed correction evaluation',
    successCriteria: ['Links each target to a simulation result.', 'Reports mismatch and evidence limitations.'],
    observableEvidenceTypes: ['simulation-run', 'metric-comparison', 'validation-note'],
    evaluationMethods: ['governed simulation replay', 'metric threshold review'],
  },
  {
    id: CAPABILITY_NODE_IDS.constraints,
    domain: 'capability',
    title: '权衡工程约束与安全边界',
    description: '评价控制方案在稳定裕度、执行约束和安全责任之间的取舍。',
    objectiveIds: ['capability:autocontrol:trade-off-engineering-constraints'],
    moduleId: MODULE_ID,
    portraitDimensions: ['engineeringConstraintSafety'],
    status: 'active',
    knowledgeNodeIds: [
      KNOWLEDGE_NODE_IDS.stabilityMargin,
      KNOWLEDGE_NODE_IDS.controllerCorrection,
      KNOWLEDGE_NODE_IDS.modernTransfer,
    ],
    bloomLevel: 'evaluate',
    behaviorVerb: 'evaluate',
    taskContext: 'engineering constraint review',
    successCriteria: ['Names hard constraints before optimization.', 'Explains at least one performance-safety tradeoff.'],
    observableEvidenceTypes: ['constraint-table', 'risk-review'],
    evaluationMethods: ['constraint checklist', 'teacher rubric review'],
  },
  {
    id: CAPABILITY_NODE_IDS.transfer,
    domain: 'capability',
    title: '迁移到船海任务场景',
    description: '把控制设计和验证方法迁移到船海任务，并识别迁移失配。',
    objectiveIds: ['capability:autocontrol:transfer-to-ship-ocean-mission'],
    moduleId: MODULE_ID,
    portraitDimensions: ['transferIntegratedApplication'],
    status: 'active',
    knowledgeNodeIds: [KNOWLEDGE_NODE_IDS.simulationValidation, KNOWLEDGE_NODE_IDS.modernTransfer],
    bloomLevel: 'apply',
    behaviorVerb: 'transfer',
    taskContext: 'ship-ocean mission transfer task',
    successCriteria: ['Maps source assumptions to target mission conditions.', 'Identifies at least one transfer validation need.'],
    observableEvidenceTypes: ['transfer-map', 'mission-case-response'],
    evaluationMethods: ['case rubric review', 'cross-model validation checklist'],
  },
  {
    id: CAPABILITY_NODE_IDS.reflection,
    domain: 'capability',
    title: '反思并治理 AI 协作',
    description: '根据证据和 AI 建议修订控制判断，同时保留人工验证责任。',
    objectiveIds: ['capability:autocontrol:reflect-with-ai-collaboration'],
    moduleId: MODULE_ID,
    portraitDimensions: ['reflectionImprovementAiCollab'],
    status: 'active',
    knowledgeNodeIds: [KNOWLEDGE_NODE_IDS.feedbackLoop, KNOWLEDGE_NODE_IDS.simulationValidation, KNOWLEDGE_NODE_IDS.modernTransfer],
    bloomLevel: 'evaluate',
    behaviorVerb: 'reflect',
    taskContext: 'AI-supported control design reflection',
    successCriteria: ['Documents an evidence-based revision.', 'Labels AI suggestions that remain unverified.'],
    observableEvidenceTypes: ['reflection-submit', 'ai-interaction-log'],
    evaluationMethods: ['reflection rubric review', 'AI-use governance checklist'],
  },
];

function rubric(id: string, label: string, criteria: string[]) {
  return { id, label, criteria };
}

function qualityNode(input: Omit<KaqQualityGraphNode, 'domain' | 'moduleId' | 'status' | 'rubricLevels'> & {
  rubricCriteria: [string, string, string];
}): KaqQualityGraphNode {
  const { rubricCriteria, ...node } = input;
  return {
    ...node,
    domain: 'quality',
    moduleId: MODULE_ID,
    status: 'active',
    rubricLevels: [
      rubric('emerging', 'Emerging', [rubricCriteria[0]]),
      rubric('proficient', 'Proficient', [rubricCriteria[1]]),
      rubric('advanced', 'Advanced', [rubricCriteria[2]]),
    ],
  };
}

const qualityNodes: KaqQualityGraphNode[] = [
  qualityNode({
    id: QUALITY_NODE_IDS.safetyResponsibility,
    title: '安全责任意识',
    description: '在控制方案中优先识别安全风险并保留责任边界。',
    objectiveIds: ['quality:autocontrol:safety-responsibility'],
    portraitDimensions: ['engineeringConstraintSafety'],
    scenario: '学生为船舶航向或速度控制方案提交工程判断时，需要说明失稳、饱和和责任边界风险。',
    observableBehaviors: ['Names safety-critical failure modes.', 'Keeps unsafe performance gains out of the recommended solution.'],
    evidenceSources: ['risk-review', 'teacher-rubric'],
    rubricCriteria: [
      'Mentions safety risk without connecting it to the control decision.',
      'Connects safety risk to constraints and accepted evidence.',
      'Prioritizes safety boundaries and proposes verification before deployment.',
    ],
  }),
  qualityNode({
    id: QUALITY_NODE_IDS.evidenceIntegrity,
    title: '证据诚信',
    description: '准确声明证据来源、缺口和结论边界。',
    objectiveIds: ['quality:autocontrol:evidence-integrity'],
    portraitDimensions: ['simulationValidationEvidence', 'reflectionImprovementAiCollab'],
    scenario: '学生用仿真结果、课堂测评和 AI 建议支持控制方案时，需要区分已验证证据和推测。',
    observableBehaviors: ['Cites simulation and assessment sources.', 'Marks unsupported claims as pending verification.'],
    evidenceSources: ['simulation-run', 'assessment-answer', 'ai-interaction-log'],
    rubricCriteria: [
      'Lists results but omits source or limitation.',
      'Cites evidence sources and states the main limitation.',
      'Builds a traceable evidence chain and identifies unresolved uncertainty.',
    ],
  }),
  qualityNode({
    id: QUALITY_NODE_IDS.modelBoundaryAwareness,
    title: '模型边界意识',
    description: '说明模型假设、线性化边界和迁移限制。',
    objectiveIds: ['quality:autocontrol:model-boundary-awareness'],
    portraitDimensions: ['controlModelingRepresentation', 'engineeringConstraintSafety'],
    scenario: '学生把课堂模型迁移到非线性、扰动或船海场景时，需要说明模型适用范围。',
    observableBehaviors: ['States model assumptions.', 'Flags when target conditions exceed model coverage.'],
    evidenceSources: ['model-submission', 'transfer-map'],
    rubricCriteria: [
      'Uses a model without naming assumptions.',
      'States assumptions and one boundary condition.',
      'Connects boundaries to validation needs and alternative model choices.',
    ],
  }),
  qualityNode({
    id: QUALITY_NODE_IDS.systemTradeoff,
    title: '系统取舍意识',
    description: '透明处理性能、鲁棒性、执行约束和可靠性的取舍。',
    objectiveIds: ['quality:autocontrol:system-tradeoff'],
    portraitDimensions: ['systemAnalysisInterpretation', 'engineeringConstraintSafety'],
    scenario: '学生比较多个控制方案时，需要解释响应速度、超调、裕度和执行约束之间的取舍。',
    observableBehaviors: ['Compares alternatives with shared metrics.', 'Justifies the selected tradeoff against constraints.'],
    evidenceSources: ['metric-comparison', 'constraint-table'],
    rubricCriteria: [
      'Chooses a solution from a single preferred metric.',
      'Compares metrics and explains a tradeoff.',
      'Makes an explicit constraint-aware decision and records rejected alternatives.',
    ],
  }),
  qualityNode({
    id: QUALITY_NODE_IDS.aiUseResponsibility,
    title: 'AI 使用责任',
    description: '把 AI 输出纳入可追溯、可验证的人工判断流程。',
    objectiveIds: ['quality:autocontrol:ai-use-responsibility'],
    portraitDimensions: ['reflectionImprovementAiCollab'],
    scenario: '学生使用 AI 生成分析、参数建议或解释文本时，需要保留提示、核查和人工判断记录。',
    observableBehaviors: ['Separates AI suggestions from verified conclusions.', 'Documents prompts and verification steps.'],
    evidenceSources: ['ai-interaction-log', 'reflection-submit'],
    rubricCriteria: [
      'Uses AI output without visible verification.',
      'Documents AI contribution and checks the main claim.',
      'Critiques AI output, verifies with course evidence, and revises responsibly.',
    ],
  }),
  qualityNode({
    id: QUALITY_NODE_IDS.continuousImprovement,
    title: '持续改进',
    description: '依据失败证据和反馈迭代学习策略与控制方案。',
    objectiveIds: ['quality:autocontrol:continuous-improvement'],
    portraitDimensions: ['reflectionImprovementAiCollab'],
    scenario: '学生在一次设计或测评失败后，需要把错误证据转化为下一轮修订行动。',
    observableBehaviors: ['Identifies the failed assumption or step.', 'Plans a specific revision and follow-up check.'],
    evidenceSources: ['reflection-submit', 'teacher-feedback'],
    rubricCriteria: [
      'States that improvement is needed without a concrete action.',
      'Names the failure evidence and proposes a targeted revision.',
      'Runs or schedules a follow-up validation and updates the learning strategy.',
    ],
  }),
  qualityNode({
    id: QUALITY_NODE_IDS.shipOceanMission,
    title: '船海使命关联',
    description: '把自动控制判断放入船舶与海洋工程责任语境。',
    objectiveIds: ['quality:autocontrol:ship-ocean-mission'],
    portraitDimensions: ['transferIntegratedApplication', 'engineeringConstraintSafety'],
    scenario: '学生把控制方法用于船舶航行、MASS 协同或海洋工程任务时，需要说明工程责任和场景价值。',
    observableBehaviors: ['Connects control evidence to mission constraints.', 'Names stakeholder or operational responsibility.'],
    evidenceSources: ['mission-case-response', 'transfer-map'],
    rubricCriteria: [
      'Mentions a ship-ocean context without technical connection.',
      'Links control choice to mission condition and responsibility.',
      'Explains mission value, safety responsibility, and validation plan together.',
    ],
  }),
];

const edges: KaqGraphEdge[] = [
  {
    id: 'edge:kn:feedback-supports-model',
    domain: 'knowledge',
    sourceNodeId: KNOWLEDGE_NODE_IDS.feedbackLoop,
    targetNodeId: KNOWLEDGE_NODE_IDS.transferFunctionModel,
    relation: 'supports',
    strength: 'strong',
    rationale: 'Feedback structure enables transfer-function modeling of closed-loop behavior.',
  },
  {
    id: 'edge:kn:model-supports-time-domain',
    domain: 'knowledge',
    sourceNodeId: KNOWLEDGE_NODE_IDS.transferFunctionModel,
    targetNodeId: KNOWLEDGE_NODE_IDS.timeDomainPerformance,
    relation: 'supports',
    strength: 'strong',
    rationale: 'Transfer-function models are prerequisites for time-domain response interpretation.',
  },
  {
    id: 'edge:kn:time-domain-supports-root-locus',
    domain: 'knowledge',
    sourceNodeId: KNOWLEDGE_NODE_IDS.timeDomainPerformance,
    targetNodeId: KNOWLEDGE_NODE_IDS.rootLocus,
    relation: 'supports',
    strength: 'medium',
    rationale: 'Time-domain requirements support root-locus target-region reasoning.',
  },
  {
    id: 'edge:kn:root-locus-applies-correction',
    domain: 'knowledge',
    sourceNodeId: KNOWLEDGE_NODE_IDS.rootLocus,
    targetNodeId: KNOWLEDGE_NODE_IDS.controllerCorrection,
    relation: 'applies',
    strength: 'strong',
    rationale: 'Root-locus reasoning applies directly to zero, pole, and correction method selection.',
  },
  {
    id: 'edge:kn:correction-depends-on-root-locus',
    domain: 'knowledge',
    sourceNodeId: KNOWLEDGE_NODE_IDS.controllerCorrection,
    targetNodeId: KNOWLEDGE_NODE_IDS.rootLocus,
    relation: 'depends-on',
    strength: 'medium',
    rationale: 'Controller correction choices depend on root-locus reasoning when pole-zero placement drives the design.',
  },
  {
    id: 'edge:kn:frequency-supports-margin',
    domain: 'knowledge',
    sourceNodeId: KNOWLEDGE_NODE_IDS.frequencyResponse,
    targetNodeId: KNOWLEDGE_NODE_IDS.stabilityMargin,
    relation: 'supports',
    strength: 'strong',
    rationale: 'Frequency-response analysis supports gain and phase margin judgement.',
  },
  {
    id: 'edge:kn:margin-constrains-correction',
    domain: 'knowledge',
    sourceNodeId: KNOWLEDGE_NODE_IDS.stabilityMargin,
    targetNodeId: KNOWLEDGE_NODE_IDS.controllerCorrection,
    relation: 'constrains',
    strength: 'strong',
    rationale: 'Stability margins constrain aggressive correction choices and express engineering tradeoff.',
  },
  {
    id: 'edge:kn:validation-assesses-correction',
    domain: 'knowledge',
    sourceNodeId: KNOWLEDGE_NODE_IDS.simulationValidation,
    targetNodeId: KNOWLEDGE_NODE_IDS.controllerCorrection,
    relation: 'assesses',
    strength: 'medium',
    rationale: 'Simulation validation assesses whether the correction design achieves the declared target.',
  },
  {
    id: 'edge:kn:validation-transfers-modern',
    domain: 'knowledge',
    sourceNodeId: KNOWLEDGE_NODE_IDS.simulationValidation,
    targetNodeId: KNOWLEDGE_NODE_IDS.modernTransfer,
    relation: 'transfers-to',
    strength: 'medium',
    rationale: 'Validated control reasoning transfers to modern control and ship-ocean mission cases.',
  },
  {
    id: 'edge:cap:modeling-supports-analysis',
    domain: 'capability',
    sourceNodeId: CAPABILITY_NODE_IDS.modeling,
    targetNodeId: CAPABILITY_NODE_IDS.analysis,
    relation: 'supports',
    strength: 'strong',
    rationale: 'Modeling capability enables credible time-frequency response interpretation.',
  },
  {
    id: 'edge:cap:analysis-supports-synthesis',
    domain: 'capability',
    sourceNodeId: CAPABILITY_NODE_IDS.analysis,
    targetNodeId: CAPABILITY_NODE_IDS.synthesis,
    relation: 'supports',
    strength: 'strong',
    rationale: 'Analysis evidence supports controller synthesis choices.',
  },
  {
    id: 'edge:cap:validation-assesses-synthesis',
    domain: 'capability',
    sourceNodeId: CAPABILITY_NODE_IDS.validation,
    targetNodeId: CAPABILITY_NODE_IDS.synthesis,
    relation: 'assesses',
    strength: 'strong',
    rationale: 'Validation assesses the synthesized controller against the stated targets.',
  },
  {
    id: 'edge:cap:constraints-constrain-synthesis',
    domain: 'capability',
    sourceNodeId: CAPABILITY_NODE_IDS.constraints,
    targetNodeId: CAPABILITY_NODE_IDS.synthesis,
    relation: 'constrains',
    strength: 'strong',
    rationale: 'Engineering constraints and safety boundaries constrain design tradeoff decisions.',
  },
  {
    id: 'edge:cap:validation-transfers-mission',
    domain: 'capability',
    sourceNodeId: CAPABILITY_NODE_IDS.validation,
    targetNodeId: CAPABILITY_NODE_IDS.transfer,
    relation: 'transfers-to',
    strength: 'medium',
    rationale: 'Validated evidence is required before transferring methods to mission contexts.',
  },
  {
    id: 'edge:cap:reflection-extends-validation',
    domain: 'capability',
    sourceNodeId: CAPABILITY_NODE_IDS.reflection,
    targetNodeId: CAPABILITY_NODE_IDS.validation,
    relation: 'extends',
    strength: 'medium',
    rationale: 'Reflection and AI collaboration extend validation by recording revisions and unresolved uncertainty.',
  },
  {
    id: 'edge:qual:evidence-supports-safety',
    domain: 'quality',
    sourceNodeId: QUALITY_NODE_IDS.evidenceIntegrity,
    targetNodeId: QUALITY_NODE_IDS.safetyResponsibility,
    relation: 'supports',
    strength: 'strong',
    rationale: 'Evidence integrity supports responsible safety judgement.',
  },
  {
    id: 'edge:qual:model-boundary-constrains-tradeoff',
    domain: 'quality',
    sourceNodeId: QUALITY_NODE_IDS.modelBoundaryAwareness,
    targetNodeId: QUALITY_NODE_IDS.systemTradeoff,
    relation: 'constrains',
    strength: 'strong',
    rationale: 'Model boundaries constrain valid performance and robustness tradeoffs.',
  },
  {
    id: 'edge:qual:ai-supports-improvement',
    domain: 'quality',
    sourceNodeId: QUALITY_NODE_IDS.aiUseResponsibility,
    targetNodeId: QUALITY_NODE_IDS.continuousImprovement,
    relation: 'supports',
    strength: 'medium',
    rationale: 'Responsible AI use supports traceable improvement rather than unverified shortcutting.',
  },
  {
    id: 'edge:qual:improvement-transfers-mission',
    domain: 'quality',
    sourceNodeId: QUALITY_NODE_IDS.continuousImprovement,
    targetNodeId: QUALITY_NODE_IDS.shipOceanMission,
    relation: 'transfers-to',
    strength: 'medium',
    rationale: 'Continuous improvement transfers classroom control judgement into ship-ocean mission responsibility.',
  },
  {
    id: 'edge:qual:safety-assesses-mission',
    domain: 'quality',
    sourceNodeId: QUALITY_NODE_IDS.safetyResponsibility,
    targetNodeId: QUALITY_NODE_IDS.shipOceanMission,
    relation: 'assesses',
    strength: 'strong',
    rationale: 'Safety responsibility assesses whether mission-oriented claims remain acceptable.',
  },
];

export const AUTOCONTROL_KAQ_GRAPH_CATALOG: KaqGraphCatalog = {
  nodes: [...knowledgeNodes, ...capabilityNodes, ...qualityNodes],
  edges,
};

export const AUTOCONTROL_KAQ_OBJECTIVES = [
  ...AUTOCONTROL_KAQ_OBJECTIVE_CATALOG.knowledge,
  ...AUTOCONTROL_KAQ_OBJECTIVE_CATALOG.capability,
  ...AUTOCONTROL_KAQ_OBJECTIVE_CATALOG.quality,
] as const;

export const AUTOCONTROL_KAQ_RUNTIME_KNOWLEDGE_COVERAGE: AutocontrolKaqRuntimeKnowledgeCoverage[] = [
  {
    graphNodeId: KNOWLEDGE_NODE_IDS.feedbackLoop,
    coverageState: 'partial',
    runtimeKnowledgeRefs: [...KNOWLEDGE_REFS.feedbackLoop],
    limitation: 'Runtime content has canonical feedback and negative-feedback nodes, but the negative-feedback node does not yet expose an infograph asset.',
  },
  {
    graphNodeId: KNOWLEDGE_NODE_IDS.transferFunctionModel,
    coverageState: 'partial',
    runtimeKnowledgeRefs: [...KNOWLEDGE_REFS.transferFunctionModel],
    limitation: 'Runtime content has canonical modeling and transfer-function nodes, but these model nodes do not yet expose infograph assets.',
  },
  {
    graphNodeId: KNOWLEDGE_NODE_IDS.timeDomainPerformance,
    coverageState: 'partial',
    runtimeKnowledgeRefs: [...KNOWLEDGE_REFS.timeDomainPerformance],
    limitation: 'Runtime content has time-domain canonical nodes and evidence-backed detail nodes, but not every canonical time-domain node exposes an infograph asset.',
  },
  {
    graphNodeId: KNOWLEDGE_NODE_IDS.rootLocus,
    coverageState: 'partial',
    runtimeKnowledgeRefs: [...KNOWLEDGE_REFS.rootLocus],
    limitation: 'Runtime content has canonical root-locus nodes and target-pole material, but core root-locus canonical nodes do not yet expose infograph assets.',
  },
  {
    graphNodeId: KNOWLEDGE_NODE_IDS.frequencyResponse,
    coverageState: 'partial',
    runtimeKnowledgeRefs: [...KNOWLEDGE_REFS.frequencyResponse],
    limitation: 'Runtime content has canonical frequency-response nodes and margin assets, but the Bode skeleton node does not yet expose an infograph asset.',
  },
  {
    graphNodeId: KNOWLEDGE_NODE_IDS.stabilityMargin,
    coverageState: 'runtime-bound',
    runtimeKnowledgeRefs: [...KNOWLEDGE_REFS.stabilityMargin],
  },
  {
    graphNodeId: KNOWLEDGE_NODE_IDS.controllerCorrection,
    coverageState: 'partial',
    runtimeKnowledgeRefs: [...KNOWLEDGE_REFS.controllerCorrection],
    limitation: 'PID has multiple runtime ids across chapters, so the seed binds one broad PID controller node and records the canonicalization gap.',
  },
  {
    graphNodeId: KNOWLEDGE_NODE_IDS.simulationValidation,
    coverageState: 'partial',
    runtimeKnowledgeRefs: [...KNOWLEDGE_REFS.simulationValidation],
    limitation: 'Runtime content covers cross-model comparison and data-driven evidence, but it does not yet expose a dedicated simulation-validation knowledge node.',
  },
  {
    graphNodeId: KNOWLEDGE_NODE_IDS.modernTransfer,
    coverageState: 'partial',
    runtimeKnowledgeRefs: [...KNOWLEDGE_REFS.modernTransfer],
    limitation: 'Runtime content covers state-space foundations and broad modern-control topics, but optimal, robust, and frontier-control entries remain umbrella nodes rather than a complete objective progression.',
  },
];

export function validateAutocontrolKaqGraphCatalog(): AutocontrolKaqGraphCatalogValidationReport {
  return {
    objectiveValidation: validateKaqObjectiveCatalog(AUTOCONTROL_KAQ_OBJECTIVE_CATALOG),
    graphValidation: validateKaqGraphCatalog(
      AUTOCONTROL_KAQ_GRAPH_CATALOG,
      AUTOCONTROL_KAQ_OBJECTIVE_CATALOG,
    ),
  };
}
