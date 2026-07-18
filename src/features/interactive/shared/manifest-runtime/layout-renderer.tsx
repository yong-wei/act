import { Fragment, createElement, type ReactNode } from 'react';
import { InlineMath } from 'react-katex';

import type {
  InteractiveRuntimeManifest,
  InteractiveRuntimeModuleManifest,
  InteractiveRuntimeStepManifest,
} from '@/lib/interactive-lesson-manifest';
import {
  adaptGeneratedSlideManifestToInteractiveRuntime,
  GENERATED_ACTIVITY_CLASS,
  GENERATED_SLIDE_ASPECT_RATIO,
  GENERATED_SLIDE_LAYOUT_REGISTRY,
  GENERATED_SLIDE_SCHEMA_VERSION,
  GENERATED_SLIDE_TEXT_BUDGET_REGISTRY,
  computeGeneratedSlideContentHash,
  resolveGeneratedSlideTypographyFit,
  type GeneratedSlideManifest,
  type GeneratedModuleClass,
  type GeneratedSlideModule,
} from './generated-slide-contract';
import type { GeneratedSlideProjection } from './generated-slide-browser-validation';
import {
  isActivityRuntimeModuleKind,
  resolveInteractiveModuleVisualStandard,
} from './module-visual-standards';

export type {
  InteractiveRuntimeManifest,
  InteractiveRuntimeModuleManifest,
  InteractiveRuntimeStepManifest,
} from '@/lib/interactive-lesson-manifest';

export interface InteractiveLayoutRegionNode {
  moduleId: string;
  regionId: string;
  node: ReactNode;
}

export interface InteractiveModuleRendererProps<TExtra = undefined> {
  manifest: InteractiveRuntimeManifest;
  step: InteractiveRuntimeStepManifest;
  module: InteractiveRuntimeModuleManifest;
  extra: TExtra;
}

export type InteractiveModuleRegistry<TExtra = undefined> = Record<
  string,
  (props: InteractiveModuleRendererProps<TExtra>) => ReactNode
>;

type InteractiveTemplateRenderer = (props: {
  step: InteractiveRuntimeStepManifest;
  regionNodes: InteractiveLayoutRegionNode[];
}) => ReactNode;

const GENERATED_SLIDE_CANVAS_WIDTH = 1600;
const GENERATED_SLIDE_CANVAS_HEIGHT = 900;
const GENERATED_SLIDE_TITLE_HEIGHT = 112;

export type GeneratedSlideStep = GeneratedSlideManifest['stages'][number]['steps'][number];

export interface GeneratedSlideActivityRendererProps<TExtra = undefined>
  extends InteractiveModuleRendererProps<TExtra> {
  projection: GeneratedSlideProjection;
}

export type GeneratedSlideActivityRenderer<TExtra = undefined> = (
  props: GeneratedSlideActivityRendererProps<TExtra>,
) => ReactNode;

function isGeneratedSlideStep(
  step: InteractiveRuntimeStepManifest | GeneratedSlideStep,
): step is GeneratedSlideStep {
  return 'layoutId' in step;
}

function buildOrderedRegions(
  step: InteractiveRuntimeStepManifest,
  regionNodes: InteractiveLayoutRegionNode[],
) {
  const grouped = new Map<string, InteractiveLayoutRegionNode[]>();

  for (const node of regionNodes) {
    const bucket = grouped.get(node.regionId) ?? [];
    bucket.push(node);
    grouped.set(node.regionId, bucket);
  }

  return [...step.layout.regions]
    .sort((left, right) => left.order - right.order)
    .map((region) => ({
      region,
      nodes: grouped.get(region.id) ?? [],
    }))
    .filter((entry) => entry.nodes.length > 0);
}

function renderStackedTemplate({
  step,
  regionNodes,
}: {
  step: InteractiveRuntimeStepManifest;
  regionNodes: InteractiveLayoutRegionNode[];
}) {
  const orderedRegions = buildOrderedRegions(step, regionNodes);

  return createElement(
    'div',
    { 'data-template': step.layout.template, className: 'interactive-courseware-stack' },
    orderedRegions.map(({ region, nodes }) =>
      createElement(
        'section',
        {
          key: region.id,
          'data-region': region.id,
          'data-width': region.width,
          className: 'interactive-courseware-region',
        },
        nodes.map((item) => createElement(Fragment, { key: item.moduleId }, item.node)),
      ),
    ),
  );
}

function renderGeneratedSlideTemplate({
  step,
  regionNodes,
  titleNode,
  contentHash,
}: {
  step: GeneratedSlideStep;
  regionNodes: InteractiveLayoutRegionNode[];
  titleNode?: ReactNode;
  contentHash?: string;
}) {
  const layout = GENERATED_SLIDE_LAYOUT_REGISTRY[step.layoutId as keyof typeof GENERATED_SLIDE_LAYOUT_REGISTRY];
  if (!layout) {
    return createElement(
      'div',
      {
        'data-generated-slide-render-error': step.id,
        'data-generated-slide-layout': step.layoutId,
        role: 'alert',
      },
      `Unregistered generated slide layout: ${step.layoutId}`,
    );
  }

  const grouped = new Map<string, InteractiveLayoutRegionNode[]>();
  for (const node of regionNodes) {
    const bucket = grouped.get(node.regionId) ?? [];
    bucket.push(node);
    grouped.set(node.regionId, bucket);
  }
  const modulesBySlot = new Map(step.modules.map((module) => [module.slotId, module]));

  return createElement(
    'div',
    {
      'data-generated-slide-step': step.id,
      'data-generated-slide-contract': GENERATED_SLIDE_SCHEMA_VERSION,
      'data-generated-slide-aspect-ratio': GENERATED_SLIDE_ASPECT_RATIO,
      'data-generated-slide-role-states': 'student teacher',
      'data-generated-slide-scaling': 'whole-canvas',
      'data-generated-slide-overflow-policy': 'visible',
      'data-generated-slide-internal-scroll': 'false',
      'data-generated-slide-truncation': 'false',
      className: 'generated-slide-viewport',
      style: {
        width: '100%',
        aspectRatio: '16 / 9',
        containerType: 'inline-size',
        position: 'relative',
        overflow: 'visible',
      },
    },
    [
      createElement('style', { key: 'slide-safe-style' }, `
        .generated-slide-viewport [data-generated-slide-module-root] {
          display: grid;
          font-size: inherit;
          min-width: 0;
          overflow: visible;
        }
        .generated-slide-viewport [data-generated-slide-module-class="content.formula"] [data-generated-slide-module-root] .overflow-x-auto,
        .generated-slide-viewport [data-generated-slide-module-class="content.table"] [data-generated-slide-module-root] .overflow-x-auto,
        .generated-slide-viewport [data-generated-slide-module-class="content.reveal"] [data-generated-slide-module-root] .overflow-x-auto {
          overflow-x: visible;
        }
        .generated-slide-viewport [data-generated-slide-module-class="content.table"] [data-generated-slide-module-root] > .interactive-courseware-panel {
          overflow: visible;
        }
        .generated-slide-viewport [data-generated-slide-module-class="content.code"] [data-generated-slide-module-root] .premium-code-block {
          overflow: visible;
          white-space: pre-wrap;
          overflow-wrap: anywhere;
        }
        .generated-slide-viewport [data-generated-slide-module-class="content.rich"] [data-generated-slide-module-root] .interactive-courseware-title-level-2,
        .generated-slide-viewport [data-generated-slide-module-class="content.cardSet"] [data-generated-slide-module-root] .interactive-courseware-title-level-2,
        .generated-slide-viewport [data-generated-slide-module-class="content.formula"] [data-generated-slide-module-root] .interactive-courseware-title-level-2,
        .generated-slide-viewport [data-generated-slide-module-class="content.table"] [data-generated-slide-module-root] .interactive-courseware-title-level-2,
        .generated-slide-viewport [data-generated-slide-module-class="content.code"] [data-generated-slide-module-root] :where(.interactive-courseware-title-level-2, .premium-code-block),
        .generated-slide-viewport [data-generated-slide-module-class="content.reveal"] [data-generated-slide-module-root] .interactive-courseware-title-level-2 {
          font-size: inherit;
          line-height: 1.25;
        }
        .generated-slide-viewport [data-generated-slide-module-class="content.code"] [data-generated-slide-module-root] .premium-lesson-chip {
          font-size: inherit;
        }
        .generated-slide-viewport [data-generated-slide-module-class="content.rich"] [data-generated-slide-module-root] .interactive-courseware-body,
        .generated-slide-viewport [data-generated-slide-module-class="content.cardSet"] [data-generated-slide-module-root] .interactive-courseware-body,
        .generated-slide-viewport [data-generated-slide-module-class="content.formula"] [data-generated-slide-module-root] .interactive-courseware-body,
        .generated-slide-viewport [data-generated-slide-module-class="content.table"] [data-generated-slide-module-root] .interactive-courseware-body,
        .generated-slide-viewport [data-generated-slide-module-class="content.code"] [data-generated-slide-module-root] .interactive-courseware-body,
        .generated-slide-viewport [data-generated-slide-module-class="content.reveal"] [data-generated-slide-module-root] :where(.interactive-courseware-body, .interactive-courseware-title-level-3, .interactive-courseware-caption) {
          font-size: inherit;
          line-height: 1.25;
        }
        .generated-slide-viewport [data-generated-slide-module-class="content.code"] [data-generated-slide-module-root] .premium-code-line {
          white-space: pre-wrap;
        }
      `),
      createElement(
      'article',
      {
        key: 'canvas',
        'data-generated-slide-canvas': step.id,
        ...(contentHash ? { 'data-generated-slide-content-hash': contentHash } : {}),
        'data-template': step.layoutId,
        'data-canvas-width': GENERATED_SLIDE_CANVAS_WIDTH,
        'data-canvas-height': GENERATED_SLIDE_CANVAS_HEIGHT,
        className: 'generated-slide-canvas',
        style: {
          width: `${GENERATED_SLIDE_CANVAS_WIDTH}px`,
          height: `${GENERATED_SLIDE_CANVAS_HEIGHT}px`,
          position: 'absolute',
          inset: 0,
          display: 'grid',
          gridTemplateRows: `${GENERATED_SLIDE_TITLE_HEIGHT}px minmax(0, 1fr)`,
          transform: `scale(calc(100cqw / ${GENERATED_SLIDE_CANVAS_WIDTH}px))`,
          transformOrigin: 'top left',
          overflow: 'visible',
        },
      },
      [
        createElement(
          'header',
          {
            key: 'title',
            'data-generated-slide-title-slot': 'title',
            'data-generated-slide-role-states': 'student teacher',
            style: { overflow: 'visible' },
          },
          titleNode ?? createElement('h1', null, step.title),
        ),
        createElement(
          'div',
          {
            key: 'slots',
            'data-generated-slide-slot-grid': step.layoutId,
            style: {
              display: 'grid',
              gridTemplateColumns: `repeat(${layout.columns}, minmax(0, 1fr))`,
              gridTemplateRows: `repeat(${layout.rows}, minmax(0, 1fr))`,
              minHeight: 0,
              overflow: 'visible',
            },
          },
          layout.slots.map((slot) => {
            const generatedModule = modulesBySlot.get(slot.id);
            const textBudget = generatedModule
              ? GENERATED_SLIDE_TEXT_BUDGET_REGISTRY[generatedModule.canonicalClass as GeneratedModuleClass]
              : undefined;
            const typographyFit = generatedModule
              ? resolveGeneratedSlideTypographyFit(generatedModule)
              : undefined;
            const bounds = getGeneratedSlideSlotBounds(slot.cells);
            const nodes = grouped.get(slot.id) ?? [];
            return createElement(
              'section',
              {
                key: slot.id,
                'data-generated-slide-slot': slot.id,
                'data-generated-slide-slot-size': slot.sizeId,
                'data-generated-slide-student-visible': roleMetadataValue(generatedModule, 'studentVisible'),
                'data-generated-slide-teacher-visible': roleMetadataValue(generatedModule, 'teacherVisible'),
                'data-generated-slide-reference-answer': generatedModule?.roleMetadata.referenceAnswerVisibility ?? 'none',
                'data-generated-slide-module': generatedModule?.id,
                'data-generated-slide-module-class': generatedModule?.canonicalClass,
                'data-generated-slide-normal-font-px': textBudget?.normalFontPx,
                'data-generated-slide-minimum-font-px': textBudget?.minimumFontPx,
                'data-generated-slide-font-fit': typographyFit?.state,
                ...(typographyFit?.state === 'unfit'
                  ? { 'data-generated-slide-unfit': generatedModule?.id }
                  : {}),
                'data-region': slot.id,
                style: {
                  gridColumn: `${bounds.columnStart} / ${bounds.columnEnd}`,
                  gridRow: `${bounds.rowStart} / ${bounds.rowEnd}`,
                  minWidth: 0,
                  minHeight: 0,
                  overflow: 'visible',
                  whiteSpace: 'normal',
                  ...(textBudget ? {
                    fontSize: `${typographyFit?.fontSizePx ?? textBudget.normalFontPx}px`,
                    '--generated-slide-normal-font-px': `${textBudget.normalFontPx}px`,
                    '--generated-slide-minimum-font-px': `${textBudget.minimumFontPx}px`,
                  } : {}),
                },
              },
              [
                ...(typographyFit?.state === 'unfit'
                  ? [createElement(
                    'div',
                    { key: 'unfit', role: 'alert', 'data-generated-slide-unfit-warning': generatedModule?.id },
                    '内容超过该版式的最小可读字号容量。',
                  )]
                  : []),
                ...nodes.map((item) => createElement(Fragment, { key: item.moduleId }, item.node)),
              ],
            );
          }),
        ),
      ],
      ),
    ],
  );
}

function roleMetadataValue(
  generatedModule: GeneratedSlideModule | undefined,
  key: 'studentVisible' | 'teacherVisible',
) {
  return generatedModule ? String(generatedModule.roleMetadata[key]) : 'unassigned';
}

function getGeneratedSlideSlotBounds(cells: readonly string[]) {
  const coordinates = cells.map((cell) => cell.split(':').map(Number) as [number, number]);
  const columns = coordinates.map(([column]) => column);
  const rows = coordinates.map(([, row]) => row);
  return {
    columnStart: Math.min(...columns) + 1,
    columnEnd: Math.max(...columns) + 2,
    rowStart: Math.min(...rows) + 1,
    rowEnd: Math.max(...rows) + 2,
  };
}

function renderManifestModuleError({
  step,
  module,
  reason,
}: {
  step: InteractiveRuntimeStepManifest;
  module: InteractiveRuntimeModuleManifest;
  reason: string;
}) {
  return createElement(
    'div',
    {
      'data-manifest-render-error': `${step.id}:${module.id}`,
      className:
        'rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm leading-6 text-rose-900',
    },
    [
      createElement('div', { key: 'title', className: 'font-semibold' }, '互动页模块渲染缺失'),
      createElement(
        'div',
        { key: 'detail' },
        `${step.id} / ${module.id} / ${module.kind}: ${reason}`,
      ),
    ],
  );
}

function renderCommercialModuleChrome({
  module,
  node,
  generatedSlideSafe = false,
}: {
  module: InteractiveRuntimeModuleManifest;
  node: ReactNode;
  generatedSlideSafe?: boolean;
}) {
  const standard = resolveInteractiveModuleVisualStandard(module.kind);
  const roleStates = standard?.roleStates.join(' ') ?? 'student guest teacher';
  const themeStates = standard?.themeStates.join(' ') ?? 'light dark';
  const viewportStates = standard?.viewportStates.join(' ') ?? 'desktop mobile projection';
  const teacherControlScope = standard?.teacherControlAttachment === 'module' ? module.id : 'none';

  return createElement(
    'section',
    {
      'data-commercial-module-chrome': module.kind,
      'data-interactive-module-standard-class': standard?.canonicalClass ?? 'unregistered',
      'data-interactive-module-chrome-category': standard?.chromeCategory ?? 'fallback',
      'data-interactive-module-role-states': roleStates,
      'data-interactive-module-theme-states': themeStates,
      'data-interactive-module-viewport-states': viewportStates,
      'data-interactive-module-projection-safe': String(standard?.projectionSafe === true),
      'data-interactive-module-geometry': standard?.geometry ?? 'stable-panel',
      'data-interactive-module-teacher-controls': standard?.teacherControlAttachment ?? 'none',
      'data-interactive-module-control-scope': teacherControlScope,
      'data-interactive-module-chrome-role': 'metadata-only',
      'data-commercial-module-state': module.mustBeVisible ? 'required' : 'available',
      ...(generatedSlideSafe ? {
        'data-generated-slide-safe-content': module.id,
        'data-generated-slide-module-root': module.id,
      } : {}),
      'data-commercial-workspace-zone': 'instrument-area',
      'data-task-workspace-zone': 'instrument-area',
      className: [
        'commercial-module-chrome min-h-[120px]',
        'commercial-module-chrome--stable-panel commercial-module-chrome--projection-readable',
        standard?.chromeClassName ?? 'commercial-module-chrome--fallback',
      ].join(' '),
    },
    node,
  );
}

function stringFromContentBlock(value: unknown): string {
  if (typeof value === 'string') return value.trim();
  if (!value || typeof value !== 'object' || Array.isArray(value)) return '';

  const record = value as Record<string, unknown>;
  const candidates = [
    record.text,
    record.summary,
    record.description,
    record.intro,
    record.body,
    record.content,
  ];

  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim()) {
      return candidate.trim();
    }
  }

  return '';
}

function getStepDescription(step: InteractiveRuntimeStepManifest) {
  const titleDescriptionPolicy = step.contentBlocks.title_description_policy;
  if (
    titleDescriptionPolicy
    && typeof titleDescriptionPolicy === 'object'
    && !Array.isArray(titleDescriptionPolicy)
    && (titleDescriptionPolicy as Record<string, unknown>).hide === true
  ) {
    return '';
  }

  const candidates = [
    step.aiContextSpec.pageGoal,
    step.interactionSpec.studentTask,
    stringFromContentBlock(step.contentBlocks.page_intro),
    stringFromContentBlock(step.contentBlocks.title_card),
    stringFromContentBlock(step.contentBlocks.summary),
  ];

  return candidates.find((candidate) => candidate?.trim())?.trim() ?? '本页围绕当前主题组织对象、证据和判断任务。';
}

function normalizeMath(value: string) {
  return value
    .trim()
    .replace(/^\$/, '')
    .replace(/\$$/, '')
    .replace(/\\\\/g, '\\');
}

function renderLayoutInlineContent(text: string) {
  const parts = text.split(/(\$[^$]+\$)/g).filter(Boolean);
  return parts.map((part, index) => {
    if (part.startsWith('$') && part.endsWith('$')) {
      return createElement(InlineMath, { key: `${part}-${index}`, math: normalizeMath(part) });
    }
    return createElement(Fragment, { key: `${part}-${index}` }, part);
  });
}

function renderStepTitleModule({
  manifest,
  step,
}: {
  manifest: InteractiveRuntimeManifest;
  step: InteractiveRuntimeStepManifest;
}) {
  const stepIndex = manifest.stepOrder.indexOf(step.id);
  const pageNumber = stepIndex >= 0 ? stepIndex + 1 : manifest.steps.findIndex((item) => item.id === step.id) + 1;
  const total = manifest.stepOrder.length || manifest.steps.length;
  const width = Math.max(2, String(total).length);
  const pageLabel = pageNumber > 0 ? `第 ${String(pageNumber).padStart(width, '0')} 页` : '课程页面';

  return createElement(
    'section',
    {
      'data-manifest-step-title': step.id,
      'data-commercial-workspace': 'interactive-learning',
      'data-commercial-workspace-zone': 'context-strip',
      'data-courseware-panel-exterior': 'title-panel',
      className: 'premium-lesson-panel interactive-courseware-panel',
    },
    [
      createElement('div', { key: 'kicker', className: 'premium-lesson-kicker' }, pageLabel),
      createElement('h1', { key: 'title', className: 'interactive-courseware-title-level-1' }, renderLayoutInlineContent(step.title)),
      getStepDescription(step)
        ? createElement('p', { key: 'description', className: 'interactive-courseware-body' }, renderLayoutInlineContent(getStepDescription(step)))
        : null,
    ],
  );
}

export const INTERACTIVE_TEMPLATE_REGISTRY: Record<string, InteractiveTemplateRenderer> = {
  stacked_regions: renderStackedTemplate,
  map_goal_boundary_slide: renderStackedTemplate,
  question_stack: renderStackedTemplate,
  comparison_panel_with_sort: renderStackedTemplate,
  formula_table_reasoning: renderStackedTemplate,
  compound_structure_board: renderStackedTemplate,
  case_evidence_board: renderStackedTemplate,
  worked_example_compare: renderStackedTemplate,
  validation_issue_board: renderStackedTemplate,
  task_card_workspace: renderStackedTemplate,
  boundary_case_board: renderStackedTemplate,
  summary_quiz_board: renderStackedTemplate,
};

export function renderInteractiveLessonLayout({
  step,
  regionNodes,
  titleNode,
  contentHash,
  templateRegistry = INTERACTIVE_TEMPLATE_REGISTRY,
}: {
  step: InteractiveRuntimeStepManifest | GeneratedSlideStep;
  regionNodes: InteractiveLayoutRegionNode[];
  titleNode?: ReactNode;
  contentHash?: string;
  templateRegistry?: Record<string, InteractiveTemplateRenderer>;
}) {
  if (isGeneratedSlideStep(step)) {
    return renderGeneratedSlideTemplate({
      step,
      regionNodes,
      titleNode,
      contentHash,
    });
  }

  const renderer = templateRegistry[step.layout.template] ?? renderStackedTemplate;
  return renderer({ step, regionNodes });
}

export function renderInteractiveManifestStep<TExtra = undefined>({
  manifest,
  step,
  moduleRegistry,
  extra,
}: {
  manifest: InteractiveRuntimeManifest;
  step: InteractiveRuntimeStepManifest;
  moduleRegistry: InteractiveModuleRegistry<TExtra>;
  extra: TExtra;
}) {
  const regionNodes: InteractiveLayoutRegionNode[] = step.modules
    .map((module) => {
      if (isActivityRuntimeModuleKind(module.kind)) {
        return null;
      }
      const renderModule = moduleRegistry[module.kind];
      if (!renderModule) {
        if (module.mustBeVisible) {
          const node = renderManifestModuleError({
            step,
            module,
            reason: '缺少模块 renderer',
          });
          return {
            moduleId: module.id,
            regionId: module.region,
            node: renderCommercialModuleChrome({ module, node }),
          } as InteractiveLayoutRegionNode;
        }
        return null;
      }
      const node = renderModule({
        manifest,
        step,
        module,
        extra,
      });
      if (!node) {
        if (module.mustBeVisible) {
          const errorNode = renderManifestModuleError({
            step,
            module,
            reason: '模块 renderer 返回空内容',
          });
          return {
            moduleId: module.id,
            regionId: module.region,
            node: renderCommercialModuleChrome({ module, node: errorNode }),
          } as InteractiveLayoutRegionNode;
        }
        return null;
      }
      return {
        moduleId: module.id,
        regionId: module.region,
        node: renderCommercialModuleChrome({ module, node }),
      } as InteractiveLayoutRegionNode;
    })
    .filter(Boolean) as InteractiveLayoutRegionNode[];

  return createElement(Fragment, null, [
    createElement(Fragment, { key: 'step-title' }, renderStepTitleModule({ manifest, step })),
    createElement(Fragment, { key: 'step-layout' }, renderInteractiveLessonLayout({ step, regionNodes })),
  ]);
}

export function renderGeneratedSlideManifestStep<TExtra = undefined>({
  generatedManifest,
  generatedStep,
  projection,
  moduleRegistry,
  activityRenderer,
  extra,
}: {
  generatedManifest: GeneratedSlideManifest;
  generatedStep: GeneratedSlideStep;
  projection: GeneratedSlideProjection;
  moduleRegistry: InteractiveModuleRegistry<TExtra>;
  activityRenderer?: GeneratedSlideActivityRenderer<TExtra>;
  extra: TExtra;
}) {
  const adapted = adaptGeneratedSlideManifestToInteractiveRuntime(generatedManifest);
  const mapping = adapted.stepMappings.find((candidate) => candidate.generatedStep.id === generatedStep.id);
  if (!mapping) {
    throw new Error(`Generated slide manifest does not contain step ${generatedStep.id}.`);
  }

  const runtimeManifest = projectGeneratedRuntimeManifest(adapted, projection);
  const runtimeStep = runtimeManifest.steps.find((candidate) => candidate.id === generatedStep.id);
  if (!runtimeStep) {
    throw new Error(`Generated runtime projection does not contain step ${generatedStep.id}.`);
  }
  const generatedModulesById = new Map(mapping.generatedStep.modules.map((module) => [module.id, module]));
  const projectedGeneratedStep: GeneratedSlideStep = {
    ...mapping.generatedStep,
    modules: mapping.generatedStep.modules
      .filter((module) => isGeneratedModuleVisible(module, projection))
      .map((module) => projection === 'student'
        ? {
          ...module,
          roleMetadata: {
            ...module.roleMetadata,
            referenceAnswerVisibility: 'none' as const,
          },
        }
        : module),
  };
  const regionNodes = runtimeStep.modules
    .map((runtimeModule): InteractiveLayoutRegionNode | null => {
      const generatedModule = generatedModulesById.get(runtimeModule.id);
      if (!generatedModule || !isGeneratedModuleVisible(generatedModule, projection)) return null;

      let node: ReactNode;
      if (generatedModule.canonicalClass === GENERATED_ACTIVITY_CLASS) {
        const activityStep = scopeRuntimeStepToActivity(
          runtimeStep,
          runtimeModule.id,
          generatedModule.evidencePath,
        );
        const activityManifest = {
          ...runtimeManifest,
          steps: runtimeManifest.steps.map((step) => step.id === activityStep.id ? activityStep : step),
        };
        node = activityRenderer?.({
          manifest: activityManifest,
          step: activityStep,
          module: runtimeModule,
          extra,
          projection,
        });
      } else {
        node = moduleRegistry[runtimeModule.kind]?.({
          manifest: runtimeManifest,
          step: runtimeStep,
          module: runtimeModule,
          extra,
        });
      }
      if (node) {
        return {
          moduleId: runtimeModule.id,
          regionId: runtimeModule.region,
          node: renderCommercialModuleChrome({ module: runtimeModule, node, generatedSlideSafe: true }),
        };
      }

      const errorNode = renderManifestModuleError({
        step: runtimeStep,
        module: runtimeModule,
        reason: generatedModule.canonicalClass === GENERATED_ACTIVITY_CLASS
          ? '缺少 activity renderer'
          : '缺少模块 renderer',
      });
      return {
        moduleId: runtimeModule.id,
        regionId: runtimeModule.region,
        node: renderCommercialModuleChrome({ module: runtimeModule, node: errorNode, generatedSlideSafe: true }),
      };
    })
    .filter((node): node is InteractiveLayoutRegionNode => Boolean(node));

  return renderInteractiveLessonLayout({
    step: projectedGeneratedStep,
    regionNodes,
    titleNode: renderStepTitleModule({ manifest: runtimeManifest, step: runtimeStep }),
    contentHash: computeGeneratedSlideContentHash(generatedManifest),
  });
}

function projectGeneratedRuntimeManifest(
  adapted: ReturnType<typeof adaptGeneratedSlideManifestToInteractiveRuntime>,
  projection: GeneratedSlideProjection,
): InteractiveRuntimeManifest {
  const generatedStepsById = new Map(
    adapted.stepMappings.map((mapping) => [mapping.generatedStep.id, mapping.generatedStep]),
  );
  return {
    ...adapted.runtimeManifest,
    steps: adapted.runtimeManifest.steps.map((runtimeStep) => {
      const sourceStep = generatedStepsById.get(runtimeStep.id);
      if (!sourceStep) return runtimeStep;
      const visibleModuleIds = new Set(
        sourceStep.modules
          .filter((module) => isGeneratedModuleVisible(module, projection))
          .map((module) => module.id),
      );
      const activityCards = runtimeStep.interactionSpec.activityCards
        ?.filter((card) => visibleModuleIds.has(card.id))
        .map((card) => projection === 'student' ? stripTeacherReferenceData(card) : card);
      return {
        ...runtimeStep,
        modules: runtimeStep.modules.filter((module) => visibleModuleIds.has(module.id)),
        interactionSpec: {
          ...runtimeStep.interactionSpec,
          ...(activityCards ? { activityCards } : {}),
          ...(projection === 'student' ? { answerReveal: undefined } : {}),
        },
      };
    }),
  };
}

function scopeRuntimeStepToActivity(
  runtimeStep: InteractiveRuntimeStepManifest,
  activityId: string,
  evidencePath: string | undefined,
): InteractiveRuntimeStepManifest {
  const activityCards = runtimeStep.interactionSpec.activityCards?.filter((card) => card.id === activityId);
  const currentEvidencePaths = evidencePath ? [evidencePath] : [];
  return {
    ...runtimeStep,
    evidenceSequence: currentEvidencePaths,
    interactionSpec: {
      ...runtimeStep.interactionSpec,
      studentTask: activityCards?.[0]?.prompt,
      activityCards,
      submitFields: currentEvidencePaths,
    },
    telemetrySpec: {
      ...runtimeStep.telemetrySpec,
      summaryFields: currentEvidencePaths,
    },
  };
}

function isGeneratedModuleVisible(
  module: GeneratedSlideModule,
  projection: GeneratedSlideProjection,
) {
  return projection === 'student'
    ? module.roleMetadata.studentVisible
    : module.roleMetadata.teacherVisible;
}

function stripTeacherReferenceData(
  card: NonNullable<InteractiveRuntimeStepManifest['interactionSpec']['activityCards']>[number],
) {
  const {
    referenceAnswer: _referenceAnswer,
    referenceMatches: _referenceMatches,
    ...studentCard
  } = card;
  return studentCard;
}
