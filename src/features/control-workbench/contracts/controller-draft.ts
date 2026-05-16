import type { ControllerMethod } from '../../arena/types';

export type ControllerDraftSource =
  | 'manual'
  | 'template'
  | 'nominal-model'
  | 'identification'
  | 'imported'
  | 'odyssey';

export type ControllerDraftParamValue = number | string | boolean | null;

export type ControllerDraftValidationStatus =
  | 'untouched'
  | 'validating'
  | 'valid'
  | 'warning'
  | 'invalid';

export interface ControllerDraftValidationIssue {
  code: string;
  severity: 'info' | 'warning' | 'error';
  message: string;
  field?: string;
}

export interface ControllerDraftValidationState {
  status: ControllerDraftValidationStatus;
  issues: ControllerDraftValidationIssue[];
  updatedAt?: string;
}

export interface ControllerDraft {
  draftId: string;
  method: ControllerMethod;
  source: ControllerDraftSource;
  params: Record<string, ControllerDraftParamValue>;
  dirty: boolean;
  partial: boolean;
  validation: ControllerDraftValidationState;
  taskId?: string;
  workingModelId?: string;
  createdAt?: string;
  updatedAt: string;
}
