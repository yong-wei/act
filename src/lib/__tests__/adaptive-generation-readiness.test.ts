import { describe, expect, it } from 'vitest';

import {
  adaptiveGenerationReadinessFromEngineeringGraphSelection,
  adaptiveGenerationReadinessFromHttp,
  buildAdaptiveGenerationReadiness,
  selectAdaptiveGenerationReadiness,
} from '@/features/personalization/path-planning/adaptive-generation-readiness.ts';

describe('adaptive generation readiness', () => {
  it('maps missing class and teacher bindings to actionable blockers', () => {
    expect(buildAdaptiveGenerationReadiness({
      reason: 'missing-class-binding',
      source: 'session',
    })).toMatchObject({
      status: 'blocked',
      studentAction: 'request-teacher-binding',
      staffAction: 'bind-class',
      evidence: { diagnosticCode: 'missing-class-binding' },
    });

    expect(buildAdaptiveGenerationReadiness({
      reason: 'missing-teacher-binding',
      source: 'session',
    })).toMatchObject({
      status: 'blocked',
      studentAction: 'request-teacher-binding',
      staffAction: 'bind-class',
      evidence: { diagnosticCode: 'missing-teacher-binding' },
    });
  });

  it('distinguishes learner-state, advisor, service, evidence, and retryable states', () => {
    expect(buildAdaptiveGenerationReadiness({
      reason: 'learner-state-unavailable',
      source: 'learner-state',
    })).toMatchObject({
      status: 'degraded',
      studentAction: 'review-evidence',
      staffAction: 'check-service',
    });
    expect(buildAdaptiveGenerationReadiness({
      reason: 'advisor-forbidden',
      source: 'path-advisor',
    })).toMatchObject({
      status: 'blocked',
      studentAction: 'request-teacher-binding',
      staffAction: 'review-permission',
    });
    expect(buildAdaptiveGenerationReadiness({
      reason: 'auth-required',
      source: 'session',
    })).toMatchObject({
      status: 'blocked',
      studentAction: 'login',
      staffAction: 'none',
      studentMessage: '请先登录后再生成学习路径。',
    });
    expect(buildAdaptiveGenerationReadiness({
      reason: 'service-unavailable',
      source: 'path-advisor',
    })).toMatchObject({
      status: 'retryable',
      studentAction: 'retry',
      staffAction: 'check-service',
    });
    expect(buildAdaptiveGenerationReadiness({
      reason: 'insufficient-evidence',
      source: 'ui',
    })).toMatchObject({
      status: 'degraded',
      studentAction: 'continue-practice',
      staffAction: 'inspect-evidence',
    });
    expect(adaptiveGenerationReadinessFromHttp({
      status: 401,
      source: 'learner-state',
    })).toMatchObject({
      reason: 'auth-required',
      status: 'blocked',
      studentAction: 'login',
      staffAction: 'none',
    });
    expect(adaptiveGenerationReadinessFromHttp({
      status: 500,
      source: 'path-advisor-tool',
    })).toMatchObject({
      reason: 'retryable',
      status: 'retryable',
    });
    expect(adaptiveGenerationReadinessFromHttp({
      status: 503,
      source: 'learner-state',
      fallbackReason: 'learner-state-unavailable',
    })).toMatchObject({
      reason: 'learner-state-unavailable',
      status: 'degraded',
    });
    expect(adaptiveGenerationReadinessFromHttp({
      status: 503,
      source: 'path-advisor',
    })).toMatchObject({
      reason: 'service-unavailable',
      status: 'retryable',
    });
    expect(adaptiveGenerationReadinessFromHttp({
      status: 409,
      source: 'path-advisor-tool',
    })).toMatchObject({
      reason: 'conflict',
      status: 'retryable',
      studentAction: 'retry',
    });
    expect(adaptiveGenerationReadinessFromHttp({
      status: 503,
      source: 'path-advisor-tool',
      error: '学习路径依赖的课程运行时或工程图谱还没有就绪。',
    })).toMatchObject({
      reason: 'runtime-graph-unavailable',
      status: 'retryable',
      studentAction: 'retry',
    });
    expect(adaptiveGenerationReadinessFromHttp({
      status: 503,
      source: 'path-advisor-tool',
      error: '学习路径依赖的课程运行时或工程图谱还没有就绪。',
    }).studentMessage).not.toContain('学习证据还不充分');
  });

  it('treats an unreadiness engineering-graph as runtime-graph-unavailable, not missing evidence', () => {
    expect(adaptiveGenerationReadinessFromEngineeringGraphSelection({
      mode: 'use-combination',
      resolved: { consumerStatus: 'READY' },
    })).toBeNull();
    expect(adaptiveGenerationReadinessFromEngineeringGraphSelection({
      mode: 'pin-combination',
      resolved: { consumerStatus: 'NOT_READY' },
    })).toMatchObject({
      reason: 'runtime-graph-unavailable',
      status: 'retryable',
      studentAction: 'retry',
    });
    const graphBlocked = adaptiveGenerationReadinessFromEngineeringGraphSelection({
      mode: 'absent',
    });
    const missingEvidence = buildAdaptiveGenerationReadiness({
      reason: 'insufficient-evidence',
      source: 'ui',
    });
    expect(selectAdaptiveGenerationReadiness([missingEvidence, graphBlocked])).toMatchObject({
      reason: 'runtime-graph-unavailable',
    });
  });

  it('uses blocked before retryable before degraded when combining surfaces', () => {
    const degraded = buildAdaptiveGenerationReadiness({
      reason: 'insufficient-evidence',
      source: 'ui',
    });
    const retryable = buildAdaptiveGenerationReadiness({
      reason: 'service-unavailable',
      source: 'path-advisor',
    });
    const blocked = buildAdaptiveGenerationReadiness({
      reason: 'missing-class-binding',
      source: 'session',
    });

    expect(selectAdaptiveGenerationReadiness([degraded, retryable, blocked])).toBe(blocked);
    expect(selectAdaptiveGenerationReadiness([degraded, retryable])).toBe(retryable);
    expect(selectAdaptiveGenerationReadiness([degraded])).toBe(degraded);
    expect(selectAdaptiveGenerationReadiness([])).toMatchObject({ status: 'ready' });
  });
});
