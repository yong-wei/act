'use client';

import type { ReactNode } from 'react';

import { SharedControlWorkbenchComputePanel } from '../control-workbench-compute-panel';
import { CONTROL_WORKBENCH_COMPUTE_CAPABILITY_REFS } from '../module-taxonomy';
import type {
  ManifestModulePlugin,
  ManifestModuleRendererInput,
  ManifestPluginSet,
} from './plugin-contract';

type WorkbenchPayload = {
  manifest: ManifestModuleRendererInput['manifest'];
  step: ManifestModuleRendererInput['step'];
  module: ManifestModuleRendererInput['module'];
};

export const CONTROL_WORKBENCH_PLUGIN_OWNER = 'manifest-runtime/control-workbench-module';

function createPlugin(capabilityRef: (typeof CONTROL_WORKBENCH_COMPUTE_CAPABILITY_REFS)[number]): ManifestModulePlugin<WorkbenchPayload> {
  return {
    key: {
      category: 'module',
      moduleKind: 'compute.panel',
      capabilityRef,
      contractVersion: `${capabilityRef}.v1`,
    },
    owner: CONTROL_WORKBENCH_PLUGIN_OWNER,
    schema: ({ manifest, step, module }) => ({ manifest, step, module }),
    projectRole: (payload) => payload,
    render: ({ payload, onPanelSubmit, showFrequencyReadings }): ReactNode => (
      <SharedControlWorkbenchComputePanel
        manifest={payload.manifest}
        step={payload.step}
        module={payload.module}
        onPanelSubmit={onPanelSubmit}
        showFrequencyReadings={showFrequencyReadings}
      />
    ),
    evidence: { classification: 'activity-response', responseKind: 'control-workbench' },
    missingRenderer: {
      requirement: 'required',
      marker: `manifest-plugin-missing:compute.panel:${capabilityRef}`,
      reason: `本课的控制分析工作台能力 ${capabilityRef} 没有已注册的渲染插件，为避免错版已停止渲染该模块。`,
    },
  };
}

export const controlWorkbenchPluginSet: ManifestPluginSet = {
  owner: CONTROL_WORKBENCH_PLUGIN_OWNER,
  plugins: CONTROL_WORKBENCH_COMPUTE_CAPABILITY_REFS.map(createPlugin),
  declaredModuleCapabilities: CONTROL_WORKBENCH_COMPUTE_CAPABILITY_REFS.map((capabilityRef) => ({
    moduleKind: 'compute.panel',
    capabilityRef,
    missingRenderer: createPlugin(capabilityRef).missingRenderer,
  })),
};
