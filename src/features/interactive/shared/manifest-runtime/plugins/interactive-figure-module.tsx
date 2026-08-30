'use client';

import type { ReactNode } from 'react';

import { InteractiveFigureComputePanel } from '../interactive-figure-compute-panel';
import type { ManifestModulePlugin, ManifestPluginSet } from './plugin-contract';

export const INTERACTIVE_FIGURE_PLUGIN_OWNER = 'manifest-runtime/interactive-figure-module';

const INTERACTIVE_FIGURE_PLUGIN_KEY = {
  category: 'module',
  moduleKind: 'compute.panel',
  capabilityRef: 'interactive-figure',
  contractVersion: 'interactive-figure.v1',
} as const;

export const interactiveFigureModulePlugin: ManifestModulePlugin<{
  step: Parameters<typeof InteractiveFigureComputePanel>[0]['step'];
  module: Parameters<typeof InteractiveFigureComputePanel>[0]['module'];
}> = {
  key: INTERACTIVE_FIGURE_PLUGIN_KEY,
  owner: INTERACTIVE_FIGURE_PLUGIN_OWNER,
  schema: ({ step, module }) => ({ step, module }),
  projectRole: (payload) => payload,
  render: ({ payload, onPanelSubmit }): ReactNode => (
    <InteractiveFigureComputePanel
      step={payload.step}
      module={payload.module}
      onPanelSubmit={onPanelSubmit}
    />
  ),
  evidence: { classification: 'activity-response', responseKind: 'interactive-figure' },
  missingRenderer: {
    requirement: 'required',
    marker: 'manifest-plugin-missing:compute.panel:interactive-figure',
    reason: '本课的交互图能力没有已注册的渲染插件，为避免错版已停止渲染该模块。',
  },
};

export const interactiveFigurePluginSet: ManifestPluginSet = {
  owner: INTERACTIVE_FIGURE_PLUGIN_OWNER,
  plugins: [interactiveFigureModulePlugin],
  declaredModuleCapabilities: [
    {
      moduleKind: 'compute.panel',
      capabilityRef: 'interactive-figure',
      missingRenderer: interactiveFigureModulePlugin.missingRenderer,
    },
  ],
};
