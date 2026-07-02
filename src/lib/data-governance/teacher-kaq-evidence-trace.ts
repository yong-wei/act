import type {
  GraphCenterDomain,
  GraphCenterPayload,
  GraphCenterResourceCoverageMissingType,
  GraphCenterSelectedNodeDetail,
} from './graph-center';
import type { PortraitV2DimensionId } from './kaq-objective-taxonomy';

export interface TeacherKaqEvidenceTraceClassInfo {
  id: string;
  name: string;
  code?: string | null;
}

export interface TeacherKaqEvidenceTraceStudentInfo {
  id: string;
  name: string;
  studentNumber?: string | null;
}

export interface TeacherKaqEvidenceTraceQuery {
  domain?: GraphCenterDomain;
  objectiveId?: string | null;
  portraitDimension?: PortraitV2DimensionId | null;
  nodeId?: string | null;
  studentId?: string | null;
}

export interface TeacherKaqEvidenceTracePayload {
  classInfo: TeacherKaqEvidenceTraceClassInfo;
  student: TeacherKaqEvidenceTraceStudentInfo | null;
  selection: {
    domain: GraphCenterDomain;
    objectiveId: string | null;
    portraitDimension: PortraitV2DimensionId | null;
    requestedNodeId: string | null;
    nodeFound: boolean;
  };
  node: {
    id: string;
    title: string;
    domain: GraphCenterDomain;
    description: string;
    objectiveIds: string[];
    objectives: Array<{
      id: string;
      title: string;
      level: string;
    }>;
    portraitDimensions: PortraitV2DimensionId[];
  } | null;
  sarTrace: {
    status: 'available' | 'unavailable';
    eventCount: number;
    topEvents: Array<{
      id: string;
      title: string;
      safeSummary: string;
      authorityLevel: string;
      privacyScope: string;
    }>;
    candidateRefs: {
      eventCount: number;
      entityCount: number;
      resourceNodeCount: number;
      retrievalChunkCount: number;
      citationTargetCount: number;
      planningUnitCount: number;
    };
    selectedRefCount: number;
    rejectedRefCount: number;
    expansionHopCount: number;
    limitations: string[];
  };
  evidenceCounts: {
    classStudentCount: number | null;
    classIncludedPopulation: number | null;
    classExcludedPopulation: number | null;
    studentEvidenceCount: number | null;
  };
  resourceGaps: Array<{
    type: GraphCenterResourceCoverageMissingType;
    label: string;
  }>;
  candidateResources: Array<{
    id: string;
    refType: string;
    ref: string;
    label: string;
    suggestedFor: string[];
    reason: string;
  }>;
  limitations: string[];
  returnLinks: Array<{
    id: string;
    label: string;
    href: string;
  }>;
}

export function createTeacherKaqEvidenceTracePayload(input: {
  classInfo: TeacherKaqEvidenceTraceClassInfo;
  student?: TeacherKaqEvidenceTraceStudentInfo | null;
  graphPayload: GraphCenterPayload;
  query?: TeacherKaqEvidenceTraceQuery;
}): TeacherKaqEvidenceTracePayload {
  const selectedNode = input.graphPayload.selectedNode;
  const requestedNodeId = normalizeOptionalId(input.query?.nodeId);
  const nodeFound = Boolean(selectedNode && (!requestedNodeId || selectedNode.node.id === requestedNodeId));
  const safeNode = nodeFound ? selectedNode : null;
  const associated = safeNode?.associatedEvidence ?? null;
  const classOverlayItem = safeNode ? input.graphPayload.classOverlay.items[safeNode.node.id] ?? null : null;
  const learnerOverlayItem = safeNode ? input.graphPayload.learnerOverlay.items[safeNode.node.id] ?? null : null;
  const limitations = uniqueStrings([
    ...input.graphPayload.limitations.map((limitation) => limitation.code),
    ...(safeNode?.limitations.map((limitation) => limitation.code) ?? []),
    ...(associated?.limitations ?? []),
    ...(!nodeFound && requestedNodeId ? ['requested-node-not-found'] : []),
  ]);

  return {
    classInfo: input.classInfo,
    student: input.student ?? null,
    selection: {
      domain: input.graphPayload.activeDomain,
      objectiveId: input.graphPayload.objectiveId,
      portraitDimension: input.graphPayload.portraitDimension,
      requestedNodeId,
      nodeFound,
    },
    node: safeNode ? buildNodeView(safeNode) : null,
    sarTrace: {
      status: associated?.status ?? 'unavailable',
      eventCount: associated?.eventCount ?? 0,
      topEvents: associated?.topEvents ?? [],
      candidateRefs: {
        eventCount: associated?.candidateRefs.eventIds.length ?? 0,
        entityCount: associated?.candidateRefs.entityIds.length ?? 0,
        resourceNodeCount: associated?.candidateRefs.resourceNodeIds.length ?? 0,
        retrievalChunkCount: associated?.candidateRefs.retrievalChunkIds.length ?? 0,
        citationTargetCount: associated?.candidateRefs.citationTargetIds.length ?? 0,
        planningUnitCount: associated?.candidateRefs.planningUnitIds.length ?? 0,
      },
      selectedRefCount: associated?.traceSummary.selectedRefCount ?? 0,
      rejectedRefCount: associated?.traceSummary.rejectedRefCount ?? 0,
      expansionHopCount: associated?.traceSummary.expansionHopCount ?? 0,
      limitations: associated?.traceSummary.limitations ?? limitations,
    },
    evidenceCounts: {
      classStudentCount: classOverlayItem?.denominator ?? null,
      classIncludedPopulation: classOverlayItem?.includedPopulation ?? null,
      classExcludedPopulation: classOverlayItem?.excludedPopulation ?? null,
      studentEvidenceCount: learnerOverlayItem?.evidenceCount ?? null,
    },
    resourceGaps: (safeNode?.resourceCoverage.missingCoverageTypes ?? []).map((type) => ({
      type,
      label: teacherKaqMissingCoverageLabel(type),
    })),
    candidateResources: (associated?.resourceGapSuggestions ?? []).map((candidate) => ({
      id: candidate.id,
      refType: candidate.refType,
      ref: candidate.ref,
      label: teacherKaqCandidateRefLabel(candidate.refType),
      suggestedFor: candidate.suggestedForMissingCoverageTypes.map(teacherKaqMissingCoverageLabel),
      reason: candidate.rationale.reason,
    })),
    limitations,
    returnLinks: buildTeacherKaqReturnLinks({
      classId: input.classInfo.id,
      studentId: input.student?.id ?? input.query?.studentId ?? null,
      nodeId: safeNode?.node.id ?? requestedNodeId,
      domain: input.graphPayload.activeDomain,
      objectiveId: input.graphPayload.objectiveId,
    }),
  };
}

export function teacherKaqMissingCoverageLabel(type: GraphCenterResourceCoverageMissingType): string {
  const labels: Record<GraphCenterResourceCoverageMissingType, string> = {
    'linked-resource': '缺少关联资源',
    'path-eligible-resource': '缺少路径可用资源',
    'rag-indexed-resource': '缺少 RAG 索引',
    'citation-ready-resource': '缺少可引用目标',
    'verified-citation-resource': '缺少已校验引用',
    'assessment-resource': '缺少测评资源',
    'simulation-resource': '缺少仿真资源',
    'arena-preview-resource': '缺少 Arena 预览',
    'arena-official-resource': '缺少 Arena 官方验证',
    'terminal-validation-capable-resource': '缺少终端验证能力',
  };
  return labels[type];
}

function buildNodeView(selectedNode: GraphCenterSelectedNodeDetail): NonNullable<TeacherKaqEvidenceTracePayload['node']> {
  return {
    id: selectedNode.node.id,
    title: selectedNode.node.title,
    domain: selectedNode.node.domain,
    description: selectedNode.node.description,
    objectiveIds: selectedNode.node.objectiveIds,
    objectives: selectedNode.objectives.map((objective) => ({
      id: objective.id,
      title: objective.title,
      level: objective.level,
    })),
    portraitDimensions: selectedNode.node.portraitDimensions,
  };
}

function buildTeacherKaqReturnLinks(input: {
  classId: string;
  studentId?: string | null;
  nodeId?: string | null;
  domain: GraphCenterDomain;
  objectiveId: string | null;
}): TeacherKaqEvidenceTracePayload['returnLinks'] {
  const graphQuery = new URLSearchParams({
    domain: input.domain,
    classId: input.classId,
  });
  if (input.nodeId) graphQuery.set('nodeId', input.nodeId);
  if (input.objectiveId) graphQuery.set('objectiveId', input.objectiveId);
  if (input.studentId) graphQuery.set('learnerId', input.studentId);

  return [
    {
      id: 'class-analytics',
      label: '返回班级学情',
      href: `/teacher/classes/${encodeURIComponent(input.classId)}/analytics-v2`,
    },
    ...(input.studentId
      ? [{
          id: 'student-evidence',
          label: '查看学生证据',
          href: `/teacher/classes/${encodeURIComponent(input.classId)}/students/${encodeURIComponent(input.studentId)}/evidence`,
        }]
      : []),
    {
      id: 'graph-center',
      label: '打开图谱中心',
      href: `/graph-center?${graphQuery.toString()}`,
    },
    {
      id: 'resource-governance',
      label: '资源节点治理',
      href: '/teacher/resources/resource-nodes',
    },
  ];
}

function teacherKaqCandidateRefLabel(refType: string): string {
  const labels: Record<string, string> = {
    'resource-node': 'ResourceNode 候选',
    'retrieval-chunk': '检索片段候选',
    'citation-target': '引用目标候选',
    'planning-unit': '路径单元候选',
  };
  return labels[refType] ?? refType;
}

function normalizeOptionalId(value: string | null | undefined): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function uniqueStrings(values: string[]): string[] {
  return Array.from(new Set(values.filter((value) => value.length > 0))).sort();
}
