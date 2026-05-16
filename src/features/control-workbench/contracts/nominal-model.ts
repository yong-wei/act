import type { ChallengeObject, ModelVisibility } from '../../arena/types';

export type NominalModelKind =
  | 'transfer-function'
  | 'state-space'
  | 'nonlinear-simulation'
  | 'virtual-simulation'
  | 'data-driven';

export type NominalModelRepresentation =
  | {
      kind: 'transfer-function';
      display: string;
      latex?: string;
      numerator: number[];
      denominator: number[];
    }
  | {
      kind: 'state-space';
      display?: string;
      a: number[][];
      b: number[][];
      c: number[][];
      d: number[][];
    }
  | {
      kind: 'nonlinear-simulation' | 'virtual-simulation' | 'data-driven';
      display?: string;
      modelRef: string;
      summary?: string;
    };

export interface NominalModelValidationMetric {
  id: string;
  label: string;
  value: number | null;
  unit?: string;
  status: 'pass' | 'warning' | 'fail' | 'unknown';
}

export interface NominalModelArtifact {
  id: string;
  sourceObjectId?: ChallengeObject['id'];
  sourceDatasetHash?: string;
  sourceExperimentId?: string;
  sourceVisibility?: ModelVisibility;
  modelType: NominalModelKind;
  representation: NominalModelRepresentation;
  validationMetrics: NominalModelValidationMetric[];
  createdAt: string;
  updatedAt?: string;
  createdBy?: string;
  notes?: string;
}
