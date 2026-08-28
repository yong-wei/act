import type { ControllerArtifact } from '../types';
import type { ControlAnalysisService } from './control-analysis-service';

export interface HardConstraintResult {
  id: string;
  label: string;
  passed: boolean;
  reason?: string;
}

export interface ArenaEvaluationPenalty {
  id: string;
  label: string;
  value: number;
}

export interface ArenaEvaluationResult {
  taskId: string;
  artifact: ControllerArtifact;
  valid: boolean;
  score: number;
  metrics: Record<string, number>;
  satisfaction: Record<string, number>;
  hardConstraintResults: HardConstraintResult[];
  penalties: ArenaEvaluationPenalty[];
  explanation: string[];
  metadata?: Record<string, unknown>;
}

export interface WhiteBoxEvaluationInput {
  taskId: string;
  artifact: ControllerArtifact;
  controlAnalysisService?: ControlAnalysisService;
  metricProviderMode?: 'official' | 'template-preview' | 'control-engine-preview';
}
