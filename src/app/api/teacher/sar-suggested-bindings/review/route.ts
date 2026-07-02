import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import type { Prisma } from '@prisma/client';

import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { rethrowIfNextDynamicError } from '@/lib/nextjs-dynamic-error';
import {
  loadAllLessonRuntimeResourceCatalogEntries,
  type RuntimeLessonResourceCatalogEntry,
} from '@/lib/course-runtime';
import {
  loadAllTextbookRuntimeResourceCatalogEntries,
  type TextbookRuntimeResourceCatalogEntry,
} from '@/lib/textbook-runtime-resources';
import { getAllRegisteredResourceMetadata } from '@/lib/resource-registry-metadata';
import {
  buildResourceNodeRegistryFromTeachingResources,
  asRecord,
  loadRuntimeResourceProjectionInputs,
} from '@/lib/teacher-resource-node-data';
import type { RuntimeResourceProjectionInput } from '@/lib/resource-node-registry';
import {
  reviewSarSuggestedBinding,
  type SarSuggestedBindingReviewCandidate,
  type SarSuggestedBindingReviewDecision,
  type SarSuggestedBindingReviewResult,
  type TeacherResourceNodePatch,
  type TeacherResourceNodeScope,
} from '@/lib/teacher-resource-node-management';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }
    if (session.user.role !== 'TEACHER' && session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: '权限不足' }, { status: 403 });
    }

    const body = await request.json().catch(() => null);
    const decision = parseDecision(readObject(body)?.decision);
    const candidate = parseCandidate(readObject(body)?.candidate);
    if (!decision || !candidate) {
      return NextResponse.json({ error: 'SAR 审查请求无效。' }, { status: 400 });
    }

    const resources = await prisma.teachingResource.findMany({
      where: session.user.role === 'TEACHER' ? { authorId: session.user.id } : {},
      include: {
        knowledgeNodes: {
          select: { id: true, name: true, resources: true, tags: true },
        },
      },
      orderBy: [{ category: 'asc' }, { displayOrder: 'asc' }, { title: 'asc' }],
    });
    const registeredResources = getAllRegisteredResourceMetadata();
    const [runtimeLessons, runtimeTextbooks, runtimeResourceProjections] = await Promise.all([
      loadAllLessonRuntimeResourceCatalogEntries(),
      loadAllTextbookRuntimeResourceCatalogEntries(),
      loadRuntimeResourceProjectionInputs(),
    ]);
    const registry = buildResourceNodeRegistryFromTeachingResources(
      resources,
      registeredResources,
      runtimeLessons,
      runtimeTextbooks,
      runtimeResourceProjections,
    );
    const scope = createScope(
      session.user.role,
      session.user.id,
      resources,
      registeredResources,
      runtimeLessons,
      runtimeTextbooks,
      runtimeResourceProjections,
    );
    const requestedResourceNodeId = stringValue(readObject(body)?.resourceNodeId)
      ?? candidate.candidate.resourceNodeId
      ?? (candidate.candidate.refType === 'resource-node' ? candidate.candidate.ref : null);
    const resourceNode = requestedResourceNodeId
      ? registry.nodes.find((node) => node.id === requestedResourceNodeId)
      : undefined;
    const patch = parsePatch(readObject(body)?.patch);

    const result = reviewSarSuggestedBinding({
      candidate,
      scope,
      decision,
      rationale: stringValue(readObject(body)?.rationale) ?? `Graph Center SAR ${decision}`,
      reviewedAt: new Date().toISOString(),
      resourceNode,
      patch,
    });
    return persistSarSuggestedBindingReview({
      result,
      resourceNode,
      resources,
      candidateSourceRefs: candidate.candidate.sourceRefs ?? [],
    });
  } catch (error) {
    rethrowIfNextDynamicError(error);
    console.error('SAR 建议绑定审查失败:', error);
    return NextResponse.json({ error: 'SAR 建议绑定审查失败。' }, { status: 500 });
  }
}

async function persistSarSuggestedBindingReview(input: {
  result: SarSuggestedBindingReviewResult;
  resourceNode?: { id: string; sourceKind: string; sourceRef: string };
  resources: ReadonlyArray<{ id: string; config: unknown }>;
  candidateSourceRefs: readonly string[];
}) {
  if (!input.result.ok) {
    return NextResponse.json(input.result, { status: input.result.status });
  }
  if (!input.resourceNode || input.resourceNode.sourceKind !== 'teaching_resource') {
    if (input.result.state !== 'accepted') {
      const auditResource = findSarReviewAuditResource(input.candidateSourceRefs, input.resources);
      if (!auditResource) {
        return NextResponse.json({
          ok: false,
          status: 400,
          code: 'SAR_REVIEW_REQUIRES_PERSISTENT_AUDIT_TARGET',
          error: 'SAR 建议审查需要可持久化的审计目标。',
        }, { status: 400 });
      }
      return persistSarReviewOnResource({
        result: input.result,
        resource: auditResource,
      });
    }
    return NextResponse.json({
      ok: false,
      status: 400,
      code: 'SAR_REVIEW_REQUIRES_RESOURCE_NODE_AUDIT_TARGET',
      error: 'SAR 建议审查需要可持久化的 ResourceNode 审计目标。',
    }, { status: 400 });
  }
  const resource = input.resources.find((candidate) => candidate.id === input.resourceNode!.sourceRef);
  if (!resource) {
    return NextResponse.json({
      ok: false,
      status: 403,
      code: 'SAR_REVIEW_RESOURCE_NODE_FORBIDDEN',
      error: 'ResourceNode 审计目标不存在或无权管理。',
    }, { status: 403 });
  }
  return persistSarReviewOnResource({
    result: input.result,
    resource,
  });
}

async function persistSarReviewOnResource(input: {
  result: Extract<SarSuggestedBindingReviewResult, { ok: true }>;
  resource: { id: string; config: unknown };
}) {
  const currentConfig = asRecord(input.resource.config);
  const currentPlanning = asRecord(currentConfig.resourceNodePlanning);
  const existingReviews = Array.isArray(currentPlanning.sarSuggestedBindingReviews)
    ? currentPlanning.sarSuggestedBindingReviews.filter((item) => readObject(item))
    : [];
  const terminalReview = existingReviews.find((review) =>
    isSameSarTerminalCandidate(review, input.result.auditRecord) &&
    isTerminalSarReviewState(stringValue(review.state))
  );
  if (terminalReview) {
    return NextResponse.json({
      ok: false,
      status: 409,
      code: 'SAR_REVIEW_CANDIDATE_ALREADY_TERMINAL',
      error: 'SAR 候选已完成终态审查。',
      existingState: stringValue(terminalReview.state),
    }, { status: 409 });
  }
  const planningPatch = input.result.persistablePatch?.resourceNodePlanning ?? {};
  const nextConfig = {
    ...currentConfig,
    resourceNodePlanning: {
      ...currentPlanning,
      ...planningPatch,
      sarSuggestedBindingReviews: [
        ...existingReviews,
        input.result.auditRecord,
      ].slice(-50),
    },
  };

  await prisma.teachingResource.update({
    where: { id: input.resource.id },
    data: {
      ...(input.result.persistablePatch?.displayName !== undefined
        ? { displayName: input.result.persistablePatch.displayName }
        : {}),
      ...(input.result.persistablePatch?.description !== undefined
        ? { description: input.result.persistablePatch.description }
        : {}),
      config: nextConfig as Prisma.InputJsonValue,
    },
  });

  return NextResponse.json({
    ...input.result,
    persisted: true,
    persistedResourceId: input.resource.id,
  }, { status: input.result.status });
}

function findSarReviewAuditResource(
  candidateSourceRefs: readonly string[],
  resources: ReadonlyArray<{ id: string; config: unknown }>,
) {
  const sourceRefs = new Set(candidateSourceRefs);
  return resources.find((resource) => sourceRefs.has(resource.id));
}

function isTerminalSarReviewState(state: string | null): boolean {
  return state === 'accepted' || state === 'rejected' || state === 'invalidated';
}

function isSameSarTerminalCandidate(
  review: Record<string, unknown>,
  auditRecord: Extract<SarSuggestedBindingReviewResult, { ok: true }>['auditRecord'],
): boolean {
  return stringValue(review.candidateId) === auditRecord.candidateId
    && stringValue(review.candidateRef) === auditRecord.candidateRef
    && stringValue(review.candidateRefType) === auditRecord.candidateRefType
    && stringValue(review.targetGraphNodeId) === auditRecord.targetGraphNodeId;
}

function createScope(
  role: string,
  teacherId: string,
  resources: ReadonlyArray<{ id: string; knowledgeNodes?: Array<{ id: string }> }>,
  registeredResources: ReadonlyArray<{ id: string }>,
  runtimeLessons: ReadonlyArray<RuntimeLessonResourceCatalogEntry>,
  runtimeTextbooks: ReadonlyArray<TextbookRuntimeResourceCatalogEntry>,
  runtimeResourceProjections: ReadonlyArray<RuntimeResourceProjectionInput>,
): TeacherResourceNodeScope {
  const resourceIds = resources.map((resource) => resource.id);
  const registeredResourceIds = registeredResources.map((resource) => resource.id);
  const knowledgeNodeIds = resources.flatMap((resource) => resource.knowledgeNodes?.map((node) => node.id) ?? []);
  const knowledgeCardIds = knowledgeNodeIds.map((id) => `${id}:card`);
  const runtimeSourceRefs = runtimeLessons.flatMap((lesson) => {
    const lessonId = lesson.lesson.lesson_id || lesson.graphOverlay.lesson_id;
    return [lessonId, ...lesson.mediaResources.map((resource) => `${lessonId}:${resource.id}`)];
  });
  const runtimeKnowledgeNodeIds = runtimeLessons.flatMap((lesson) => [
    ...lesson.graphOverlay.focus_node_ids,
    ...lesson.graphOverlay.card_order,
    ...lesson.graphOverlay.nodes.map((node) => node.id),
  ]);
  const runtimeKnowledgeCardIds = runtimeKnowledgeNodeIds.map((id) => `${id}:card`);
  const runtimeProjectionRefs = runtimeResourceProjections.flatMap((projection) => [
    projection.sourceRef,
    projection.sourceRecord,
  ].filter((value): value is string => Boolean(value)));
  const textbookSourceRefs = runtimeTextbooks.flatMap((entry) => [
    entry.textbook.bookId,
    ...entry.sections.map((section) => `${entry.textbook.bookId}:${section.sectionId}`),
    ...entry.sections.map((section) => `textbook-section:${entry.textbook.bookId}:${section.sectionId}`),
  ]);
  const textbookKnowledgeNodeIds = runtimeTextbooks.flatMap((entry) =>
    entry.sections.flatMap((section) => section.knowledgeNodeIds ?? [])
  );
  const textbookKnowledgeCardIds = textbookKnowledgeNodeIds.map((id) => `${id}:card`);
  return {
    role: role === 'ADMIN' ? 'ADMIN' : 'TEACHER',
    teacherId,
    readableSourceRefs: new Set([
      ...resourceIds,
      ...registeredResourceIds,
      ...knowledgeNodeIds,
      ...knowledgeCardIds,
      ...runtimeSourceRefs,
      ...runtimeProjectionRefs,
      ...runtimeKnowledgeNodeIds,
      ...runtimeKnowledgeCardIds,
      ...textbookSourceRefs,
      ...textbookKnowledgeNodeIds,
      ...textbookKnowledgeCardIds,
    ]),
    editableSourceRefs: new Set(resourceIds),
  };
}

function parseDecision(value: unknown): SarSuggestedBindingReviewDecision | null {
  return value === 'accept' || value === 'reject' || value === 'defer' || value === 'invalidate' ? value : null;
}

function parseCandidate(value: unknown): SarSuggestedBindingReviewCandidate | null {
  const record = readObject(value);
  const target = readObject(record?.target);
  const candidate = readObject(record?.candidate);
  const provenance = readObject(record?.provenance);
  const traceSummary = readObject(record?.traceSummary);
  const id = stringValue(record?.id);
  const graphNodeId = stringValue(target?.graphNodeId);
  const ref = stringValue(candidate?.ref);
  const refType = stringValue(candidate?.refType);
  if (!id || !graphNodeId || !ref || !isCandidateRefType(refType)) return null;
  return {
    id,
    target: {
      graphNodeId,
      objectiveId: stringValue(target?.objectiveId),
    },
    candidate: {
      ref,
      refType,
      resourceNodeId: stringValue(candidate?.resourceNodeId),
      sourceRefs: stringArray(candidate?.sourceRefs),
    },
    missingCoverageTypes: stringArray(record?.missingCoverageTypes),
    provenance: {
      source: stringValue(provenance?.source) ?? 'graph-center-sar',
      basisEventIds: stringArray(provenance?.basisEventIds),
      traceId: stringValue(provenance?.traceId),
    },
    traceSummary: {
      seedEntityIds: stringArray(traceSummary?.seedEntityIds),
      expansionHopCount: numberValue(traceSummary?.expansionHopCount),
      selectedRefCount: numberValue(traceSummary?.selectedRefCount),
      rejectedRefCount: numberValue(traceSummary?.rejectedRefCount),
      limitations: stringArray(traceSummary?.limitations),
    },
    limitations: stringArray(record?.limitations),
  };
}

function parsePatch(value: unknown): TeacherResourceNodePatch | undefined {
  const patch = readObject(value);
  return patch ? patch as TeacherResourceNodePatch : undefined;
}

function isCandidateRefType(value: string | null): value is SarSuggestedBindingReviewCandidate['candidate']['refType'] {
  return value === 'resource-node' || value === 'retrieval-chunk' || value === 'citation-target' || value === 'planning-unit';
}

function readObject(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function stringValue(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string' && item.length > 0) : [];
}

function numberValue(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? Math.max(0, value) : 0;
}
