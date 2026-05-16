export type WorkbenchSignalKind =
  | 'reference'
  | 'output'
  | 'error'
  | 'control'
  | 'disturbance'
  | 'constraint-upper'
  | 'constraint-lower'
  | 'metric';

export type WorkbenchSignalSource =
  | 'official-target'
  | 'working-model'
  | 'controller'
  | 'preview'
  | 'experiment';

export interface WorkbenchSignalSample {
  x: number;
  y: number;
  series?: string;
}

export interface WorkbenchSignal {
  id: string;
  kind: WorkbenchSignalKind;
  source: WorkbenchSignalSource;
  label: string;
  unit?: string;
  samples?: WorkbenchSignalSample[];
  metadata?: Record<string, string | number | boolean>;
}

export type WorkbenchExperimentSignalType =
  | 'step'
  | 'impulse'
  | 'sine'
  | 'chirp'
  | 'disturbance'
  | 'scenario';
