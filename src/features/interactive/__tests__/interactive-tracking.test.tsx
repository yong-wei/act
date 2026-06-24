import { renderToString } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { InteractiveTrackingContextValue } from '../types';
import { useInteractiveTracking } from '../hooks/useInteractiveTracking';

describe('useInteractiveTracking', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 200 })));
  });

  it('keeps demo session events local instead of posting to persisted event APIs', () => {
    let tracking: InteractiveTrackingContextValue | null = null;

    function Harness() {
      tracking = useInteractiveTracking({
        resourceKey: 'unit-test-resource',
        sessionId: 'demo',
      });
      return null;
    }

    renderToString(<Harness />);

    if (!tracking) throw new Error('Expected interactive tracking');
    tracking.emit('complete', { stepId: 'step-01' });

    expect(fetch).not.toHaveBeenCalled();
  });
});
