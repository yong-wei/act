import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { buildGraphCenterPayload } from '../data-governance/graph-center';
import {
  buildResourceFieldCompletionAudit,
  RESOURCE_FIELD_COMPLETION_AUDIT_VERSION,
  type ResourceFieldCompletionCoverageSummary,
} from '../resource-field-completion-audit';
import { buildResourceNodeRegistry } from '../resource-node-registry';

describe('resource field completion audit', () => {
  it('keeps the generated runtime audit artifact broad enough for remediation planning', () => {
    const summary = JSON.parse(readFileSync(
      join(process.cwd(), 'course-content/runtime/resource-governance/resource-field-completion-summary.json'),
      'utf8',
    ));

    expect(summary.totals.denominator).toBeGreaterThan(3000);
    expect(summary.byFamily['runtime-lesson-step'].denominator).toBeGreaterThan(0);
    expect(summary.byFamily['runtime-lesson-module'].denominator).toBeGreaterThan(0);
    expect(summary.byFamily['runtime-lesson-media'].denominator).toBeGreaterThan(0);
    expect(summary.byFamily['runtime-handout'].denominator).toBeGreaterThan(0);
    expect(summary.byFamily['knowledge-card'].denominator).toBeGreaterThan(0);
    expect(summary.byFamily['authoring-textbook-chapter'].denominator).toBeGreaterThan(0);
    expect(summary.byFamily['authoring-textbook-section'].denominator).toBeGreaterThan(0);
    expect(summary.byFamily['authoring-textbook-figure'].denominator).toBeGreaterThan(0);
    expect(summary.byFamily['authoring-textbook-caption'].denominator).toBeGreaterThan(0);
    expect(summary.byFamily['runtime-lesson-module'].sampleLimitations.length).toBeGreaterThan(0);
    expect(summary.byFamily['authoring-textbook-figure'].sourceWindow).toMatchObject({
      from: null,
      to: expect.any(String),
    });
    expect(summary.limitations).not.toContain('No authoring textbook chapter/figure/caption source tree was found; runtime textbook documents are audited as current candidates.');
    const jsonlRows = readFileSync(
      join(process.cwd(), 'course-content/runtime/resource-governance/resource-field-completion-audit.jsonl'),
      'utf8',
    )
      .trim()
      .split('\n')
      .map((line) => JSON.parse(line));
    const knowledgeCardRows = jsonlRows.filter((row) => row.family === 'knowledge-card');
    const cardFiles = readdirSync(join(process.cwd(), 'course-content/runtime/knowledge/cards/nodes'))
      .filter((file) => file.endsWith('.md'))
      .sort((left, right) => left.localeCompare(right));

    for (const row of jsonlRows) {
      expect(row).toHaveProperty('sourceHash');
      expect(row).toHaveProperty('sourceVersionRef');
      expect(row).toHaveProperty('citationTargets');
      expect(Array.isArray(row.citationTargets)).toBe(true);
      if (row.sourceHash === null) {
        expect(row.missingFieldCodes).toContain('missing-content-hash');
        expect(row.pathEligibility.afterCompletion).toBe(false);
      }
    }
    expect(summary.totals.pathEligible).toBe(
      jsonlRows.filter((row) => row.pathEligibility.current).length,
    );
    expect(summary.totals.pathEligible).not.toBe(
      jsonlRows.filter((row) => row.pathEligibility.afterCompletion).length,
    );
    const nestedMediaRow = jsonlRows.find((row) => (
      row.family === 'runtime-lesson-media' &&
      row.sourcePathOrUrl.includes('/media/generated-data/')
    ));
    expect(nestedMediaRow).toMatchObject({
      resourceId: expect.stringContaining(':generated-data/'),
      sourceRecord: expect.stringContaining(':generated-data/'),
    });
    expect(nestedMediaRow?.missingFieldCodes).not.toContain('missing-path-target');
    const indexedMediaRows = jsonlRows.filter((row) => (
      row.family === 'runtime-lesson-media' &&
      row.resourceId.startsWith('runtime-media:') &&
      row.sourceVersionRef === 'resource-node-registry.v1'
    ));
    expect(indexedMediaRows.length).toBeGreaterThan(0);
    expect(indexedMediaRows.every((row) => !row.missingFieldCodes.includes('missing-evidence-instrumentation'))).toBe(true);
    expect(indexedMediaRows.some((row) => row.evidenceContract.complete)).toBe(true);
    expect(indexedMediaRows.some((row) => row.resourceId === 'runtime-media:5-1:5-1-intro-video')).toBe(true);
    expect(indexedMediaRows.some((row) => row.resourceId === 'runtime-media:5-1:5-1 媒体链接登记')).toBe(false);
    expect(indexedMediaRows.some((row) => row.resourceType === 'handout')).toBe(false);

    const authoringManifestPath = 'course-content/authoring/resources/textbooks/hu-shousong-exercise-analysis-3rd/chapter-01/manifest.json';
    const authoringManifest = JSON.parse(readFileSync(join(process.cwd(), authoringManifestPath), 'utf8'));
    const captionImage = authoringManifest.images.find((image: { caption?: string }) => image.caption);
    const captionRow = jsonlRows.find((row) => (
      row.family === 'authoring-textbook-caption' &&
      row.sourcePathOrUrl === authoringManifestPath &&
      row.sourceRecord === `caption:${captionImage.index ?? captionImage.exportPath}`
    ));
    const captionHash = `sha256:${createHash('sha256').update(captionImage.caption).digest('hex')}`;
    expect(captionRow?.sourceHash).toBe(captionHash);
    expect(captionRow?.sourceHash).not.toBe(captionImage.sha256);

    expect(knowledgeCardRows).toHaveLength(cardFiles.length);
    expect(new Set(knowledgeCardRows.map((row) => row.sourceRecord))).toEqual(
      new Set(cardFiles.map((file) => file.replace(/\.md$/, ''))),
    );
    for (const row of knowledgeCardRows) {
      const markdown = readFileSync(join(process.cwd(), row.sourcePathOrUrl), 'utf8');
      expect(row).toMatchObject({
        sourceHash: `sha256:${createHash('sha256').update(markdown).digest('hex')}`,
        sourceVersionRef: 'runtime-knowledge-card.v1',
        citationTargets: [row.sourcePathOrUrl],
      });
      expect(row.sourcePathOrUrl).toBe(`course-content/runtime/knowledge/cards/nodes/${row.sourceRecord}.md`);
      expect(row.coverage.denominatorKey).toContain(row.sourceRecord);
      expect(row.missingFieldCodes).not.toContain('missing-content-hash');
      expect(row.pathEligibility.afterCompletion).toBe(false);
    }
  });

  it('keeps provisional metadata out of PlanningUnit eligibility', () => {
    const result = buildResourceFieldCompletionAudit({
      registry: buildResourceNodeRegistry({}),
      generatedAt: '2026-06-22T00:00:00.000Z',
      candidates: [{
        id: 'infograph:Bode图_1_1',
        title: 'Bode图 信息图',
        family: 'knowledge-infograph',
        sourcePathOrUrl: 'course-content/runtime/knowledge/infographs/nodes/Bode图_1_1.png',
        knowledgeNodeIds: ['Bode图_1_1'],
        capabilityTargetIds: ['control-correction:time-domain-targets'],
        segmentRefs: ['Bode图_1_1'],
        citationTargets: ['/course-runtime/knowledge/infographs/nodes/Bode图_1_1.png'],
        pathTarget: '/course-runtime/knowledge/infographs/nodes/Bode图_1_1.png',
        estimatedTimeMinutes: 3,
        evidenceInstrumentation: ['infograph_view'],
        contentHash: 'sha256:test',
        versionRef: 'knowledge-infograph-manifest.v1',
        generatedBy: 'local-model',
        humanConfirmed: false,
      }],
    });

    expect(result.rows[0]).toMatchObject({
      completionMethod: 'local-model-assisted',
      reviewStatus: 'model-assisted-provisional',
      missingFieldCodes: expect.arrayContaining(['missing-human-review', 'provisional-metadata']),
      pathEligibility: {
        afterCompletion: false,
        masteryAffecting: false,
        blockedBy: expect.arrayContaining(['missing-human-review', 'provisional-metadata']),
      },
    });
  });

  it('blocks path eligibility and mastery effect when evidence contract fields are missing', () => {
    const result = buildResourceFieldCompletionAudit({
      registry: buildResourceNodeRegistry({}),
      generatedAt: '2026-06-22T00:00:00.000Z',
      candidates: [{
        id: 'quiz:generated-bode-check',
        title: 'Generated Bode Check',
        family: 'quiz',
        sourcePathOrUrl: 'course-content/runtime/generated-questions/bode.json',
        knowledgeNodeIds: ['Bode图_1_1'],
        capabilityTargetIds: ['control-correction:time-domain-targets'],
        segmentRefs: ['bode-check'],
        citationTargets: ['course-content/runtime/generated-questions/bode.json'],
        pathTarget: '/teacher/quizzes/generated-bode-check',
        estimatedTimeMinutes: 5,
        evidenceInstrumentation: [],
        contentHash: 'sha256:quiz',
        versionRef: 'generated-question-bank.v1',
        humanConfirmed: true,
      }],
    });

    expect(result.rows[0]).toMatchObject({
      reviewStatus: 'human-confirmed',
      evidenceContract: {
        complete: false,
        missingFields: expect.arrayContaining([
          'eventType',
          'clientEventIdPolicy',
          'learningFactPolicy',
        ]),
      },
      missingFieldCodes: expect.arrayContaining([
        'missing-evidence-instrumentation',
        'missing-evidence-contract',
      ]),
      pathEligibility: {
        afterCompletion: false,
        masteryAffecting: false,
        blockedBy: expect.arrayContaining(['missing-evidence-contract']),
      },
    });
  });

  it('blocks human-confirmed candidates when source hash or version ref is missing', () => {
    const result = buildResourceFieldCompletionAudit({
      registry: buildResourceNodeRegistry({}),
      generatedAt: '2026-06-22T00:00:00.000Z',
      candidates: [{
        id: 'external:confirmed-but-unversioned',
        title: 'Confirmed but unversioned',
        family: 'external-resource',
        sourcePathOrUrl: 'https://example.edu/control-note',
        knowledgeNodeIds: ['Bode图_1_1'],
        capabilityTargetIds: ['control-correction:time-domain-targets'],
        segmentRefs: ['control-note'],
        citationTargets: ['https://example.edu/control-note'],
        pathTarget: 'https://example.edu/control-note',
        estimatedTimeMinutes: 4,
        evidenceInstrumentation: ['external_resource_access'],
        humanConfirmed: true,
      }],
    });

    expect(result.rows[0]).toMatchObject({
      sourceHash: null,
      sourceVersionRef: null,
      reviewAudit: {
        reviewedSourceHash: null,
        reviewedVersionRef: null,
        reviewedAt: '2026-06-22T00:00:00.000Z',
      },
      reviewStatus: 'human-confirmed',
      missingFieldCodes: expect.arrayContaining([
        'missing-content-hash',
        'missing-version-ref',
      ]),
      pathEligibility: {
        afterCompletion: false,
        masteryAffecting: false,
        blockedBy: expect.arrayContaining([
          'missing-content-hash',
          'missing-version-ref',
        ]),
      },
    });
  });

  it('records reviewed source hash, version ref, and generation provenance for human-confirmed candidates', () => {
    const result = buildResourceFieldCompletionAudit({
      registry: buildResourceNodeRegistry({}),
      generatedAt: '2026-06-22T00:00:00.000Z',
      candidates: [{
        id: 'external:confirmed-versioned',
        title: 'Confirmed versioned resource',
        family: 'external-resource',
        sourcePathOrUrl: 'https://example.edu/versioned-control-note',
        knowledgeNodeIds: ['Bode图_1_1'],
        capabilityTargetIds: ['control-correction:time-domain-targets'],
        segmentRefs: ['versioned-control-note'],
        citationTargets: ['https://example.edu/versioned-control-note'],
        pathTarget: 'https://example.edu/versioned-control-note',
        estimatedTimeMinutes: 4,
        evidenceInstrumentation: ['external_resource_access'],
        contentHash: 'sha256:confirmed',
        versionRef: 'external-resource.v1',
        generatedBy: 'local-model',
        humanConfirmed: true,
      }],
    });

    expect(result.rows[0]).toMatchObject({
      sourceHash: 'sha256:confirmed',
      sourceVersionRef: 'external-resource.v1',
      reviewStatus: 'human-confirmed',
      reviewAudit: {
        reviewedSourceHash: 'sha256:confirmed',
        reviewedVersionRef: 'external-resource.v1',
        reviewedAt: '2026-06-22T00:00:00.000Z',
        reviewBatchId: 'external-resource.v1',
        generationToolOrModel: 'local-model',
      },
    });
    expect(result.rows[0].missingFieldCodes).not.toContain('provisional-metadata');
    expect(result.rows[0].pathEligibility.blockedBy).not.toContain('provisional-metadata');
  });

  it('surfaces missing field codes in graph resource coverage diagnostics', () => {
    const registry = buildResourceNodeRegistry({
      registeredResources: [{
        id: 'bode-field-gap',
        label: 'Bode field gap',
        type: 'INTERACTIVE_COMP',
        renderTarget: '/interactive-learning/resources/bode-field-gap',
        knowledgeNodeIds: ['kn:autocontrol:frequency-response'],
        planningOverride: {
          abilityImpact: {},
          evidenceInstrumentation: [],
        },
      }],
    });
    const payload = buildGraphCenterPayload({
      domain: 'knowledge',
      selectedNodeId: 'kn:autocontrol:frequency-response',
      resourceRegistry: registry,
      viewerRole: 'TEACHER',
    });

    expect(payload.resourceCoverage['kn:autocontrol:frequency-response'].fieldCompletion).toMatchObject({
      denominator: 1,
      missingField: 1,
      sourceWindow: { from: null, to: null },
      pathEligible: 0,
      missingFieldCodes: expect.arrayContaining([
        'missing-capability-target',
        'missing-evidence-contract',
        'missing-evidence-instrumentation',
      ]),
      artifactVersion: RESOURCE_FIELD_COMPLETION_AUDIT_VERSION,
    });

    const studentPayload = buildGraphCenterPayload({
      domain: 'knowledge',
      selectedNodeId: 'kn:autocontrol:frequency-response',
      resourceRegistry: registry,
      viewerRole: 'STUDENT',
    });

    expect(studentPayload.resourceCoverage['kn:autocontrol:frequency-response'].fieldCompletion).toBeUndefined();

    const guestPayload = buildGraphCenterPayload({
      domain: 'knowledge',
      selectedNodeId: 'kn:autocontrol:frequency-response',
      resourceRegistry: registry,
    });
    const nullRolePayload = buildGraphCenterPayload({
      domain: 'knowledge',
      selectedNodeId: 'kn:autocontrol:frequency-response',
      resourceRegistry: registry,
      viewerRole: null,
    });

    expect(guestPayload.resourceCoverage['kn:autocontrol:frequency-response'].fieldCompletion).toBeUndefined();
    expect(nullRolePayload.resourceCoverage['kn:autocontrol:frequency-response'].fieldCompletion).toBeUndefined();
  });

  it('merges audit-only candidates into teacher graph resource field diagnostics', () => {
    const registry = buildResourceNodeRegistry({ registeredResources: [] });
    const resourceFieldCompletionSummary = {
      graphCoverageDiagnostics: {
        'knowledge-card:Bode首轮骨架_5_1e07d9da|Bode首轮骨架_5_1e07d9da': coverageSummary({
          citationReady: 1,
          missingFieldCodes: ['missing-human-review', 'provisional-metadata'],
          sampleLimitations: ['knowledge-card:Bode首轮骨架_5_1e07d9da: metadata is provisional'],
        }),
        'infograph:Bode首轮骨架_5_1e07d9da|Bode首轮骨架_5_1e07d9da': coverageSummary({
          missingFieldCodes: ['missing-segment-ref', 'provisional-metadata'],
          sampleLimitations: ['infograph:Bode首轮骨架_5_1e07d9da: metadata is provisional'],
        }),
      },
    };
    const payload = buildGraphCenterPayload({
      domain: 'knowledge',
      selectedNodeId: 'kn:autocontrol:frequency-response',
      resourceRegistry: registry,
      viewerRole: 'TEACHER',
      resourceFieldCompletionSummary,
    });

    expect(payload.resourceCoverage['kn:autocontrol:frequency-response'].linkedResourceCount).toBe(0);
    expect(payload.resourceCoverage['kn:autocontrol:frequency-response'].fieldCompletion).toMatchObject({
      denominator: 2,
      missingField: 2,
      provisional: 2,
      citationReady: 1,
      pathEligible: 0,
      missingFieldCodes: expect.arrayContaining([
        'missing-human-review',
        'missing-segment-ref',
        'provisional-metadata',
      ]),
      sampleLimitations: expect.arrayContaining([
        'knowledge-card:Bode首轮骨架_5_1e07d9da: metadata is provisional',
        'infograph:Bode首轮骨架_5_1e07d9da: metadata is provisional',
      ]),
      artifactVersion: RESOURCE_FIELD_COMPLETION_AUDIT_VERSION,
    });

    const studentPayload = buildGraphCenterPayload({
      domain: 'knowledge',
      selectedNodeId: 'kn:autocontrol:frequency-response',
      resourceRegistry: registry,
      viewerRole: 'STUDENT',
      resourceFieldCompletionSummary,
    });

    expect(studentPayload.resourceCoverage['kn:autocontrol:frequency-response'].fieldCompletion).toBeUndefined();
  });

  it('snapshots audit JSON schema counts and resource families', () => {
    const registry = buildResourceNodeRegistry({
      registeredResources: [{
        id: 'ready-bode',
        label: 'Ready Bode resource',
        type: 'INTERACTIVE_COMP',
        renderTarget: '/interactive-learning/resources/ready-bode',
        knowledgeNodeIds: ['Bode图_1_1'],
        planningOverride: {
          abilityImpact: { controlModeling: 0.3 },
          evidenceInstrumentation: ['resource_interaction'],
          estimatedTimeMinutes: 8,
        },
      }],
    });
    const result = buildResourceFieldCompletionAudit({
      registry,
      generatedAt: '2026-06-22T00:00:00.000Z',
      candidates: [{
        id: 'runtime-step:3-5:step-01',
        title: '回到地图',
        family: 'runtime-lesson-step',
        sourcePathOrUrl: 'course-content/runtime/lessons/3-5/interactive-manifest.json',
        sourceRecord: '3-5:step-01',
        segmentRefs: ['step-01'],
        citationTargets: [],
        pathTarget: '/interactive-learning/courses/3-5',
        evidenceInstrumentation: ['interactive_step_event'],
        versionRef: 'interactive-manifest.v2',
      }],
    });

    expect({
      artifactVersion: result.summary.artifactVersion,
      totalRows: result.rows.length,
      totals: result.summary.totals,
      families: Object.keys(result.summary.byFamily).sort(),
      studentDiagnostics: result.summary.roleSafeSummary.student.exposeInternalDiagnostics,
      teacherAdminDiagnostics: result.summary.roleSafeSummary.teacherAdmin.exposeInternalDiagnostics,
    }).toMatchInlineSnapshot(`
      {
        "artifactVersion": "resource-field-completion-audit.v1",
        "families": [
          "registered-resource",
          "runtime-lesson-step",
        ],
        "studentDiagnostics": false,
        "teacherAdminDiagnostics": true,
        "totalRows": 2,
        "totals": {
          "artifactVersion": "resource-field-completion-audit.v1",
          "blocked": 2,
          "citationReady": 1,
          "complete": 0,
          "denominator": 2,
          "humanConfirmed": 0,
          "limitationReasons": [
            "missing fields: missing-capability-target, missing-citation-target, missing-content-hash, missing-evidence-contract, missing-human-review, missing-knowledge-binding, missing-path-profile",
            "missing fields: missing-content-hash",
          ],
          "missingField": 2,
          "missingFieldCodes": [
            "missing-capability-target",
            "missing-citation-target",
            "missing-content-hash",
            "missing-evidence-contract",
            "missing-human-review",
            "missing-knowledge-binding",
            "missing-path-profile",
          ],
          "pathEligible": 1,
          "provisional": 0,
          "sampleLimitations": [
            "registry:ready-bode: missing fields: missing-content-hash",
            "runtime-step:3-5:step-01: missing fields: missing-capability-target, missing-citation-target, missing-content-hash, missing-evidence-contract, missing-human-review, missing-knowledge-binding, missing-path-profile",
          ],
          "sourceWindow": {
            "from": null,
            "to": "2026-06-22T00:00:00.000Z",
          },
        },
      }
    `);
  });
});

function coverageSummary(
  overrides: Partial<ResourceFieldCompletionCoverageSummary> = {},
): ResourceFieldCompletionCoverageSummary {
  return {
    complete: 0,
    missingField: 1,
    provisional: 1,
    humanConfirmed: 0,
    citationReady: 0,
    pathEligible: 0,
    blocked: 1,
    denominator: 1,
    sourceWindow: { from: null, to: '2026-06-22T00:00:00.000Z' },
    missingFieldCodes: ['provisional-metadata'],
    limitationReasons: ['metadata is provisional'],
    sampleLimitations: [],
    artifactVersion: RESOURCE_FIELD_COMPLETION_AUDIT_VERSION,
    ...overrides,
  };
}
