'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import type { ReactNode } from 'react';

import { sendArenaCoreEvent } from './telemetry';
import type { ChallengeObject, ChallengeTask } from './types';

export function ArenaChallengeTelemetry({
  task,
  object,
  hasLeaderboard,
}: {
  task: ChallengeTask;
  object: ChallengeObject;
  hasLeaderboard: boolean;
}) {
  useEffect(() => {
    void sendArenaCoreEvent('arena_challenge_open', {
      taskId: task.id,
      objectId: object.id,
      source: object.source,
      visibility: object.visibility,
    });

    if (object.adapterType === 'virtual-simulation') {
      void sendArenaCoreEvent('arena_virtual_simulation_import', {
        taskId: task.id,
        objectId: object.id,
      });
    }

    if (hasLeaderboard) {
      void sendArenaCoreEvent('arena_leaderboard_view', {
        taskId: task.id,
        leaderboardTypes: task.leaderboardTypes.join(','),
      });
    }
  }, [hasLeaderboard, object.adapterType, object.id, object.source, object.visibility, task.id, task.leaderboardTypes]);

  return null;
}

export function ArenaWorkspaceLink({
  href,
  task,
  children,
  className,
}: {
  href: string;
  task: ChallengeTask;
  children: ReactNode;
  className: string;
}) {
  return (
    <Link
      href={href}
      className={className}
      onClick={() => {
        void sendArenaCoreEvent('arena_workspace_start', {
          taskId: task.id,
          workspaceMode: task.workspaceMode,
        });
      }}
    >
      {children}
    </Link>
  );
}
