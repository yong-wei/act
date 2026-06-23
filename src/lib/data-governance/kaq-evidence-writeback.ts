import type { KaqArtifactVersionRefs } from '../kaq-artifact-versioning';
import { detectKaqArtifactStaleness, validateKaqArtifactVersionRefs } from '../kaq-artifact-versioning';
import {
  AUTOCONTROL_KAQ_GRAPH_CATALOG,
  AUTOCONTROL_KAQ_OBJECTIVE_CATALOG,
} from './autocontrol-kaq-graph-catalog';
import type { KaqGraphNode } from './kaq-graph-schema';
import type { KaqObjective, KaqObjectiveDomain } from './kaq-objective-taxonomy';

export type KaqEvidenceSourceClass =
  | 'instructional-checkpoint'
  | 'path-execution'
  | 'simulation-preview'
  | 'simulation-validation'
  | 'arena-preview'
  | 'arena-official'
  | 'konling-intervention'
  | 'teacher-approved-grading';

export type KaqEvidenceAuthorityLevel =
  | 'preview'
  | 'official'
  | 'teacher-approved'
  | 'ai-mediated'
  | 'governed';

export type KaqEvidencePrivacyScope = 'student' | 'teacher' | 'admin' | 'service';
export type KaqEvidenceWritebackStatus = 'accepted' | 'degraded' | 'blocked';

export type KaqEvidenceLimitationCode =
  | 'missing-target-binding'
  | 'missing-learning-goal-boundary'
  | 'missing-subject-owner'
  | 'subject-owner-mismatch'
  | 'unknown-objective-id'
  | 'unknown-graph-node-id'
  | 'objective-domain-mismatch'
  | 'graph-node-domain-mismatch'
  | 'target-objective-node-mismatch'
  | 'missing-version-ref'
  | 'preview-not-terminal-validation'
  | 'ai-mediated-low-authority'
  | 'source-not-terminal-validation-authority'
  | 'low-confidence-terminal-validation'
  | 'missing-source-ref'
  | 'unverified-resource-node-id';

export interface KaqEvidenceSourceRef {
  kind: string;
  id: string;
}

export interface KaqEvidenceWritebackSource {
  sourceClass: KaqEvidenceSourceClass;
  sourceId: string;
  sourceRef: KaqEvidenceSourceRef;
  official: boolean;
  teacherApproved: boolean;
  aiGenerated: boolean;
  citationRefs?: string[];
}

export interface KaqEvidenceWritebackActor {
  type: 'student' | 'teacher' | 'admin' | 'service';
  id: string;
}

export interface KaqEvidenceSubjectScope {
  ownerUserId: string;
  studentId?: string | null;
  classId?: string | null;
}

export interface KaqEvidenceWindow {
  from: string | null;
  to: string | null;
}

export interface KaqEvidenceContributionInput {
  domain: KaqObjectiveDomain;
  objectiveId?: string | null;
  graphNodeId?: string | null;
  learningGoalId?: string | null;
  resourceNodeId?: string | null;
  confidence: number;
  terminalValidationCandidate: boolean;
  limitationCodes?: KaqEvidenceLimitationCode[];
}

export interface KaqEvidenceWritebackInput {
  id: string;
  source: KaqEvidenceWritebackSource;
  subject: KaqEvidenceSubjectScope;
  actor: KaqEvidenceWritebackActor;
  privacyScope: KaqEvidencePrivacyScope;
  materializedAt: string;
  evidenceWindow: KaqEvidenceWindow;
  versionRefs: KaqArtifactVersionRefs | null;
  resourceTargetRegistry?: KaqEvidenceResourceTargetRegistry | null;
  contributions: KaqEvidenceContributionInput[];
}

export interface KaqEvidenceTargetRef {
  objectiveId: string | null;
  graphNodeId: string | null;
  learningGoalId: string | null;
  resourceNodeId: string | null;
}

export interface KaqEvidenceOverlayUpdate {
  id: string;
  domain: KaqObjectiveDomain;
  sourceClass: KaqEvidenceSourceClass;
  sourceId: string | null;
  sourceRef: KaqEvidenceSourceRef | null;
  citationRefs: string[] | null;
  targetRef: KaqEvidenceTargetRef;
  subject: KaqEvidenceSubjectScope;
  confidence: number;
  authorityLevel: KaqEvidenceAuthorityLevel;
  terminalValidationAccepted: boolean;
  evidenceWindow: KaqEvidenceWindow;
  limitationCodes: string[];
  aiGenerated: boolean;
  teacherApproved: boolean;
  materializedAt: string;
}

export interface KaqEvidenceWritebackAuditEvent {
  eventType: 'kaq-evidence-writeback.materialized';
  writebackId: string;
  sourceClass: KaqEvidenceSourceClass;
  sourceId: string | null;
  sourceRef: KaqEvidenceSourceRef | null;
  citationRefs: string[] | null;
  targetRefs: KaqEvidenceTargetRef[];
  subject: KaqEvidenceSubjectScope;
  versionRefs: KaqArtifactVersionRefs | null;
  confidence: number | null;
  limitationCodes: string[];
  actor: KaqEvidenceWritebackActor;
  privacyScope: KaqEvidencePrivacyScope;
  materializedAt: string;
  aiGenerated: boolean;
  teacherApproved: boolean;
  status: KaqEvidenceWritebackStatus;
}

export interface KaqEvidenceWritebackResult {
  id: string;
  status: KaqEvidenceWritebackStatus;
  overlayUpdates: KaqEvidenceOverlayUpdate[];
  audit: KaqEvidenceWritebackAuditEvent;
}

export interface KaqEvidenceWritebackProjection {
  id: string;
  status: KaqEvidenceWritebackStatus;
  overlayUpdates: KaqEvidenceOverlayUpdate[];
  audit: KaqEvidenceWritebackAuditEvent | null;
}

export interface KaqEvidenceResourceTargetRegistry {
  nodes: Array<{ id: string }>;
}

const PREVIEW_SOURCE_CLASSES = new Set<KaqEvidenceSourceClass>([
  'simulation-preview',
  'arena-preview',
]);

const REQUIRED_VERSION_REFS: Array<keyof KaqArtifactVersionRefs> = [
  'learningGoalPackageVersion',
  'objectiveCatalogVersion',
  'graphCatalogVersion',
  'overlayVersion',
];
const RESOURCE_TARGET_VERSION_REFS: Array<keyof KaqArtifactVersionRefs> = [
  'resourceRegistryVersion',
  'resourceProjectionVersion',
];
const TERMINAL_VALIDATION_CONFIDENCE_THRESHOLD = 0.6;

const SOURCE_VERSION_REFS: Partial<Record<KaqEvidenceSourceClass, Array<keyof KaqArtifactVersionRefs>>> = {
  'path-execution': ['plannerVersion'],
  'konling-intervention': ['groundingVersion'],
};

const AUTOCONTROL_OBJECTIVES: KaqObjective[] = [
  ...AUTOCONTROL_KAQ_OBJECTIVE_CATALOG.knowledge,
  ...AUTOCONTROL_KAQ_OBJECTIVE_CATALOG.capability,
  ...AUTOCONTROL_KAQ_OBJECTIVE_CATALOG.quality,
];
const AUTOCONTROL_OBJECTIVES_BY_ID = new Map(AUTOCONTROL_OBJECTIVES.map((objective) => [objective.id, objective]));
const AUTOCONTROL_GRAPH_NODES_BY_ID = new Map(
  AUTOCONTROL_KAQ_GRAPH_CATALOG.nodes.map((node) => [node.id, node] as const),
);

export function materializeKaqEvidenceWriteback(input: KaqEvidenceWritebackInput): KaqEvidenceWritebackResult {
  const versionLimitations = validateRequiredVersionRefs(input);
  const sourceLimitations = validateSource(input.source);
  const subjectLimitations = validateSubject(input.subject);
  const authorityLevel = resolveAuthorityLevel(input.source);
  const isPreview = authorityLevel === 'preview';
  const contributionEvaluations = input.contributions.map((contribution) => ({
    contribution,
    limitationCodes: uniqueSorted([
      ...validateTargetBinding(contribution),
      ...validateCatalogTarget(contribution),
      ...validateResourceTargetVersionRefs(input, contribution),
      ...validateResourceTarget(contribution, input.resourceTargetRegistry),
      ...(contribution.limitationCodes ?? []),
      ...(isPreview && contribution.terminalValidationCandidate ? ['preview-not-terminal-validation' as const] : []),
      ...(input.source.aiGenerated && !input.source.teacherApproved ? ['ai-mediated-low-authority' as const] : []),
      ...(!isPreview && contribution.terminalValidationCandidate && !canSourceSatisfyTerminalValidation(input.source)
        ? ['source-not-terminal-validation-authority' as const]
        : []),
      ...(contribution.terminalValidationCandidate && clampConfidence(contribution.confidence) < TERMINAL_VALIDATION_CONFIDENCE_THRESHOLD
        ? ['low-confidence-terminal-validation' as const]
        : []),
    ]),
  }));
  const globalBlocking = (versionLimitations.some(isBlockingVersionLimitation) && input.source.official)
    || sourceLimitations.length > 0
    || subjectLimitations.length > 0;
  const overlayUpdates = globalBlocking
    ? []
    : contributionEvaluations
      .map(({ contribution, limitationCodes }, index) => materializeContribution(
        input,
        contribution,
        uniqueSorted([...versionLimitations, ...limitationCodes]),
        index,
        authorityLevel,
      ))
      .filter((update): update is KaqEvidenceOverlayUpdate => Boolean(update));
  const limitationCodes = uniqueSorted([
    ...versionLimitations,
    ...sourceLimitations,
    ...subjectLimitations,
    ...contributionEvaluations.flatMap((evaluation) => evaluation.limitationCodes),
  ]);
  const status = resolveStatus(globalBlocking, overlayUpdates, limitationCodes);

  return {
    id: input.id,
    status,
    overlayUpdates: status === 'blocked' ? [] : overlayUpdates,
    audit: {
      eventType: 'kaq-evidence-writeback.materialized',
      writebackId: input.id,
      sourceClass: input.source.sourceClass,
      sourceId: input.source.sourceId,
      sourceRef: input.source.sourceRef,
      citationRefs: input.source.citationRefs ?? null,
      targetRefs: input.contributions.map(toTargetRef),
      subject: input.subject,
      versionRefs: input.versionRefs,
      confidence: averageConfidence(input.contributions),
      limitationCodes,
      actor: input.actor,
      privacyScope: input.privacyScope,
      materializedAt: input.materializedAt,
      aiGenerated: input.source.aiGenerated,
      teacherApproved: input.source.teacherApproved,
      status,
    },
  };
}

export function projectKaqEvidenceWritebackForConsumer(
  result: KaqEvidenceWritebackResult,
  consumer: KaqEvidencePrivacyScope,
): KaqEvidenceWritebackProjection {
  return {
    id: result.id,
    status: result.status,
    overlayUpdates: result.overlayUpdates.map((update) => ({
      ...update,
      sourceRef: consumer === 'student' || consumer === 'teacher' ? null : update.sourceRef,
      sourceId: consumer === 'student' || consumer === 'teacher' ? null : update.sourceId,
      citationRefs: consumer === 'student' || consumer === 'teacher' ? null : update.citationRefs,
    })),
    audit: projectAudit(result.audit, consumer),
  };
}

export function buildPathExecutionWritebackInput(input: {
  id: string;
  executionId: string;
  subject: KaqEvidenceSubjectScope;
  learningGoalId: string;
  terminalObjectiveId: string;
  terminalGraphNodeId: string;
  outcome: 'completed' | 'deviated' | 'fallback';
  score: number;
  versionRefs: KaqArtifactVersionRefs;
  materializedAt: string;
}): KaqEvidenceWritebackInput {
  return {
    id: input.id,
    source: {
      sourceClass: 'path-execution',
      sourceId: input.executionId,
      sourceRef: { kind: 'LearningPathExecution', id: input.executionId },
      official: true,
      teacherApproved: false,
      aiGenerated: false,
    },
    subject: input.subject,
    actor: { type: 'service', id: 'adaptive-path-execution' },
    privacyScope: 'service',
    materializedAt: input.materializedAt,
    evidenceWindow: { from: null, to: input.materializedAt },
    versionRefs: input.versionRefs,
    contributions: String(input.outcome) === 'selected'
      ? []
      : [
        {
          domain: 'capability',
          objectiveId: input.terminalObjectiveId,
          graphNodeId: input.terminalGraphNodeId,
          learningGoalId: input.learningGoalId,
          confidence: clampConfidence(input.score),
          terminalValidationCandidate: input.outcome === 'completed',
        },
      ],
  };
}

export function buildKonlingInterventionWritebackInput(input: {
  id: string;
  toolRunId: string;
  subject: KaqEvidenceSubjectScope;
  learningGoalId: string;
  qualityObjectiveId: string;
  graphNodeId: string;
  accepted: boolean;
  citationRefs?: string[];
  versionRefs: KaqArtifactVersionRefs;
  materializedAt: string;
}): KaqEvidenceWritebackInput {
  return {
    id: input.id,
    source: {
      sourceClass: 'konling-intervention',
      sourceId: input.toolRunId,
      sourceRef: { kind: 'AgentToolRun', id: input.toolRunId },
      official: false,
      teacherApproved: false,
      aiGenerated: true,
      citationRefs: input.citationRefs,
    },
    subject: input.subject,
    actor: { type: 'service', id: 'konling-runtime' },
    privacyScope: 'student',
    materializedAt: input.materializedAt,
    evidenceWindow: { from: null, to: input.materializedAt },
    versionRefs: input.versionRefs,
    contributions: [
      {
        domain: 'quality',
        objectiveId: input.qualityObjectiveId,
        graphNodeId: input.graphNodeId,
        learningGoalId: input.learningGoalId,
        confidence: input.accepted ? 0.58 : 0.35,
        terminalValidationCandidate: false,
      },
    ],
  };
}

export function buildTeacherApprovedGradingWritebackInput(input: {
  id: string;
  gradingRunId: string;
  subject: KaqEvidenceSubjectScope;
  teacherId: string;
  learningGoalId: string;
  objectiveId: string;
  graphNodeId: string;
  score: number;
  versionRefs: KaqArtifactVersionRefs;
  materializedAt: string;
}): KaqEvidenceWritebackInput {
  return {
    id: input.id,
    source: {
      sourceClass: 'teacher-approved-grading',
      sourceId: input.gradingRunId,
      sourceRef: { kind: 'DocumentRubricGrading', id: input.gradingRunId },
      official: true,
      teacherApproved: true,
      aiGenerated: false,
    },
    subject: input.subject,
    actor: { type: 'teacher', id: input.teacherId },
    privacyScope: 'teacher',
    materializedAt: input.materializedAt,
    evidenceWindow: { from: null, to: input.materializedAt },
    versionRefs: input.versionRefs,
    contributions: [
      {
        domain: inferDomainFromObjectiveId(input.objectiveId),
        objectiveId: input.objectiveId,
        graphNodeId: input.graphNodeId,
        learningGoalId: input.learningGoalId,
        confidence: clampConfidence(input.score),
        terminalValidationCandidate: clampConfidence(input.score) >= TERMINAL_VALIDATION_CONFIDENCE_THRESHOLD,
      },
    ],
  };
}

function materializeContribution(
  input: KaqEvidenceWritebackInput,
  contribution: KaqEvidenceContributionInput,
  limitationCodes: string[],
  index: number,
  authorityLevel: KaqEvidenceAuthorityLevel,
): KaqEvidenceOverlayUpdate | null {
  if (isBlockingContribution(limitationCodes)) return null;
  const terminalValidationAccepted = contribution.terminalValidationCandidate
    && canSourceSatisfyTerminalValidation(input.source)
    && authorityLevel !== 'preview'
    && (!input.source.aiGenerated || input.source.teacherApproved)
    && limitationCodes.length === 0;

  return {
    id: `${input.id}:${index + 1}`,
    domain: contribution.domain,
    sourceClass: input.source.sourceClass,
    sourceId: input.source.sourceId,
    sourceRef: input.source.sourceRef,
    citationRefs: input.source.citationRefs ?? null,
    targetRef: toTargetRef(contribution),
    subject: input.subject,
    confidence: resolveConfidence(contribution.confidence, authorityLevel, limitationCodes),
    authorityLevel,
    terminalValidationAccepted,
    evidenceWindow: input.evidenceWindow,
    limitationCodes,
    aiGenerated: input.source.aiGenerated,
    teacherApproved: input.source.teacherApproved,
    materializedAt: input.materializedAt,
  };
}

function validateRequiredVersionRefs(input: KaqEvidenceWritebackInput): string[] {
  const requiredRefs = uniqueSorted([
    ...REQUIRED_VERSION_REFS,
    ...(SOURCE_VERSION_REFS[input.source.sourceClass] ?? []),
    ...(input.source.citationRefs?.length ? ['citationVersion' as keyof KaqArtifactVersionRefs] : []),
  ]);
  return [
    ...validateKaqArtifactVersionRefs(input.versionRefs, requiredRefs),
    ...(input.versionRefs ? detectKaqArtifactStaleness(input.versionRefs)
      .filter((limitation) => requiredRefs.includes(limitation.ref)) : []),
  ]
    .map((limitation) => `${limitation.code}:${limitation.ref}`);
}

function validateResourceTargetVersionRefs(
  input: KaqEvidenceWritebackInput,
  contribution: KaqEvidenceContributionInput,
): string[] {
  if (!normalizeOptionalId(contribution.resourceNodeId)) return [];
  return [
    ...validateKaqArtifactVersionRefs(input.versionRefs, RESOURCE_TARGET_VERSION_REFS),
    ...(input.versionRefs ? detectKaqArtifactStaleness(input.versionRefs)
      .filter((limitation) => RESOURCE_TARGET_VERSION_REFS.includes(limitation.ref)) : []),
  ]
    .map((limitation) => `${limitation.code}:${limitation.ref}`);
}

function validateTargetBinding(contribution: KaqEvidenceContributionInput): KaqEvidenceLimitationCode[] {
  return [
    ...(!normalizeOptionalId(contribution.objectiveId) && !normalizeOptionalId(contribution.graphNodeId)
      ? ['missing-target-binding' as const]
      : []),
    ...(!normalizeOptionalId(contribution.learningGoalId) ? ['missing-learning-goal-boundary' as const] : []),
  ];
}

function validateSubject(subject: KaqEvidenceSubjectScope): KaqEvidenceLimitationCode[] {
  const ownerUserId = typeof subject.ownerUserId === 'string' ? subject.ownerUserId.trim() : '';
  const studentId = typeof subject.studentId === 'string' ? subject.studentId.trim() : '';
  return [
    ...(ownerUserId.length > 0 ? [] : ['missing-subject-owner' as const]),
    ...(studentId && studentId !== ownerUserId ? ['subject-owner-mismatch' as const] : []),
  ];
}

function validateSource(source: KaqEvidenceWritebackSource): KaqEvidenceLimitationCode[] {
  const sourceId = typeof source.sourceId === 'string' ? source.sourceId.trim() : '';
  const sourceRefKind = typeof source.sourceRef?.kind === 'string' ? source.sourceRef.kind.trim() : '';
  const sourceRefId = typeof source.sourceRef?.id === 'string' ? source.sourceRef.id.trim() : '';
  return sourceId && sourceRefKind && sourceRefId ? [] : ['missing-source-ref'];
}

function validateCatalogTarget(contribution: KaqEvidenceContributionInput): KaqEvidenceLimitationCode[] {
  const objectiveId = normalizeOptionalId(contribution.objectiveId);
  const graphNodeId = normalizeOptionalId(contribution.graphNodeId);
  const objective = objectiveId
    ? AUTOCONTROL_OBJECTIVES_BY_ID.get(objectiveId)
    : null;
  const graphNode = graphNodeId
    ? AUTOCONTROL_GRAPH_NODES_BY_ID.get(graphNodeId)
    : null;
  const limitations: KaqEvidenceLimitationCode[] = [];
  if (objectiveId && !objective) limitations.push('unknown-objective-id');
  if (graphNodeId && !graphNode) limitations.push('unknown-graph-node-id');
  if (objective && objective.domain !== contribution.domain) limitations.push('objective-domain-mismatch');
  if (graphNode && graphNode.domain !== contribution.domain) limitations.push('graph-node-domain-mismatch');
  if (objective && graphNode && !graphNodeSupportsObjective(graphNode, objective)) {
    limitations.push('target-objective-node-mismatch');
  }
  return limitations;
}

function validateResourceTarget(
  contribution: KaqEvidenceContributionInput,
  registry: KaqEvidenceResourceTargetRegistry | null | undefined,
): KaqEvidenceLimitationCode[] {
  const resourceNodeId = normalizeOptionalId(contribution.resourceNodeId);
  if (!resourceNodeId) return [];
  const verifiedNodeIds = new Set((registry?.nodes ?? []).map((node) => node.id));
  return verifiedNodeIds.has(resourceNodeId) ? [] : ['unverified-resource-node-id'];
}

function graphNodeSupportsObjective(graphNode: KaqGraphNode, objective: KaqObjective): boolean {
  return graphNode.objectiveIds.includes(objective.id)
    || Boolean(objective.graphBinding?.bindingRefs.includes(graphNode.id));
}

function isBlockingContribution(limitationCodes: string[]): boolean {
  return limitationCodes.some((code) => [
    'missing-target-binding',
    'missing-learning-goal-boundary',
    'unknown-objective-id',
    'unknown-graph-node-id',
    'objective-domain-mismatch',
    'graph-node-domain-mismatch',
    'target-objective-node-mismatch',
    'missing-version-ref:resourceRegistryVersion',
    'missing-version-ref:resourceProjectionVersion',
    'unverified-resource-node-id',
  ].includes(code));
}

function isBlockingVersionLimitation(limitationCode: string): boolean {
  return limitationCode.startsWith('missing-version-ref:');
}

function resolveAuthorityLevel(source: KaqEvidenceWritebackSource): KaqEvidenceAuthorityLevel {
  if (PREVIEW_SOURCE_CLASSES.has(source.sourceClass)) return 'preview';
  if (source.teacherApproved) return 'teacher-approved';
  if (source.sourceClass === 'konling-intervention') return 'ai-mediated';
  if (source.official) return 'official';
  return 'governed';
}

function canSourceSatisfyTerminalValidation(source: KaqEvidenceWritebackSource): boolean {
  if (source.sourceClass === 'arena-official') return source.official;
  if (source.sourceClass === 'simulation-validation') return source.official;
  if (source.sourceClass === 'teacher-approved-grading') return source.teacherApproved;
  if (source.sourceClass === 'instructional-checkpoint') return source.teacherApproved;
  return false;
}

function resolveConfidence(
  confidence: number,
  authorityLevel: KaqEvidenceAuthorityLevel,
  limitationCodes: string[],
): number {
  const base = clampConfidence(confidence);
  const caps = [
    authorityLevel === 'preview' ? 0.4 : 1,
    authorityLevel === 'ai-mediated' ? 0.65 : 1,
    limitationCodes.length > 0 ? 0.6 : 1,
  ];
  return round(Math.min(base, ...caps));
}

function resolveStatus(
  globalBlocking: boolean,
  overlayUpdates: KaqEvidenceOverlayUpdate[],
  limitationCodes: string[],
): KaqEvidenceWritebackStatus {
  if (globalBlocking || overlayUpdates.length === 0) return 'blocked';
  if (limitationCodes.length > 0) return 'degraded';
  return 'accepted';
}

function projectAudit(
  audit: KaqEvidenceWritebackAuditEvent,
  consumer: KaqEvidencePrivacyScope,
): KaqEvidenceWritebackAuditEvent | null {
  if (consumer === 'student') return null;
  if (consumer === 'teacher') {
    return {
      ...audit,
      sourceId: null,
      sourceRef: null,
      citationRefs: null,
      actor: { type: audit.actor.type, id: 'redacted' },
    };
  }
  return audit;
}

function toTargetRef(contribution: KaqEvidenceContributionInput): KaqEvidenceTargetRef {
  return {
    objectiveId: normalizeOptionalId(contribution.objectiveId),
    graphNodeId: normalizeOptionalId(contribution.graphNodeId),
    learningGoalId: normalizeOptionalId(contribution.learningGoalId),
    resourceNodeId: normalizeOptionalId(contribution.resourceNodeId),
  };
}

function averageConfidence(contributions: KaqEvidenceContributionInput[]): number | null {
  if (contributions.length === 0) return null;
  return round(contributions.reduce((sum, contribution) => sum + clampConfidence(contribution.confidence), 0) / contributions.length);
}

function inferDomainFromObjectiveId(objectiveId: string): KaqObjectiveDomain {
  if (objectiveId.startsWith('knowledge:')) return 'knowledge';
  if (objectiveId.startsWith('capability:')) return 'capability';
  return 'quality';
}

function clampConfidence(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

function normalizeOptionalId(value: string | null | undefined): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function uniqueSorted<T extends string>(items: T[]): T[] {
  return Array.from(new Set(items)).sort();
}

function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}
