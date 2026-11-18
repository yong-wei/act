import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const source = readFileSync(new URL('../simulations/http-load.mjs', import.meta.url), 'utf8');
const packetFunction = source.slice(source.indexOf('async function directPacket('), source.indexOf('\nasync function draft('));

function fixture(endTimeS) {
  const closing = { endTimeS, checkpoint: 'saved-checkpoint', controlCount: 1 };
  return {
    runRef: 'new-run', reportClientRef: 'report', runStartedAt: 123,
    directOpening: { runRef: 'previous-run' },
    progress: { status: 'completed', lastTimeS: 60 }, completedRuns: [],
    fixture: { courseKey: 'destroyer', durationS: 60, packets: [{ requests: [
      { path: '/api/ilab/experiment-runs', body: {} },
      { path: '/api/ilab/experiment-runs/new-run', method: 'PUT', body: closing },
    ] }] },
  };
}

function executable(request) {
  const context = vm.createContext({
    assert, request, runtimeVersion: 'runtime', traceEncoding: 'server',
    browserPreviews: { previews: { destroyer: [{}] } },
    prepareDirectLoadPacket: () => ({ objects: [], close: { reason: 'checkpoint' }, checkpointReference: 'checkpoint' }),
  });
  return vm.runInContext(packetFunction + '\ndirectPacket', context);
}

test('opening timeout retries the same new run without consuming preceding-run progress', async () => {
  let openings = 0;
  let saves = 0;
  const client = fixture(5);
  const directPacket = executable(async (_client, path, options) => {
    if (path === '/api/ilab/experiment-runs') {
      openings++;
      assert.equal(options.body.runRef, 'new-run');
      if (openings === 1) throw new Error('request timeout');
      return { value: { status: 'running', transport: 'oss', lastTimeS: 0 } };
    }
    saves++;
    return { value: { status: 'running', lastTimeS: 5, controlCount: 1 } };
  });
  await assert.rejects(directPacket(client, 0, 1), /request timeout/);
  await directPacket(client, 0, 1);
  assert.equal(openings, 2);
  assert.equal(saves, 1);
  assert.equal(client.progress.lastTimeS, 5);
});

test('lost closing receipt retries the established run and counts its completion once', async () => {
  let openings = 0;
  let saves = 0;
  const client = fixture(60);
  const directPacket = executable(async (_client, path) => {
    if (path === '/api/ilab/experiment-runs') {
      openings++;
      return { value: { status: 'running', transport: 'oss', lastTimeS: 0 } };
    }
    saves++;
    if (saves === 1) throw new Error('lost closing receipt');
    return { value: { status: 'completed', lastTimeS: 60, controlCount: 1 } };
  });
  await assert.rejects(directPacket(client, 0, 1), /lost closing receipt/);
  await directPacket(client, 0, 1);
  await directPacket(client, 0, 1);
  assert.equal(openings, 1);
  assert.equal(saves, 2);
  assert.deepEqual(client.completedRuns, ['new-run']);
});
