import { Fragment, createElement, type ReactNode } from 'react';

import type {
  InteractiveRuntimeManifest,
  InteractiveRuntimeModuleManifest,
  InteractiveRuntimeStepManifest,
} from '@/lib/interactive-lesson-manifest';

export type { InteractiveRuntimeManifest, InteractiveRuntimeStepManifest } from '@/lib/interactive-lesson-manifest';

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
      const renderModule = moduleRegistry[module.kind];
      if (!renderModule) {
        return null;
      }
      const node = renderModule({
        manifest,
        step,
        module,
        extra,
      });
      if (!node) {
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

export type StudentInteractiveActivityRendererProps<TStep, TResponse> = {
  step: TStep;
  stepManifest: InteractiveRuntimeStepManifest;
  savedResponse?: TResponse;
  released: boolean;
  browseEnabled: boolean;
  answerVisible: boolean;
  revealProgress: number;
  onSubmit: (response: TResponse) => void;
};

export type StudentInteractiveActivityRegistry<TStep, TResponse> = Record<
  string,
  (props: StudentInteractiveActivityRendererProps<TStep, TResponse>) => ReactNode
>;

export function renderStudentInteractiveActivity<TStep, TResponse>({
  registry,
  step,
  stepManifest,
  savedResponse,
  released,
  browseEnabled,
  answerVisible,
  revealProgress,
  onSubmit,
}: {
  registry: StudentInteractiveActivityRegistry<TStep, TResponse>;
  step: TStep;
  stepManifest: InteractiveRuntimeStepManifest;
  savedResponse?: TResponse;
  released: boolean;
  browseEnabled: boolean;
  answerVisible: boolean;
  revealProgress: number;
  onSubmit: (response: TResponse) => void;
}) {
  const Renderer = registry[stepManifest.interactionSpec.interactionKind];
  if (!Renderer) {
    return null;
  }
  return createElement(Renderer, {
    step,
    stepManifest,
    savedResponse,
    released,
    browseEnabled,
    answerVisible,
    revealProgress,
    onSubmit,
  });
}

export type TeacherInteractiveActivityRendererProps<TStep, TResponse> = {
  step: TStep;
  stepManifest: InteractiveRuntimeStepManifest;
  responses: TResponse[];
  released: boolean;
  browseEnabled: boolean;
  answerVisible: boolean;
  revealProgress: number;
  onToggleRelease: () => void;
  onToggleBrowse: () => void;
  onToggleAnswerVisible: () => void;
  onAdvanceReveal: () => void;
  onResetReveal: () => void;
};

export type TeacherInteractiveActivityRegistry<TStep, TResponse> = Record<
  string,
  (props: TeacherInteractiveActivityRendererProps<TStep, TResponse>) => ReactNode
>;

export function renderTeacherInteractiveActivity<TStep, TResponse>({
  registry,
  step,
  stepManifest,
  responses,
  released,
  browseEnabled,
  answerVisible,
  revealProgress,
  onToggleRelease,
  onToggleBrowse,
  onToggleAnswerVisible,
  onAdvanceReveal,
  onResetReveal,
}: {
  registry: TeacherInteractiveActivityRegistry<TStep, TResponse>;
  step: TStep;
  stepManifest: InteractiveRuntimeStepManifest;
  responses: TResponse[];
  released: boolean;
  browseEnabled: boolean;
  answerVisible: boolean;
  revealProgress: number;
  onToggleRelease: () => void;
  onToggleBrowse: () => void;
  onToggleAnswerVisible: () => void;
  onAdvanceReveal: () => void;
  onResetReveal: () => void;
}) {
  const Renderer = registry[stepManifest.interactionSpec.interactionKind];
  if (!Renderer) {
    return null;
  }
  return createElement(Renderer, {
    step,
    stepManifest,
    responses,
    released,
    browseEnabled,
    answerVisible,
    revealProgress,
    onToggleRelease,
    onToggleBrowse,
    onToggleAnswerVisible,
    onAdvanceReveal,
    onResetReveal,
  });
}
