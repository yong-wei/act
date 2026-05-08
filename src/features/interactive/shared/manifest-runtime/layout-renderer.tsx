import { Fragment, createElement, type ReactNode } from 'react';
import { InlineMath } from 'react-katex';

import type {
  InteractiveRuntimeManifest,
  InteractiveRuntimeModuleManifest,
  InteractiveRuntimeStepManifest,
} from '@/lib/interactive-lesson-manifest';

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

const ACTIVITY_RUNTIME_MODULE_KINDS = new Set([
  'activity-card',
  'activity-card-grid',
  'activity-card-row',
  'activity-card-set',
  'binary-choice',
  'card-sort',
  'drag-match',
  'hotspot-labeling',
  'reason-chain',
  'multi-select-matrix',
  'task-card-workspace',
  'triple-match',
  'single-choice-card',
  'quiz-card',
  'quiz-group',
  'teacher-reveal-only',
  'table-builder',
]);

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
    { 'data-template': step.layout.template, className: 'space-y-4' },
    orderedRegions.map(({ region, nodes }) =>
      createElement(
        'section',
        {
          key: region.id,
          'data-region': region.id,
          'data-width': region.width,
          className: 'space-y-4',
        },
        nodes.map((item) => createElement(Fragment, { key: item.moduleId }, item.node)),
      ),
    ),
  );
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
      className: 'premium-lesson-panel',
    },
    [
      createElement('div', { key: 'kicker', className: 'premium-lesson-kicker' }, pageLabel),
      createElement('h2', { key: 'title', className: 'premium-lesson-title mt-2 text-2xl font-semibold' }, renderLayoutInlineContent(step.title)),
      getStepDescription(step)
        ? createElement('p', { key: 'description', className: 'premium-lesson-muted mt-2 text-sm leading-7' }, renderLayoutInlineContent(getStepDescription(step)))
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
  templateRegistry = INTERACTIVE_TEMPLATE_REGISTRY,
}: {
  step: InteractiveRuntimeStepManifest;
  regionNodes: InteractiveLayoutRegionNode[];
  templateRegistry?: Record<string, InteractiveTemplateRenderer>;
}) {
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
      if (ACTIVITY_RUNTIME_MODULE_KINDS.has(module.kind)) {
        return null;
      }
      const renderModule = moduleRegistry[module.kind];
      if (!renderModule) {
        if (module.mustBeVisible) {
          return {
            moduleId: module.id,
            regionId: module.region,
            node: renderManifestModuleError({
              step,
              module,
              reason: '缺少模块 renderer',
            }),
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
          return {
            moduleId: module.id,
            regionId: module.region,
            node: renderManifestModuleError({
              step,
              module,
              reason: '模块 renderer 返回空内容',
            }),
          } as InteractiveLayoutRegionNode;
        }
        return null;
      }
      return {
        moduleId: module.id,
        regionId: module.region,
        node,
      } as InteractiveLayoutRegionNode;
    })
    .filter(Boolean) as InteractiveLayoutRegionNode[];

  return createElement(Fragment, null, [
    createElement(Fragment, { key: 'step-title' }, renderStepTitleModule({ manifest, step })),
    createElement(Fragment, { key: 'step-layout' }, renderInteractiveLessonLayout({ step, regionNodes })),
  ]);
}
