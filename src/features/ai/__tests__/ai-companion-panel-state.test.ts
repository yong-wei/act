import { describe, expect, it } from 'vitest';

import {
  attemptOutcomeToSuccess,
  canRecordAttempt,
  getFeedbackStatusMessage,
} from '../companion/attempt-feedback-state';

describe('AI companion attempt and feedback state', () => {
  it('requires an explicit attempt outcome before recording', () => {
    expect(canRecordAttempt(null)).toBe(false);
    expect(canRecordAttempt('success')).toBe(true);
    expect(canRecordAttempt('failure')).toBe(true);
  });

  it('maps explicit attempt outcome to the existing isSuccessful contract', () => {
    expect(attemptOutcomeToSuccess(null)).toBeNull();
    expect(attemptOutcomeToSuccess('success')).toBe(true);
    expect(attemptOutcomeToSuccess('failure')).toBe(false);
  });

  it('returns stable user-facing feedback submission messages', () => {
    expect(getFeedbackStatusMessage({ status: 'idle' })).toBeNull();
    expect(getFeedbackStatusMessage({ status: 'submitting' })).toBe('正在提交反馈...');
    expect(getFeedbackStatusMessage({ status: 'success' })).toBe('反馈已提交');
    expect(getFeedbackStatusMessage({ status: 'error', message: '网络错误' })).toBe('网络错误');
  });
});
