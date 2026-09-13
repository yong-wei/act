/**
 * Anchored resource binding release builder.
 *
 * Rules (see openspec change rebuild-anchored-resource-binding-release):
 *  - steps bind through their `sequence.json` group nodes and step-text terminology,
 *    anchored by stepId; never to the whole unit's node set
 *  - handouts bind per heading, media per transcript segment (only media whose bytes
 *    the activated Runtime release serves), textbooks per section
 *  - cards / infographics / simulations / textbook sections are carried forward from
 *    the course projection's exact channels
 *  - lesson entries and whole books are never resources
 *  - appearance: earliest unit (course order) binding a canonical node is `first`,
 *    later units `revisit`, unit-less reference material `reference`
 */

import type { TeachingProjectionRole, TeachingResourceType } from '@/lib/teaching-projection/contracts';
import { projectionDigest, projectionSha256 } from '@/lib/teaching-projection/hash';

import { computeAuditReport } from './audit';
import {
  RESOURCE_BINDING_RELEASE_BUILDER_VERSION,
  RESOURCE_BINDING_RELEASE_MANIFEST_CONTRACT,
  anchorKeyOf,
  timeAnchorLabel,
  type AnchoredBindingRuntime,
  type AnchoredResourceRuntime,
  type BindingAnchor,
  type BindingAnchorKind,
  type BindingAppearance,
  type BindingProvenanceMethod,
  type ResourceBindingAuditReport,
  type ResourceBindingGateResult,
  type ResourceBindingReleaseManifest,
  type ResourceBindingReleaseManifestBody,
} from './contracts';
import { evaluateResourceBindingGate, type GateContext } from './gate';
import { authorityRevisionLabel, bindingIdFor, bindingReleaseIdFor } from './identity';
import type { AnchorCandidate, CrosswalkRow, ResourceBindingSources, ReviewRow } from './sources';

export interface BuiltResourceBindingRelease {
  manifest: ResourceBindingReleaseManifest;
  resources: AnchoredResourceRuntime[];
  bindings: AnchoredBindingRuntime[];
  gate: ResourceBindingGateResult;
  audit: ResourceBindingAuditReport;
}

const CARRY_FORWARD_TYPES: readonly TeachingResourceType[] = [
  'card',
  'infographic',
  'simulation',
  'textbook-section',
  'textbook-chapter',
];

interface DraftBinding extends Omit<AnchoredBindingRuntime, 'bindingId' | 'appearance'> {
  unitIndex: number | null;
}

interface DraftResource {
  resourceId: string;
  resourceType: TeachingResourceType;
  title: string | null;
  sourcePath: string | null;
  unitId: string | null;
  media: AnchoredResourceRuntime['media'];
  anchorKeys: Set<string>;
  bindingCount: number;
}

function stepRole(title: string | null): TeachingProjectionRole {
  const text = title ?? '';
  if (/前测|后测|测验|自测|检测|评价/u.test(text)) return 'ASSESSES';
  if (/练习|实操|动手|任务|挑战|实践|演练/u.test(text)) return 'PRACTICES';
  return 'EXPLAINS';
}

function reviewIndex(review: ReviewRow[]) {
  const accept = new Map<string, Set<string>>();
  const reject = new Map<string, Set<string>>();
  const add = new Map<string, Set<string>>();
  for (const row of review) {
    const key = `${row.unit}|${row.target.kind}:${row.target.id}`;
    const bucket = row.decision === 'reject' ? reject : row.decision === 'add' ? add : accept;
    if (!bucket.has(key)) bucket.set(key, new Set());
    bucket.get(key)!.add(row.canonicalId);
  }
  return { accept, reject, add };
}

function applyReview(
  candidates: AnchorCandidate[],
  key: string,
  index: ReturnType<typeof reviewIndex>,
): Array<{ canonicalId: string; method: BindingProvenanceMethod; matchedLabel: string | null }> {
  const rejected = index.reject.get(key) ?? new Set<string>();
  const accepted = index.accept.get(key) ?? new Set<string>();
  const added = index.add.get(key) ?? new Set<string>();
  const out = new Map<string, { canonicalId: string; method: BindingProvenanceMethod; matchedLabel: string | null }>();
  for (const candidate of candidates) {
    if (rejected.has(candidate.canonicalId)) continue;
    const method: BindingProvenanceMethod = accepted.has(candidate.canonicalId)
      ? 'reviewed'
      : (candidate.provenance as BindingProvenanceMethod);
    if (!out.has(candidate.canonicalId)) {
      out.set(candidate.canonicalId, {
        canonicalId: candidate.canonicalId,
        method,
        matchedLabel: candidate.matchedLabel ?? candidate.courseNodeId ?? null,
      });
    }
  }
  for (const canonicalId of added) {
    if (!rejected.has(canonicalId) && !out.has(canonicalId)) {
      out.set(canonicalId, { canonicalId, method: 'reviewed', matchedLabel: null });
    }
  }
  return [...out.values()].sort((a, b) => a.canonicalId.localeCompare(b.canonicalId));
}

function crosswalkCanonicals(rows: CrosswalkRow[], courseNodeIds: string[]): Set<string> {
  const byId = new Map(rows.map((row) => [row.courseNodeId, row]));
  const out = new Set<string>();
  for (const id of courseNodeIds) {
    const row = byId.get(id);
    if (row?.status === 'mapped') row.canonicalIds.forEach((cid) => out.add(cid));
  }
  return out;
}

export function buildResourceBindingRelease(
  sources: ResourceBindingSources,
  options: { bindingRevision: number },
): BuiltResourceBindingRelease {
  const scopeId = sources.scopeId;
  const review = reviewIndex(sources.review);
  const resources = new Map<string, DraftResource>();
  const drafts: DraftBinding[] = [];
  const seenBindingKeys = new Set<string>();
  const gateContext: GateContext = {
    excludedResourceIds: [],
    noAnchorResourceIds: [],
    driftedMediaIds: [],
    unmappedCourseNodes: sources.crosswalk.filter((row) => row.status === 'unmapped').map((row) => row.courseNodeId),
    ambiguousLabels: sources.ambiguousLabels,
    mediaDurations: new Map(),
    activeMediaSha: new Map(sources.activeMedia.files.map((file) => [file.path, file.sha256])),
    authorityMismatch: null,
    carryForwardGatePassed: sources.carryForward.manifest.gatePassed,
  };

  const ensureResource = (draft: Omit<DraftResource, 'anchorKeys' | 'bindingCount'>): DraftResource => {
    let existing = resources.get(draft.resourceId);
    if (!existing) {
      existing = { ...draft, anchorKeys: new Set(), bindingCount: 0 };
      resources.set(draft.resourceId, existing);
    }
    return existing;
  };

  const pushBinding = (draft: DraftBinding) => {
    const dedupeKey = `${draft.resourceId}|${draft.anchorKey}|${draft.canonicalId}|${draft.role}`;
    if (seenBindingKeys.has(dedupeKey)) return;
    seenBindingKeys.add(dedupeKey);
    drafts.push(draft);
    const resource = resources.get(draft.resourceId);
    if (resource) {
      resource.anchorKeys.add(draft.anchorKey);
      resource.bindingCount += 1;
    }
  };

  // ------------------------------------------------------------------ unit channels
  for (const unitId of sources.unitOrder) {
    const anchors = sources.anchors.get(unitId);
    if (!anchors) continue;
    const unitIndex = sources.unitOrder.indexOf(unitId);
    const lesson = sources.lessons.get(unitId);
    const focusCanonicals = crosswalkCanonicals(sources.crosswalk, lesson?.focusNodeIds ?? []);

    for (const step of anchors.steps) {
      const resourceId = `act:step:${unitId}:${step.stepId}`;
      const resource = ensureResource({
        resourceId,
        resourceType: 'step',
        title: step.title,
        sourcePath: `course-content/runtime/lessons/${unitId}/interactive-manifest.json#${step.stepId}`,
        unitId,
        media: null,
      });
      const anchor: BindingAnchor = {
        kind: 'step',
        stepId: step.stepId,
        stepIndex: step.index,
        label: `第 ${step.index + 1} 步`,
      };
      const role = stepRole(step.title);
      const resolved = applyReview(step.canonical, `${unitId}|step:${step.stepId}`, review);
      if (resolved.length === 0) {
        gateContext.noAnchorResourceIds.push(resource.resourceId);
      }
      for (const item of resolved) {
        pushBinding({
          resourceId,
          resourceType: 'step',
          canonicalId: item.canonicalId,
          role,
          scopeId,
          anchor,
          anchorKey: anchorKeyOf(anchor),
          teachingOrder: { unitId, unitIndex, stepIndex: step.index },
          focus: focusCanonicals.has(item.canonicalId),
          primary: item.method === 'sequence-crosswalk' || item.method === 'reviewed',
          provenance: { method: item.method, matchedLabel: item.matchedLabel, source: `anchors/${unitId}.json#steps/${step.stepId}` },
          unitIndex,
        });
      }
    }

    if (anchors.handout && anchors.handoutSections.length > 0) {
      const resourceId = `act:handout:${unitId}`;
      ensureResource({
        resourceId,
        resourceType: 'handout',
        title: lesson?.title ? `${unitId} 讲义：${lesson.title}` : `${unitId} 讲义`,
        sourcePath: `course-content/runtime/${anchors.handout.runtimePath}`,
        unitId,
        media: null,
      });
      let bound = 0;
      for (const section of anchors.handoutSections) {
        const anchor: BindingAnchor = {
          kind: 'heading',
          headingId: section.headingId,
          order: section.order,
          level: section.level,
          label: section.title,
        };
        const resolved = applyReview(section.canonical, `${unitId}|heading:${section.headingId}`, review);
        for (const item of resolved) {
          bound += 1;
          pushBinding({
            resourceId,
            resourceType: 'handout',
            canonicalId: item.canonicalId,
            role: 'EXPLAINS',
            scopeId,
            anchor,
            anchorKey: anchorKeyOf(anchor),
            teachingOrder: { unitId, unitIndex, stepIndex: null },
            focus: focusCanonicals.has(item.canonicalId),
            primary: item.method === 'reviewed',
            provenance: { method: item.method, matchedLabel: item.matchedLabel, source: `anchors/${unitId}.json#handoutSections/${section.headingId}` },
            unitIndex,
          });
        }
      }
      if (bound === 0) gateContext.noAnchorResourceIds.push(resourceId);
    }

    for (const media of anchors.media) {
      const resourceType: TeachingResourceType = media.kind === 'audio' ? 'audio' : 'video';
      const suffix = media.mediaId.slice(unitId.length + 1);
      const resourceId = media.kind === 'audio' ? `act:audio:${unitId}` : `act:video:${unitId}:${suffix}`;
      const resource = ensureResource({
        resourceId,
        resourceType,
        title: `${unitId} ${suffix === 'audio' ? '讲解音频' : suffix === 'intro-video' ? '导入视频' : '课程视频'}`,
        sourcePath: `course-content/runtime/${media.runtimePath}`,
        unitId,
        media: {
          mediaId: media.mediaId,
          runtimePath: media.runtimePath,
          sha256: media.activeReleaseSha256 ?? media.sha256,
          durationSeconds: media.durationSeconds,
        },
      });
      if (media.durationSeconds !== null) gateContext.mediaDurations.set(media.mediaId, media.durationSeconds);
      if (media.status !== 'anchored') {
        if (media.status === 'media-drift-vs-active-release' || media.status === 'missing-in-active-release') {
          gateContext.driftedMediaIds.push(media.mediaId);
        }
        gateContext.noAnchorResourceIds.push(resource.resourceId);
        continue;
      }
      let bound = 0;
      for (const segment of media.segments) {
        const anchor: BindingAnchor = {
          kind: 'time',
          mediaId: media.mediaId,
          runtimePath: media.runtimePath,
          mediaSha256: media.sha256,
          startSeconds: segment.startSeconds,
          endSeconds: segment.endSeconds,
          label: timeAnchorLabel(segment.startSeconds, segment.endSeconds),
        };
        const resolved = applyReview(segment.canonical, `${unitId}|time:${media.mediaId}#${segment.index}`, review);
        for (const item of resolved) {
          bound += 1;
          pushBinding({
            resourceId,
            resourceType,
            canonicalId: item.canonicalId,
            role: 'EXPLAINS',
            scopeId,
            anchor,
            anchorKey: anchorKeyOf(anchor),
            teachingOrder: { unitId, unitIndex, stepIndex: null },
            focus: focusCanonicals.has(item.canonicalId),
            primary: item.method === 'reviewed',
            provenance: { method: item.method, matchedLabel: item.matchedLabel, source: `anchors/${unitId}.json#media/${media.mediaId}/${segment.index}` },
            unitIndex,
          });
        }
      }
      if (bound === 0) gateContext.noAnchorResourceIds.push(resourceId);
    }
  }

  // ------------------------------------------------------------------ carry-forward exact channels
  const carryResources = new Map(sources.carryForward.resources.map((r) => [r.resourceId, r]));
  for (const binding of sources.carryForward.bindings) {
    const resource = carryResources.get(binding.resourceId);
    if (!resource) continue;
    if (resource.resourceType === 'lesson' || resource.resourceType === 'textbook') {
      if (!gateContext.excludedResourceIds.includes(resource.resourceId)) {
        gateContext.excludedResourceIds.push(resource.resourceId);
      }
      continue;
    }
    if (!CARRY_FORWARD_TYPES.includes(resource.resourceType)) continue;
    ensureResource({
      resourceId: resource.resourceId,
      resourceType: resource.resourceType,
      title: resource.title,
      sourcePath: resource.sourcePath,
      unitId: null,
      media: null,
    });
    const anchor: BindingAnchor = resource.resourceType.startsWith('textbook')
      ? {
          kind: 'section',
          sectionPath: resource.resourceId.replace(/^act:textbook-(?:section|chapter):/u, ''),
          label: resource.title ?? resource.resourceId,
        }
      : { kind: 'whole' };
    pushBinding({
      resourceId: resource.resourceId,
      resourceType: resource.resourceType,
      canonicalId: binding.canonicalId,
      role: binding.role,
      scopeId: binding.scopeId || scopeId,
      anchor,
      anchorKey: anchorKeyOf(anchor),
      teachingOrder: null,
      focus: false,
      primary: binding.primary,
      provenance: {
        method: 'carry-forward-exact',
        matchedLabel: null,
        source: `course-projection:${sources.carryForward.projectionId}#${binding.bindingId}`,
      },
      unitIndex: null,
    });
  }

  // ------------------------------------------------------------------ appearance
  const firstUnitIndex = new Map<string, number>();
  for (const draft of drafts) {
    if (draft.unitIndex === null) continue;
    const current = firstUnitIndex.get(draft.canonicalId);
    if (current === undefined || draft.unitIndex < current) firstUnitIndex.set(draft.canonicalId, draft.unitIndex);
  }
  const bindings: AnchoredBindingRuntime[] = drafts.map((draft) => {
    const { unitIndex, ...rest } = draft;
    const appearance: BindingAppearance = unitIndex === null
      ? 'reference'
      : firstUnitIndex.get(draft.canonicalId) === unitIndex ? 'first' : 'revisit';
    return {
      bindingId: bindingIdFor({
        resourceId: rest.resourceId,
        anchorKey: rest.anchorKey,
        canonicalId: rest.canonicalId,
        role: rest.role,
        scopeId: rest.scopeId,
      }),
      ...rest,
      appearance,
    };
  });
  bindings.sort((a, b) =>
    a.resourceId.localeCompare(b.resourceId)
    || a.anchorKey.localeCompare(b.anchorKey)
    || a.canonicalId.localeCompare(b.canonicalId)
    || a.role.localeCompare(b.role));

  const resourceList: AnchoredResourceRuntime[] = [...resources.values()]
    .map((draft) => ({
      resourceId: draft.resourceId,
      resourceType: draft.resourceType,
      title: draft.title,
      sourcePath: draft.sourcePath,
      unitId: draft.unitId,
      media: draft.media,
      anchorCount: draft.anchorKeys.size,
      bindingCount: draft.bindingCount,
      bindingStatus: draft.bindingCount > 0 ? 'BOUND' as const : 'UNBOUND' as const,
    }))
    .sort((a, b) => a.resourceId.localeCompare(b.resourceId));

  // ------------------------------------------------------------------ gate, audit, manifest
  const label = authorityRevisionLabel(sources.authority.releaseId, sources.authority.releaseSetId);
  const bindingReleaseId = bindingReleaseIdFor(label, options.bindingRevision);
  const gate = evaluateResourceBindingGate({ resources: resourceList, bindings, context: gateContext });
  const audit = computeAuditReport({
    bindingReleaseId,
    resources: resourceList,
    bindings,
    baseline: {
      kind: 'course-projection',
      id: sources.carryForward.projectionId,
      resources: sources.carryForward.resources,
      bindings: sources.carryForward.bindings,
    },
  });

  const appearanceCounts: Record<BindingAppearance, number> = { first: 0, revisit: 0, reference: 0 };
  const anchorKindCounts: Record<BindingAnchorKind, number> = { step: 0, heading: 0, time: 0, section: 0, whole: 0 };
  for (const binding of bindings) {
    appearanceCounts[binding.appearance] += 1;
    anchorKindCounts[binding.anchor.kind] += 1;
  }

  const resourcesText = resourceList.map((r) => JSON.stringify(r)).join('\n');
  const bindingsText = bindings.map((b) => JSON.stringify(b)).join('\n');
  const body: ResourceBindingReleaseManifestBody = {
    contract: RESOURCE_BINDING_RELEASE_MANIFEST_CONTRACT,
    builderVersion: RESOURCE_BINDING_RELEASE_BUILDER_VERSION,
    scopeId,
    authorityReleaseId: sources.authority.releaseId,
    authorityReleaseSetId: sources.authority.releaseSetId,
    authoritySnapshotId: sources.authority.snapshotId,
    authoritySnapshotHash: sources.authority.snapshotHash,
    authorityRevisionLabel: label,
    bindingRevision: options.bindingRevision,
    prerequisitePublicationId: sources.prerequisitePublicationId,
    carryForwardProjectionId: sources.carryForward.projectionId,
    carryForwardProjectionHash: sources.carryForward.manifest.projectionHash,
    activeRuntimeReleaseId: sources.activeMedia.runtimeReleaseId,
    sourceHashes: {
      anchors: sources.raw.anchors,
      unitScopes: sources.raw.unitScopes,
      crosswalk: sources.raw.crosswalk,
      review: sources.raw.review,
      courseOrder: sources.raw.courseOrder,
      activeRuntimeMediaIndex: sources.raw.activeRuntimeMediaIndex,
      carryForwardResources: projectionSha256(sources.carryForward.resourcesRaw),
      carryForwardBindings: projectionSha256(sources.carryForward.bindingsRaw),
      resources: projectionSha256(resourcesText),
      bindings: projectionSha256(bindingsText),
      gate: projectionDigest(gate),
    },
    resourceCount: resourceList.length,
    bindingCount: bindings.length,
    canonicalCount: new Set(bindings.map((b) => b.canonicalId)).size,
    unitCount: sources.anchors.size,
    appearanceCounts,
    anchorKindCounts,
    gateStatus: gate.status,
    gatePassed: gate.passed,
  };
  const bindingHash = projectionDigest(body);
  const manifest: ResourceBindingReleaseManifest = { ...body, bindingReleaseId, bindingHash };
  return { manifest, resources: resourceList, bindings, gate, audit };
}

export { anchorKeyOf };
