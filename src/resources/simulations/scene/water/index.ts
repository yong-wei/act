export { computeGerstnerDisplacement, GERSTNER_MAX_WAVES, GERSTNER_WAVE_SETS, gerstnerPhaseSpeed } from './gerstner-waves';
export type { GerstnerDisplacement, GerstnerWave } from './gerstner-waves';
export { createGerstnerWaterMaterial } from './gerstner-water-material';
export type { GerstnerWaterMaterialOptions } from './gerstner-water-material';
export { GerstnerWater, GERSTNER_WATER_BASE_Y, DEFAULT_GERSTNER_SEA_STATE, gerstnerAmplitudeScale, sampleVisibleWaterHeight, createGerstnerWaterGeometry, gerstnerWaterMeshSpecForTier, GERSTNER_WATER_SIZE, GERSTNER_WATER_RESOLUTION_BY_TIER, useNearFieldWaterHeight } from './gerstner-water';
export type { GerstnerWaterProps, GerstnerWaterMeshSpec, GerstnerWaterTier } from './gerstner-water';
export type { NearFieldSurfaceQueryOptions } from './gerstner-water';
export {
  createNearFieldSurfaceQuery,
  farFieldMeshSpecForTier,
  farFieldVisibleWavesForTier,
  MARINE_BASE_INTERACTION_MESH_SPEC,
  MARINE_BASE_INTERACTION_WAVES,
  NEAR_FIELD_APPROXIMATION_TOLERANCE_METERS,
  NEAR_FIELD_INTERVALS_PER_WAVELENGTH,
  NEAR_FIELD_MESH_SPEC,
  NEAR_FIELD_VISIBLE_WAVES,
} from './gerstner-water';
export {
  bandCellSize,
  bandLimitWaves,
  FAR_FIELD_BAND_SPECS,
  INTERVALS_PER_SHORTEST_WAVELENGTH,
  minResolvableWavelength,
  NEAR_FIELD_BAND_SPECS,
  NEAR_FIELD_FADE_BAND_METERS,
  nearFieldEnvelope,
} from './ocean-bands';
export {
  displayDriftVelocity,
  FoamHistoryField,
  foamDecayFactor,
  FOAM_HALF_LIFE_SECONDS,
  FOAM_HISTORY_BY_TIER,
  FOAM_RECENTER_STEP_METERS,
  FOAM_SEEK_CLEAR_SECONDS,
  MAX_FOAM_DENSITY,
  naturalCompression,
  naturalFoamSeaStateGate,
  naturalFoamSourceStrength,
  NATURAL_FOAM_RATE_PER_SECOND,
  VESSEL_FOAM_RATE_PER_SECOND,
} from './foam-history';
export type {
  FoamHistoryFieldOptions,
  FoamHistoryTierSpec,
  FoamSourceInputs,
} from './foam-history';
export { FOAM_DOMAIN_METERS, MarineFoamFieldProvider, useMarineFoamField } from './foam-history-layer';
export type {
  FoamAttribution,
  MarineFoamFieldController,
  MarineFoamFieldStats,
} from './foam-history-layer';
