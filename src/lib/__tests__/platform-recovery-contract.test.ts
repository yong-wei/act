import { describe, expect, it } from 'vitest';

import { buildPlatformRecoveryState } from '../platform-recovery-contract';

describe('platform recovery contract', () => {
  it('maps invalid object routes to blocked recovery states with safe references', () => {
    const state = buildPlatformRecoveryState({
      kind: 'missing-object',
      sourceRoute: '/teacher/classes/[classId]',
      targetLabel: '班级',
      displayReference: 'class-1',
    });

    expect(state).toMatchObject({
      status: 'blocked',
      severity: 'warning',
      recoveryKind: 'missing-object',
      displayReference: 'class-1',
      recoveryAction: '返回列表并刷新数据',
      identity: {
        category: 'unsupported-action',
        sourceRoute: '/teacher/classes/[classId]',
      },
    });
    expect(state.announcement).toContain('班级被阻断');
  });

  it('keeps classroom-code and password validation errors assertive', () => {
    const classroomCode = buildPlatformRecoveryState({
      kind: 'classroom-code-error',
      sourceRoute: '/classroom/join',
      targetLabel: '课堂码',
      displayReference: '123456',
      message: '课堂码已失效。',
    });
    const password = buildPlatformRecoveryState({
      kind: 'password-validation',
      sourceRoute: '/register',
      targetLabel: '注册密码',
      message: 'Password must be at least 8 characters.',
    });

    expect(classroomCode).toMatchObject({
      status: 'failed',
      severity: 'danger',
      recoveryKind: 'classroom-code-error',
      recoveryAction: '核对教师提供的加入码后重试',
    });
    expect(password).toMatchObject({
      status: 'failed',
      severity: 'danger',
      recoveryKind: 'password-validation',
      recoveryAction: '按页面要求修改密码后重试',
    });
  });

  it('truncates long display references before rendering them in product UI', () => {
    const state = buildPlatformRecoveryState({
      kind: 'invalid-object-route',
      sourceRoute: '/interactive-learning/resources/[id]',
      targetLabel: '互动资源',
      displayReference: 'x'.repeat(120),
    });

    expect(state.displayReference).toHaveLength(80);
    expect(state.displayReference).toMatch(/\.\.\.$/);
  });
});
