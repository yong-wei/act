import assert from 'node:assert/strict';
import {
  resolveHomeModelRenderMode,
  shouldForceStaticByConnection,
} from '../../src/lib/model-render-policy';

function run() {
  assert.equal(shouldForceStaticByConnection(undefined), false);
  assert.equal(shouldForceStaticByConnection({ saveData: true, effectiveType: '4g' }), true);
  assert.equal(shouldForceStaticByConnection({ saveData: false, effectiveType: '3g' }), true);
  assert.equal(shouldForceStaticByConnection({ saveData: false, effectiveType: '4g' }), false);

  assert.equal(
    resolveHomeModelRenderMode({
      adminEnabled: false,
      connection: { saveData: false, effectiveType: '4g' },
    }),
    'static',
  );

  assert.equal(
    resolveHomeModelRenderMode({
      adminEnabled: true,
      connection: { saveData: false, effectiveType: '4g' },
    }),
    'dynamic',
  );

  assert.equal(
    resolveHomeModelRenderMode({
      adminEnabled: true,
      connection: { saveData: false, effectiveType: '3g' },
    }),
    'static',
  );

  console.log('test-model-render-policy passed');
}

run();
