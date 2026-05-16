import type { ControllerArtifact } from '../../arena/types';
import type { ControllerDraft, ControllerDraftValidationIssue } from './controller-draft';

export type ArtifactBridgeFailureCode =
  | 'draft-incomplete'
  | 'draft-invalid'
  | 'unsupported-method'
  | 'missing-task'
  | 'conversion-error';

export type ArtifactBridgeResult =
  | {
      ok: true;
      draft: ControllerDraft;
      artifact: ControllerArtifact;
      warnings?: string[];
    }
  | {
      ok: false;
      draft: ControllerDraft;
      reason: string;
      code: ArtifactBridgeFailureCode;
      issues?: ControllerDraftValidationIssue[];
    };

export function isArtifactBridgeSuccess(result: ArtifactBridgeResult): result is Extract<ArtifactBridgeResult, { ok: true }> {
  return result.ok;
}

export function buildArtifactBridgeFailure(
  draft: ControllerDraft,
  reason: string,
  code: ArtifactBridgeFailureCode,
  issues?: ControllerDraftValidationIssue[],
): Extract<ArtifactBridgeResult, { ok: false }> {
  return {
    ok: false,
    draft,
    reason,
    code,
    issues,
  };
}
