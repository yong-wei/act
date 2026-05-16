import type { WorkbenchSignalKind, WorkbenchSignalSource } from './signals';

export type WorkbenchViewId =
  | 'time-domain'
  | 'bode'
  | 'root-locus'
  | 'nyquist'
  | 'identification'
  | 'metric-summary'
  | 'control-effort'
  | 'response-comparison'
  | 'pole-zero'
  | 'experiment-dataset'
  | 'custom';

export interface WorkbenchViewConfig {
  id: WorkbenchViewId;
  title: string;
  enabled: boolean;
  locked?: boolean;
  selectedOptions?: string[];
  signalKinds?: WorkbenchSignalKind[];
  signalSources?: WorkbenchSignalSource[];
  settings?: Record<string, string | number | boolean>;
}
