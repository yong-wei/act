import { describe, expect, it } from 'vitest';
import {
  RESOURCE_NODE_TYPES,
  auditResourceNode,
  buildResourceNodeRegistry,
  type ResourceNode,
} from '../resource-node-registry';

function sampleRegistry() {
  return buildResourceNodeRegistry({
    teachingResources: [
      {
        id: 'tr-video',
        title: 'Bode 视频',
        type: 'STATIC_MEDIA',
        content: 'bode.mp4',
        knowledgeNodeIds: ['kn-bode'],
      },
      {
        id: 'tr-quiz',
        title: '频域后测',
        type: 'INTERACTIVE_COMP',
        registryId: 'lesson12-bode-post-quiz',
        knowledgeNodeIds: ['kn-bode'],
      },
    ],
    registeredResources: [
      {
        id: 'lesson12-bode-post-quiz',
        label: '伯德图后测',
        type: 'INTERACTIVE_COMP',
        renderTarget: '/teacher/resources',
        knowledgeNodeIds: ['kn-bode'],
      },
    ],
    knowledgeNodes: [
      { id: 'kn-bode', name: '伯德图' },
    ],
    runtimeLessons: [
      {
        lessonId: 'unit-2-3-frequency-response-bode-intro',
        title: '频率响应入门',
        steps: [
          {
            id: 'step-01',
            title: '频域入口',
            knowledgeNodeIds: ['kn-bode'],
            renderTarget: '/interactive-learning/courses/unit-2-3-frequency-response-bode-intro/student/demo?step=step-01',
          },
        ],
        handoutPdfPath: '/course-runtime/lessons/2-3/handout.pdf',
        mediaResources: [
          {
            id: 'intro-video',
            title: '频域导入视频',
            kind: 'video',
            url: 'https://example.test/video.mp4',
            teachingResourceId: 'tr-video',
          },
          {
            id: 'intro-audio',
            title: '频域导入音频',
            kind: 'audio',
            url: 'https://example.test/audio.mp3',
          },
        ],
      },
    ],
    simulations: [
      {
        id: 'cruise',
        title: '邮轮舒适度仿真',
        launchTarget: '/simulations/cruise',
        knowledgeNodeIds: ['kn-bode'],
      },
    ],
    arenaTasks: [
      {
        id: 'roll-control',
        title: '横摇控制 Arena',
        launchTarget: '/arena/challenges/roll-control',
        knowledgeNodeIds: ['kn-bode'],
        prerequisiteNodeIds: ['simulation:cruise'],
        official: true,
      },
    ],
    reflectionPrompts: [
      {
        id: 'reflection-1',
        title: '频域反思',
        renderTarget: '/profile/growth?prompt=reflection-1',
        knowledgeNodeIds: ['kn-bode'],
      },
    ],
    aiInterventions: [
      {
        id: 'hint-bode',
        title: '伯德图提示',
        renderTarget: '/ai/copilot?context=bode',
        knowledgeNodeIds: ['kn-bode'],
      },
    ],
    projects: [
      {
        id: 'bode-project',
        title: '伯德图项目',
        launchTarget: '/missions?project=bode',
        knowledgeNodeIds: ['kn-bode'],
        prerequisiteNodeIds: ['arena-task:roll-control'],
      },
    ],
  });
}

describe('resource node registry', () => {
  it('registers every supported path-plannable resource type with stable source references', () => {
    const registry = sampleRegistry();

    expect(registry.supportedTypes).toEqual(RESOURCE_NODE_TYPES);
    expect(new Set(registry.nodes.map((node) => node.type))).toEqual(new Set(RESOURCE_NODE_TYPES));
    expect(registry.nodes.every((node) => node.id && node.title && node.sourceKind && node.sourceRef)).toBe(true);
    expect(registry.nodes.every((node) => 'renderTarget' in node && 'launchTarget' in node)).toBe(true);
  });

  it('keeps runtime media and TeachingResource ownership separate when sources overlap', () => {
    const registry = sampleRegistry();
    const runtimeVideo = registry.nodes.find((node) =>
      node.id === 'runtime-media:unit-2-3-frequency-response-bode-intro:intro-video'
    );

    expect(runtimeVideo).toMatchObject({
      type: 'video',
      sourceKind: 'runtime_lesson_media',
      sourceOfRecord: {
        content: 'runtime_lesson_media',
        catalogMetadata: 'TeachingResource',
        planningMetadata: 'ResourceNode',
      },
    });
    expect(runtimeVideo?.sourceRefs).toEqual([
      { kind: 'runtime_lesson_media', ref: 'unit-2-3-frequency-response-bode-intro:intro-video' },
      { kind: 'teaching_resource', ref: 'tr-video' },
    ]);
  });

  it('builds deterministic edges and payloads for unchanged source resources', () => {
    const first = sampleRegistry();
    const second = sampleRegistry();

    expect(first).toEqual(second);
    expect(first.edges).toEqual([
      {
        id: 'arena-task:roll-control->project:bode-project:prerequisite',
        fromNodeId: 'arena-task:roll-control',
        toNodeId: 'project:bode-project',
        kind: 'prerequisite',
        source: 'declared-prerequisite',
      },
      {
        id: 'simulation:cruise->arena-task:roll-control:prerequisite',
        fromNodeId: 'simulation:cruise',
        toNodeId: 'arena-task:roll-control',
        kind: 'prerequisite',
        source: 'declared-prerequisite',
      },
    ]);
  });

  it('marks incomplete resources as path-ineligible with teacher-facing reasons', () => {
    const registry = buildResourceNodeRegistry({
      teachingResources: [
        {
          id: 'broken',
          title: '缺失资源',
          type: 'STATIC_TEXT',
        },
      ],
    });

    expect(registry.audit.ineligibleNodes).toEqual([
      {
        id: 'teaching-resource:broken',
        title: '缺失资源',
        type: 'lesson_step',
        reasons: [
          'missing-render-or-launch-target',
          'missing-knowledge-mapping',
        ],
      },
    ]);
  });

  it('does not fabricate a launch route for registry-only components', () => {
    const registry = buildResourceNodeRegistry({
      registeredResources: [
        {
          id: 'lesson12-bode-post-quiz',
          label: '伯德图后测',
          type: 'INTERACTIVE_COMP',
          knowledgeNodeIds: ['kn-bode'],
        },
      ],
    });

    const node = registry.nodes[0];

    expect(node).toMatchObject({
      id: 'registry:lesson12-bode-post-quiz',
      renderTarget: null,
      launchTarget: null,
      eligibility: {
        pathEligible: false,
        reasons: ['missing-render-or-launch-target'],
      },
    });
    expect(JSON.stringify(node)).not.toContain('/interactive-learning/resources/lesson12-bode-post-quiz');
  });

  it('does not infer registry-only knowledge coverage from ids', () => {
    const registry = buildResourceNodeRegistry({
      registeredResources: [
        {
          id: 'lesson12-bode-post-quiz',
          label: '伯德图后测',
          type: 'INTERACTIVE_COMP',
          renderTarget: '/teacher/resources',
        },
      ],
    });

    const node = registry.nodes[0];

    expect(node.planningMetadata.knowledgeCoverage).toEqual([]);
    expect(node.eligibility).toMatchObject({
      pathEligible: false,
      reasons: ['missing-knowledge-mapping'],
    });
  });

  it('does not fabricate routes for knowledge graph nodes or runtime lesson steps', () => {
    const registry = buildResourceNodeRegistry({
      knowledgeNodes: [
        { id: 'kn-bode', name: '伯德图' },
      ],
      runtimeLessons: [
        {
          lessonId: 'unit-2-3-frequency-response-bode-intro',
          title: '频率响应入门',
          steps: [
            {
              id: 'step-01',
              title: '频域入口',
              knowledgeNodeIds: ['kn-bode'],
            },
          ],
        },
      ],
    });

    const knowledgeNode = registry.nodes.find((node) => node.id === 'knowledge-node:kn-bode');
    const knowledgeCard = registry.nodes.find((node) => node.id === 'knowledge-card:kn-bode');
    const lessonStep = registry.nodes.find(
      (node) => node.id === 'lesson-step:unit-2-3-frequency-response-bode-intro:step-01',
    );

    expect(knowledgeNode).toMatchObject({
      renderTarget: null,
      launchTarget: null,
      eligibility: {
        pathEligible: false,
        reasons: ['missing-render-or-launch-target'],
      },
    });
    expect(knowledgeCard).toMatchObject({
      renderTarget: null,
      launchTarget: null,
      eligibility: {
        pathEligible: false,
        reasons: ['missing-render-or-launch-target'],
      },
    });
    expect(lessonStep).toMatchObject({
      renderTarget: null,
      launchTarget: null,
      eligibility: {
        pathEligible: false,
        reasons: ['missing-render-or-launch-target'],
      },
    });
    expect(JSON.stringify(registry.nodes)).not.toContain('/knowledge?node=');
    expect(JSON.stringify(registry.nodes)).not.toContain('/knowledge?card=');
    expect(JSON.stringify(registry.nodes)).not.toContain('#step-01');
  });

  it('audits invalid prerequisites without hiding other metadata', () => {
    const registry = sampleRegistry();
    const project = registry.nodes.find((node) => node.id === 'project:bode-project') as ResourceNode;
    const eligibility = auditResourceNode({
      ...project,
      planningMetadata: {
        ...project.planningMetadata,
        prerequisites: ['missing-node'],
      },
    }, new Map(registry.nodes.map((node) => [node.id, node])));

    expect(eligibility.pathEligible).toBe(false);
    expect(eligibility.auditIssues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'invalid-prerequisite',
          message: expect.stringContaining('missing-node'),
        }),
      ]),
    );
  });
});
