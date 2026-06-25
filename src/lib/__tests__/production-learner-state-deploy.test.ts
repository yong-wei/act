import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const repoRoot = process.cwd();

function readProjectFile(path: string) {
  return readFileSync(join(repoRoot, path), 'utf8');
}

describe('production learner-state deployment configuration', () => {
  it('documents learner-state as enabled in local and production environment examples', () => {
    expect(readProjectFile('.env.example')).toContain('ADAPTIVE_LEARNER_STATE_SERVICE_ENABLED="true"');
    expect(readProjectFile('deploy/podman/.env.server.example'))
      .toContain('ADAPTIVE_LEARNER_STATE_SERVICE_ENABLED=true');
  });

  it('injects the learner-state flag into both app and worker container environments', () => {
    const deployScript = readProjectFile('deploy/podman/deploy.sh');
    const sharedEnvIndex = deployScript.indexOf('SHARED_ENV_ARGS=(');
    const appEnvIndex = deployScript.indexOf('APP_ENV_ARGS=(');
    const workerEnvIndex = deployScript.indexOf('WORKER_ENV_ARGS=(');

    expect(deployScript).toContain('ADAPTIVE_LEARNER_STATE_SERVICE_ENABLED="${ADAPTIVE_LEARNER_STATE_SERVICE_ENABLED:-true}"');
    expect(deployScript).toContain('ADAPTIVE_LEARNER_STATE_SERVICE_ENABLED=$ADAPTIVE_LEARNER_STATE_SERVICE_ENABLED');
    expect(sharedEnvIndex).toBeGreaterThanOrEqual(0);
    expect(appEnvIndex).toBeGreaterThan(sharedEnvIndex);
    expect(workerEnvIndex).toBeGreaterThan(appEnvIndex);
    expect(deployScript.slice(sharedEnvIndex, appEnvIndex))
      .toContain('-e ADAPTIVE_LEARNER_STATE_SERVICE_ENABLED="$ADAPTIVE_LEARNER_STATE_SERVICE_ENABLED"');
    expect(deployScript.slice(appEnvIndex, workerEnvIndex)).toContain('"${SHARED_ENV_ARGS[@]}"');
    expect(deployScript.slice(workerEnvIndex)).toContain('"${SHARED_ENV_ARGS[@]}"');
  });
});
