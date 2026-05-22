import type { WorkbenchViewId } from './views';

export type WorkbenchDesignStepId =
  | 'object-analysis'
  | 'experiment-planning'
  | 'nominal-model'
  | 'controller-design'
  | 'performance-comparison'
  | 'constraint-check'
  | 'official-submission'
  | 'review';

export type WorkbenchDesignStepStatus = 'active' | 'available' | 'locked';

export interface WorkbenchDesignFlowStep {
  id: WorkbenchDesignStepId;
  title: string;
  description: string;
  nextAction: string;
  viewIds: WorkbenchViewId[];
  status: WorkbenchDesignStepStatus;
}

export interface WorkbenchDesignFlow {
  modeLabel: string;
  contextLabel: string;
  taskLabel: string;
  objectLabel: string;
  methodBoundary: string;
  currentStepId: WorkbenchDesignStepId;
  currentStep: WorkbenchDesignFlowStep;
  nextAction: string;
  steps: WorkbenchDesignFlowStep[];
}
