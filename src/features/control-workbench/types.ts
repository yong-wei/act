export type {
  AssignmentWorkbenchSessionContext,
  ChallengeWorkbenchSessionContext,
  ExploreWorkbenchSessionContext,
  NominalModelArtifact,
  OdysseyWorkbenchSessionContext,
  WorkbenchLayoutPreset,
  WorkbenchMode,
  WorkbenchPlantTarget,
  WorkbenchPresetId,
  WorkbenchSessionContext,
  WorkbenchSubmissionPolicy,
  WorkbenchViewId,
} from './contracts';

export interface ControlWorkbenchRouteParams {
  arenaTask?: string;
  publicationId?: string;
  classId?: string;
  seasonId?: string;
  preset?: string;
  mode?: string;
}

export interface ControlWorkbenchResolutionError {
  code: 'invalid-arena-task' | 'incomplete-arena-context';
  message: string;
}

export type ControlWorkbenchResolutionResult =
  | {
      ok: true;
      session: import('./contracts').WorkbenchSessionContext;
    }
  | {
      ok: false;
      error: ControlWorkbenchResolutionError;
    };
