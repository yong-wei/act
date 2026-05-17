'use client';

import { BlackBoxIdentificationPanel } from '@/features/control-workbench/presets/blackbox-identification-preset';
import type { ChallengeTask } from '../types';
import type { ArenaSubmissionRecord } from './submission-service';

export function ArenaBlackBoxSubmissionPanel({
  task,
  initialSubmissions,
  publicationId,
  viewerUserId,
}: {
  task: ChallengeTask;
  initialSubmissions: ArenaSubmissionRecord[];
  publicationId?: string;
  viewerUserId?: string;
}) {
  return (
    <BlackBoxIdentificationPanel
      task={task}
      initialSubmissions={initialSubmissions}
      publicationId={publicationId}
      viewerUserId={viewerUserId}
      officialTargetHidden
    />
  );
}
