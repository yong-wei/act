'use client';
import { ComparisonWater as SharedComparisonWater, type ComparisonOceanProbe } from '@/resources/simulations/scene/water/shared-ocean-surface';
import { getEnvironmentPreset, DEFAULT_ENVIRONMENT_PRESET_ID } from '@/resources/simulations/scene/environment/environment-presets';
import { COMPARISON_SPECTRUM_INPUT, COMPARISON_SHORE_SEGMENT, comparisonVesselPose, type ComparisonBackend, type ComparisonSceneId } from './comparison-lab';
export type { ComparisonOceanProbe } from '@/resources/simulations/scene/water/shared-ocean-surface';
const config = {
  spectrum: COMPARISON_SPECTRUM_INPUT, shore: COMPARISON_SHORE_SEGMENT,
  poseAt: comparisonVesselPose, skyTexture: getEnvironmentPreset(DEFAULT_ENVIRONMENT_PRESET_ID).skyTexture,
};
export function ComparisonWater(props: {
  backend: ComparisonBackend; scene: ComparisonSceneId; tier: 'high' | 'medium' | 'low';
  resolution: 128 | 256 | 512; shallowEnabled: boolean; reflectionEnabled: boolean; resetToken: number;
  surfaceRef: React.MutableRefObject<ComparisonOceanProbe | null>;
}) {
  return <SharedComparisonWater {...props} config={config} />;
}
