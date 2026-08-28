import { LearningRecordContractError } from './errors';
import type { LearningRecordEnvelope } from './types';

export interface ReplayAuthorization {
  scope: string;
  purpose: string;
  ticket: string;
  elevatedUntil: Date;
  dualControl: boolean;
  role: string;
}

export function authorizeReplay(auth: ReplayAuthorization, now = new Date()) {
  if (!auth.ticket || !auth.purpose || !auth.scope) {
    throw new LearningRecordContractError('replay-unauthorized', 'Replay requires scope, purpose and ticket');
  }
  if (!auth.dualControl) {
    throw new LearningRecordContractError('replay-unauthorized', 'Replay requires two-person or equivalent control');
  }
  if (auth.elevatedUntil.getTime() <= now.getTime()) {
    throw new LearningRecordContractError('replay-unauthorized', 'Replay elevated authority has expired');
  }
  if (auth.role === 'queue' || auth.role === 'fact-consumer') {
    throw new LearningRecordContractError('replay-unauthorized', 'Normal consumer roles cannot inherit replay');
  }
}

export function replayEnvelope(original: LearningRecordEnvelope): LearningRecordEnvelope {
  return {
    ...original,
    materializedAt: original.materializedAt,
  };
}

export function authorizeRawArtifact(input: { approved: boolean; role: string }) {
  if (!input.approved || input.role === 'queue' || input.role === 'fact-consumer') {
    throw new LearningRecordContractError('raw-artifact-forbidden', 'Raw artifact access is independently authorized');
  }
}
