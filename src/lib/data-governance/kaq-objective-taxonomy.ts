import type { CompetencyDimension, CompetencyVector } from './competency-model';
import type {
  AdaptiveLearnerSecondaryDimension,
  ControlCorrectionDimensionId,
} from './adaptive-learner-state-service';

export type KaqObjectiveDomain = 'knowledge' | 'capability' | 'quality';
export type KaqObjectiveLevel = 'overall' | 'secondary' | 'tertiary';
export type KaqObjectiveStatus = 'draft' | 'active' | 'deprecated';
export type PortraitV2MappingConfidence = 'none' | 'low' | 'medium' | 'high';

export type PortraitV2DimensionId =
  | 'controlModelingRepresentation'
  | 'systemAnalysisInterpretation'
  | 'controllerDesignSynthesis'
  | 'simulationValidationEvidence'
  | 'engineeringConstraintSafety'
  | 'transferIntegratedApplication'
  | 'reflectionImprovementAiCollab';

export interface PortraitV2DimensionDefinition {
  id: PortraitV2DimensionId;
  label: string;
  description: string;
}

export interface KaqEvidencePolicy {
  requiredFamilies: string[];
  minimumEvidenceCount: number;
  confidenceFloor: number;
}

export interface KaqGraphBindingPolicy {
  required: boolean;
  nodeKinds: string[];
  bindingRefs: string[];
}

export interface KaqObjective {
  id: string;
  domain: KaqObjectiveDomain;
  level: KaqObjectiveLevel;
  parentId: string | null;
  title: string;
  description: string;
  moduleId?: string;
  portraitDimensions: PortraitV2DimensionId[];
  evidencePolicy: KaqEvidencePolicy | null;
  graphBinding: KaqGraphBindingPolicy | null;
  status: KaqObjectiveStatus;
}

export interface KaqKnowledgeObjective extends KaqObjective {
  domain: 'knowledge';
  knowledgeNodeRefs?: string[];
}

export interface KaqCapabilityObjective extends KaqObjective {
  domain: 'capability';
  behaviorVerb?: string;
  successCriteria?: string[];
}

export interface KaqQualityObjective extends KaqObjective {
  domain: 'quality';
  qualityMarker?: string;
}

export interface KaqObjectiveSeedCatalog {
  knowledge: KaqKnowledgeObjective[];
  capability: KaqCapabilityObjective[];
  quality: KaqQualityObjective[];
}

export type KaqObjectiveValidationIssueCode =
  | 'duplicate-id'
  | 'missing-id'
  | 'invalid-id'
  | 'missing-title'
  | 'missing-description'
  | 'missing-parent-id'
  | 'invalid-domain'
  | 'invalid-level'
  | 'invalid-parent'
  | 'invalid-level-parent'
  | 'domain-mismatch'
  | 'missing-portrait-dimension'
  | 'invalid-portrait-dimension'
  | 'missing-evidence-policy'
  | 'invalid-evidence-policy'
  | 'missing-graph-binding'
  | 'invalid-graph-binding'
  | 'invalid-status';

export interface KaqObjectiveValidationIssue {
  code: KaqObjectiveValidationIssueCode;
  objectiveId: string | null;
  message: string;
}

export interface KaqObjectiveValidationResult {
  valid: boolean;
  issues: KaqObjectiveValidationIssue[];
}

export interface PortraitV2DimensionMapping {
  sourceDimension: string;
  targetDimensions: PortraitV2DimensionId[];
  confidence: PortraitV2MappingConfidence;
  limitations: string[];
}

export const PORTRAIT_V2_DIMENSIONS: PortraitV2DimensionDefinition[] = [
  {
    id: 'controlModelingRepresentation',
    label: '控制建模与表征',
    description: '从对象、变量、结构和假设建立控制系统表征。',
  },
  {
    id: 'systemAnalysisInterpretation',
    label: '系统分析与解释',
    description: '解释时域、频域和结构性分析结果。',
  },
  {
    id: 'controllerDesignSynthesis',
    label: '控制器设计与综合',
    description: '选择方法并综合控制器或校正方案。',
  },
  {
    id: 'simulationValidationEvidence',
    label: '仿真验证与证据',
    description: '通过受治理的仿真、回放或测评证据验证结论。',
  },
  {
    id: 'engineeringConstraintSafety',
    label: '工程约束与安全',
    description: '识别约束、风险、安全边界和工程取舍。',
  },
  {
    id: 'transferIntegratedApplication',
    label: '迁移整合与应用',
    description: '将方法迁移到跨模型、跨任务或综合应用场景。',
  },
  {
    id: 'reflectionImprovementAiCollab',
    label: '反思改进与 AI 协作',
    description: '基于反馈迭代改进，并治理 AI 协作过程。',
  },
];

export const PORTRAIT_V2_DIMENSION_IDS = PORTRAIT_V2_DIMENSIONS.map((dimension) => dimension.id);

const PORTRAIT_V2_DIMENSION_SET = new Set<string>(PORTRAIT_V2_DIMENSION_IDS);

const EXPECTED_PARENT_LEVEL: Record<KaqObjectiveLevel, KaqObjectiveLevel | null> = {
  overall: null,
  secondary: 'overall',
  tertiary: 'secondary',
};
const VALID_DOMAINS: KaqObjectiveDomain[] = ['knowledge', 'capability', 'quality'];
const VALID_LEVELS: KaqObjectiveLevel[] = ['overall', 'secondary', 'tertiary'];

const LEGACY_COMPETENCY_TO_PORTRAIT_V2: Record<CompetencyDimension, PortraitV2DimensionMapping> = {
  controlModeling: mapping('controlModeling', ['controlModelingRepresentation', 'systemAnalysisInterpretation'], 'high', [
    'Legacy controlModeling combines representation and analysis; downstream consumers should keep the original score alongside the derived dimensions.',
  ]),
  parameterDesign: mapping('parameterDesign', ['controllerDesignSynthesis'], 'high', []),
  crossDomainTransfer: mapping('crossDomainTransfer', ['transferIntegratedApplication'], 'high', []),
  engineeringDecision: mapping('engineeringDecision', ['engineeringConstraintSafety'], 'high', []),
  inquiryReflection: mapping('inquiryReflection', ['reflectionImprovementAiCollab'], 'high', []),
  selfDirectedLearning: mapping('selfDirectedLearning', ['reflectionImprovementAiCollab'], 'medium', [
    'Self-directed learning only partially represents reflection and AI collaboration quality.',
  ]),
};

const SECONDARY_TO_LEGACY_COMPETENCY: Record<AdaptiveLearnerSecondaryDimension, CompetencyDimension> = {
  conceptMastery: 'controlModeling',
  timeFrequencyTransfer: 'crossDomainTransfer',
  modelingReliability: 'controlModeling',
  tuningEfficiency: 'parameterDesign',
  constrainedOptimization: 'parameterDesign',
  solutionStability: 'engineeringDecision',
  crossModalTransfer: 'crossDomainTransfer',
  scenarioGeneralization: 'crossDomainTransfer',
  riskRecognition: 'engineeringDecision',
  constraintCompliance: 'engineeringDecision',
  explanationQuality: 'inquiryReflection',
  aiUseStrategy: 'inquiryReflection',
  reflectionDepth: 'inquiryReflection',
  pathExecution: 'selfDirectedLearning',
  persistence: 'selfDirectedLearning',
  remedialInitiative: 'selfDirectedLearning',
};

const GOAL_SLICE_TO_PORTRAIT_V2: Record<ControlCorrectionDimensionId, PortraitV2DimensionMapping> = {
  'time-domain-analysis': mapping('time-domain-analysis', ['systemAnalysisInterpretation'], 'high', []),
  'root-locus-reasoning': mapping('root-locus-reasoning', ['systemAnalysisInterpretation', 'controllerDesignSynthesis'], 'high', [
    'Root-locus reasoning carries both analysis and design intent; consumers should not double-count it as two independent scores.',
  ]),
  'frequency-domain-margin-analysis': mapping('frequency-domain-margin-analysis', ['systemAnalysisInterpretation'], 'high', []),
  'method-selection': mapping('method-selection', ['controllerDesignSynthesis'], 'high', []),
  'constraint-tradeoff': mapping('constraint-tradeoff', ['engineeringConstraintSafety'], 'high', []),
  'simulation-validation': mapping('simulation-validation', ['simulationValidationEvidence'], 'high', []),
  'arena-transfer': mapping('arena-transfer', ['transferIntegratedApplication'], 'high', []),
  reflection: mapping('reflection', ['reflectionImprovementAiCollab'], 'high', []),
  'ai-collaboration': mapping('ai-collaboration', ['reflectionImprovementAiCollab'], 'high', []),
};

export function validateKaqObjectiveCatalog(
  input: KaqObjective[] | KaqObjectiveSeedCatalog,
): KaqObjectiveValidationResult {
  const objectives = Array.isArray(input)
    ? input
    : [...input.knowledge, ...input.capability, ...input.quality];
  const issues: KaqObjectiveValidationIssue[] = [];
  const byId = new Map<string, KaqObjective>();
  const seen = new Set<string>();

  for (const objective of objectives) {
    if (!objective.id) {
      issues.push(issue('missing-id', null, 'Objective id is required.'));
      continue;
    }
    if (!isNonEmptyString(objective.id)) {
      issues.push(issue('invalid-id', null, 'Objective id must be a non-empty string.'));
      continue;
    }
    if (seen.has(objective.id)) {
      issues.push(issue('duplicate-id', objective.id, 'Objective id must be unique across the K/A/Q catalog.'));
    }
    seen.add(objective.id);
    byId.set(objective.id, objective);
  }

  for (const objective of objectives) {
    validateObjectiveShape(objective, issues);
    validateObjectiveParent(objective, byId, issues);
  }

  return {
    valid: issues.length === 0,
    issues,
  };
}

export function mapLegacyCompetencyDimensionToPortraitV2(
  dimension: CompetencyDimension | string,
): PortraitV2DimensionMapping {
  if (PORTRAIT_V2_DIMENSION_SET.has(dimension)) {
    return {
      sourceDimension: String(dimension),
      targetDimensions: [dimension as PortraitV2DimensionId],
      confidence: 'high',
      limitations: [],
    };
  }
  return LEGACY_COMPETENCY_TO_PORTRAIT_V2[dimension as CompetencyDimension] ?? unknownMapping(dimension);
}

export function mapSecondaryLearnerStateDimensionToPortraitV2(
  dimension: AdaptiveLearnerSecondaryDimension | string,
): PortraitV2DimensionMapping {
  const legacyDimension = SECONDARY_TO_LEGACY_COMPETENCY[dimension as AdaptiveLearnerSecondaryDimension];
  if (!legacyDimension) return unknownMapping(dimension);
  const mapped = mapLegacyCompetencyDimensionToPortraitV2(legacyDimension);
  return {
    ...mapped,
    sourceDimension: String(dimension),
    confidence: mapped.confidence === 'high' ? 'medium' : mapped.confidence,
    limitations: [
      ...mapped.limitations,
      'Secondary learner-state dimensions are derived from primary competencies and governed evidence, not independent portrait v2 measurements.',
    ],
  };
}

export function mapAdaptiveGoalSliceDimensionToPortraitV2(
  dimension: ControlCorrectionDimensionId | string,
): PortraitV2DimensionMapping {
  return GOAL_SLICE_TO_PORTRAIT_V2[dimension as ControlCorrectionDimensionId] ?? unknownMapping(dimension);
}

export function preserveSixDimensionalCompetencyVector<T extends CompetencyVector | null | undefined>(vector: T): T {
  return vector;
}

function validateObjectiveShape(
  objective: KaqObjective,
  issues: KaqObjectiveValidationIssue[],
): void {
  if (!objective.title || typeof objective.title !== 'string') {
    issues.push(issue('missing-title', objective.id, 'Objective title is required.'));
  }

  if (!objective.description || typeof objective.description !== 'string') {
    issues.push(issue('missing-description', objective.id, 'Objective description is required.'));
  }

  if (!Object.hasOwn(objective, 'parentId')) {
    issues.push(issue('missing-parent-id', objective.id, 'Objective must explicitly declare parentId as an id or null.'));
  }

  if (!VALID_DOMAINS.includes(objective.domain)) {
    issues.push(issue('invalid-domain', objective.id, 'Objective domain must be knowledge, capability, or quality.'));
  }

  if (!VALID_LEVELS.includes(objective.level)) {
    issues.push(issue('invalid-level', objective.id, 'Objective level must be overall, secondary, or tertiary.'));
  }

  if (!['draft', 'active', 'deprecated'].includes(objective.status)) {
    issues.push(issue('invalid-status', objective.id, 'Objective status must be draft, active, or deprecated.'));
  }

  if (!Array.isArray(objective.portraitDimensions) || objective.portraitDimensions.length === 0) {
    issues.push(issue('missing-portrait-dimension', objective.id, 'Objective must map to at least one portrait v2 dimension.'));
  } else {
    for (const dimension of objective.portraitDimensions) {
      if (!PORTRAIT_V2_DIMENSION_SET.has(dimension)) {
        issues.push(issue('invalid-portrait-dimension', objective.id, `Unknown portrait v2 dimension: ${dimension}.`));
      }
    }
  }

  if (!objective.evidencePolicy) {
    issues.push(issue('missing-evidence-policy', objective.id, 'Objective must declare an evidence policy.'));
  } else {
    const evidencePolicy = objective.evidencePolicy;
    const hasValidEvidencePolicy =
      Array.isArray(evidencePolicy.requiredFamilies) &&
      evidencePolicy.requiredFamilies.length > 0 &&
      Number.isFinite(evidencePolicy.minimumEvidenceCount) &&
      evidencePolicy.minimumEvidenceCount >= 1 &&
      Number.isFinite(evidencePolicy.confidenceFloor) &&
      evidencePolicy.confidenceFloor >= 0 &&
      evidencePolicy.confidenceFloor <= 1;

    if (!hasValidEvidencePolicy) {
      issues.push(issue('invalid-evidence-policy', objective.id, 'Evidence policy must declare families, count, and a 0-1 confidence floor.'));
    }
  }

  if (!objective.graphBinding) {
    issues.push(issue('missing-graph-binding', objective.id, 'Objective must declare a graph binding policy.'));
  } else {
    const graphBinding = objective.graphBinding;
    const hasValidGraphBinding =
      typeof graphBinding.required === 'boolean' &&
      Array.isArray(graphBinding.nodeKinds) &&
      Array.isArray(graphBinding.bindingRefs) &&
      (!graphBinding.required || (graphBinding.nodeKinds.length > 0 && graphBinding.bindingRefs.length > 0));

    if (!hasValidGraphBinding) {
      issues.push(issue('invalid-graph-binding', objective.id, 'Required graph binding must declare node kinds and binding refs.'));
    }
  }
}

function validateObjectiveParent(
  objective: KaqObjective,
  byId: Map<string, KaqObjective>,
  issues: KaqObjectiveValidationIssue[],
): void {
  if (!VALID_LEVELS.includes(objective.level)) return;

  const expectedParentLevel = EXPECTED_PARENT_LEVEL[objective.level];
  if (!expectedParentLevel) {
    if (Object.hasOwn(objective, 'parentId') && objective.parentId !== null) {
      issues.push(issue('invalid-level-parent', objective.id, 'Overall objective must not declare a parent.'));
    }
    return;
  }

  if (!objective.parentId) {
    issues.push(issue('invalid-parent', objective.id, `${objective.level} objective must declare a parent.`));
    return;
  }

  const parent = byId.get(objective.parentId);
  if (!parent) {
    issues.push(issue('invalid-parent', objective.id, `Parent objective does not exist: ${objective.parentId}.`));
    return;
  }

  if (parent.level !== expectedParentLevel) {
    issues.push(issue('invalid-level-parent', objective.id, `${objective.level} objective parent must be ${expectedParentLevel}.`));
  }

  if (parent.domain !== objective.domain) {
    issues.push(issue('domain-mismatch', objective.id, 'Objective parent must be in the same K/A/Q domain.'));
  }
}

function issue(
  code: KaqObjectiveValidationIssueCode,
  objectiveId: string | null,
  message: string,
): KaqObjectiveValidationIssue {
  return { code, objectiveId, message };
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function mapping(
  sourceDimension: string,
  targetDimensions: PortraitV2DimensionId[],
  confidence: PortraitV2MappingConfidence,
  limitations: string[],
): PortraitV2DimensionMapping {
  return { sourceDimension, targetDimensions, confidence, limitations };
}

function unknownMapping(sourceDimension: string): PortraitV2DimensionMapping {
  return mapping(String(sourceDimension), [], 'none', ['No explicit portrait v2 mapping is registered for this dimension.']);
}
