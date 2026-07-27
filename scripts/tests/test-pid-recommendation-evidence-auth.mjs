import assert from 'node:assert/strict';
import test from 'node:test';
import { decode } from 'next-auth/jwt';

import { createPidRecommendationEvidenceStorageState } from '../../artifacts/commercial-ui/pid-turn-calibration-1038/pid-recommendation-evidence-session.mjs';

test('PID recommendation evidence storage state contains a valid authenticated student cookie', async () => {
  const secret = 'pid-recommendation-evidence-test-secret';

  const storageState = await createPidRecommendationEvidenceStorageState({
    baseUrl: 'http://127.0.0.1:3012',
    secret,
  });

  assert.equal(storageState.cookies.length, 1);
  assert.equal(storageState.cookies[0].name, 'next-auth.session-token');
  assert.equal(storageState.cookies[0].domain, '127.0.0.1');

  const token = await decode({ token: storageState.cookies[0].value, secret });
  assert.equal(token?.id, 'commercial-ui-evidence-pid');
  assert.equal(token?.role, 'STUDENT');
});
