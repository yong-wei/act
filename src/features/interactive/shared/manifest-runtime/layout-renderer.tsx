import { Fragment, createElement, type ReactNode } from 'react';

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

  return renderInteractiveLessonLayout({ step, regionNodes });
}
