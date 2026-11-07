import { describe, expect, it, vi } from 'vitest';

import {
  publishMarineCanvasStatus,
  resetMarineCanvasStatusForTest,
  subscribeMarineCanvasStatus,
} from '../lib/marine-status-store';

describe('marine-status-store（画布生命周期共享，#2151）', () => {
  it('订阅时立即收到最近状态，后续发布即时推送', () => {
    resetMarineCanvasStatusForTest();
    publishMarineCanvasStatus('runnable');
    const seen: Array<string | null> = [];
    const unsubscribe = subscribeMarineCanvasStatus((value) => { seen.push(value); });
    expect(seen).toEqual(['runnable']);
    publishMarineCanvasStatus('failed');
    expect(seen).toEqual(['runnable', 'failed']);
    unsubscribe();
    publishMarineCanvasStatus('runnable');
    expect(seen).toEqual(['runnable', 'failed']);
  });

  it('发布 null 表示画布不在场，订阅者据此回到准备期', () => {
    resetMarineCanvasStatusForTest();
    const listener = vi.fn();
    subscribeMarineCanvasStatus(listener);
    publishMarineCanvasStatus(null);
    expect(listener).toHaveBeenLastCalledWith(null);
  });
});
