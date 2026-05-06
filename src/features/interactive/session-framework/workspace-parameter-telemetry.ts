export const WORKSPACE_PARAM_IDLE_FLUSH_MS = 1_500;

export type WorkspaceParamFlushReason = 'idle' | 'step_leave' | 'submit' | 'session_finalize';

export interface WorkspaceParameterTelemetryEvent {
  stepId: string | null;
  data: Record<string, unknown>;
  clientEventAt: number;
}

interface PendingWorkspaceParamChange {
  stepId: string | null;
  data: Record<string, unknown>;
  firstClientEventAt: number;
  lastClientEventAt: number;
  changeCount: number;
}

function stepKey(stepId: string | null) {
  return stepId ?? '__lesson__';
}

function buildEvent(
  pending: PendingWorkspaceParamChange,
  flushReason: WorkspaceParamFlushReason,
): WorkspaceParameterTelemetryEvent {
  return {
    stepId: pending.stepId,
    clientEventAt: pending.lastClientEventAt,
    data: {
      ...pending.data,
      sampled: true,
      changeCount: pending.changeCount,
      flushReason,
      firstClientEventAt: pending.firstClientEventAt,
      lastClientEventAt: pending.lastClientEventAt,
    },
  };
}

export function createWorkspaceParameterTelemetryBuffer(
  idleFlushMs = WORKSPACE_PARAM_IDLE_FLUSH_MS,
) {
  const pending = new Map<string, PendingWorkspaceParamChange>();

  return {
    record(stepId: string | null, data: Record<string, unknown>, clientEventAt = Date.now()) {
      const key = stepKey(stepId);
      const previous = pending.get(key);
      pending.set(key, {
        stepId,
        data,
        firstClientEventAt: previous?.firstClientEventAt ?? clientEventAt,
        lastClientEventAt: clientEventAt,
        changeCount: (previous?.changeCount ?? 0) + 1,
      });
    },

    collectDue(now = Date.now()): WorkspaceParameterTelemetryEvent[] {
      const events: WorkspaceParameterTelemetryEvent[] = [];
      for (const [key, item] of Array.from(pending.entries())) {
        if (now - item.lastClientEventAt < idleFlushMs) {
          continue;
        }
        pending.delete(key);
        events.push(buildEvent(item, 'idle'));
      }
      return events;
    },

    flushStep(stepId: string | null, reason: WorkspaceParamFlushReason): WorkspaceParameterTelemetryEvent[] {
      const key = stepKey(stepId);
      const item = pending.get(key);
      if (!item) {
        return [];
      }
      pending.delete(key);
      return [buildEvent(item, reason)];
    },

    flushAll(reason: WorkspaceParamFlushReason): WorkspaceParameterTelemetryEvent[] {
      const events = Array.from(pending.values()).map((item) => buildEvent(item, reason));
      pending.clear();
      return events;
    },

    hasPending() {
      return pending.size > 0;
    },
  };
}
