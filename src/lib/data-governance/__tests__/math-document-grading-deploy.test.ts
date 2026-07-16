import { mkdtempSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import {
  assertProductionProviderRetentionAdapter,
  ensureGradingPolicies,
  parseGradingPolicySeedConfig,
} from '../../../../scripts/assignments/ensure-grading-policies';

const read = (file: string) => readFileSync(join(process.cwd(), file), 'utf8');

describe('math-document grading production entrypoint contract', () => {
  it('provisions the local conversion toolchain and starts the math worker from the production worker entrypoint', () => {
    const dockerfile = read('Dockerfile');
    const worker = read('scripts/workers/data-governance-worker.ts');
    const mathWorker = read('scripts/workers/math-document-grading-worker.ts');
    const gc = read('scripts/assignments/gc-submission-objects.ts');
    const deploy = read('deploy/podman/deploy.sh');
    const wrapper = read('deploy/podman/container-start-wrapper.sh');

    expect(dockerfile).toMatch(/apk add[^\n]*unzip/);
    expect(dockerfile).toMatch(/apk add[^\n]*libreoffice/);
    expect(dockerfile).toContain('markitdown==');
    expect(dockerfile).toContain('scripts/assignments');
    expect(worker).toContain('math-document-grading-worker');
    expect(mathWorker).toContain('assertMathDocumentGradingWorkerConfig');
    expect(mathWorker).toContain('MATH_DOCUMENT_GRADING_WORKER_CAPABILITY_KEY');
    expect(gc).toContain('runGradingRetentionGc');
    expect(gc).toContain('gradingLifecyclePolicy.findMany');
    expect(deploy).toContain('MATH_DOCUMENT_GRADING_WORKER_REQUIRED');
    expect(deploy).toContain('GRADING_MATHPIX_ENABLED=false 与数学文档批改 worker 不兼容');
    expect(deploy).toContain('-e GRADING_MATHPIX_ENABLED="${GRADING_MATHPIX_ENABLED:-false}"');
    expect(deploy).toContain('WORKER_STORAGE_ENV_ARGS');
    expect(deploy).toContain('"${WORKER_STORAGE_ENV_ARGS[@]}"');
    expect(deploy).toContain('"${AI_PROVIDER_ENV_ARGS[@]}"');
    expect(deploy).toContain('"${MATHPIX_ENV_ARGS[@]}"');
    expect(deploy).toContain('SUBMISSION_SCANNER_ACCESS_KEY');
    expect(deploy).toContain('MATHPIX_APP_KEY');
    expect(deploy).toContain('AI_PROVIDER_ENV_ARGS');
    expect(deploy).toContain('math-document-grading:worker:heartbeat');
    expect(deploy).toContain('math-document-grading:worker:capability');
    expect(deploy).toContain('deploy/podman/container-start-wrapper.sh');
    expect(wrapper).toContain('scripts/workers/data-governance-worker.ts');
    expect(gc).toContain('garbageCollectSourceAssets');
  });

  it('completes deployment preflight before removing existing containers', () => {
    const deploy = read('deploy/podman/deploy.sh');
    const removal = deploy.indexOf('if [ "$MODE" = "--all" ] || [ "$MODE" = "--db-only" ]; then\n  remove_if_exists');
    const preflight = deploy.indexOf('# Complete all configuration validation before removing any existing');
    const preflightBlock = deploy.slice(preflight, removal);
    expect(removal).toBeGreaterThan(-1);
    expect(deploy.lastIndexOf('require_konling_mode_context_secret', removal)).toBeGreaterThan(-1);
    expect(deploy.lastIndexOf('require_grading_audit_secret', removal)).toBeGreaterThan(-1);
    expect(deploy.lastIndexOf('require_grading_lifecycle_lookup_secret', removal)).toBeGreaterThan(-1);
    expect(deploy.lastIndexOf('require_math_document_grading_worker_config', removal)).toBeGreaterThan(-1);
    expect(deploy.lastIndexOf('require_math_document_grading_worker_config', removal)).toBeLessThan(removal);
    expect(preflight).toBeGreaterThan(-1);
    expect(preflightBlock).toContain('\n  validate_grading_policy_seed_config\n');
    expect(deploy.slice(0, preflight)).toContain('ensure-grading-policies.ts --dry-run');
    expect(preflightBlock).toContain('require_math_document_grading_worker_config');
    expect(deploy).toContain('AI_PROVIDER_ENABLED=false 与数学文档批改 worker 不兼容');
    for (const prefix of ['SOURCE_ASSET', 'ANSWER_EVIDENCE', 'DOCUMENT_CONVERSION', 'AI_DRAFT', 'RUN']) {
      expect(deploy).toContain(`GRADING_${prefix}_ENABLED`);
      expect(deploy).toContain(`GRADING_${prefix}_PROVIDER_RETENTION_SECONDS`);
    }
  });

  it('exposes math worker readiness and validates its durable heartbeat in deployment', () => {
    const readyz = read('src/app/api/readyz/route.ts');
    const deploy = read('deploy/podman/deploy.sh');
    const remoteDeploy = read('scripts/remote-deploy.sh');

    expect(readyz).toContain('mathDocumentGradingWorker');
    expect(readyz).toContain('parseMathDocumentGradingWorkerCapability');
    expect(readyz).toContain('MATH_DOCUMENT_GRADING_WORKER_CAPABILITY_KEY');
    expect(readyz).toContain('configReady');
    expect(deploy).toContain('math-document-grading:worker:heartbeat');
    expect(deploy).toContain('math-document-grading:worker:capability');
    expect(remoteDeploy).toContain('math-document-grading:worker:heartbeat');
    expect(remoteDeploy).toContain('math-document-grading:worker:capability');
  });

  it('passes the audit secret only to the app, grading worker, and grading GC, and gates remote readiness on it', () => {
    const envExample = read('deploy/podman/.env.server.example');
    const deploy = read('deploy/podman/deploy.sh');
    const remoteDeploy = read('scripts/remote-deploy.sh');
    const readyzValidator = read('scripts/lib/validate-readyz.py');
    const sharedStart = deploy.indexOf('SHARED_ENV_ARGS=(');
    const sharedEnd = deploy.indexOf(')\nGRADING_AUDIT_ENV_ARGS=', sharedStart);

    expect(envExample).toContain('GRADING_AUDIT_SECRET=');
    expect(envExample).toContain('GRADING_LIFECYCLE_LOOKUP_SECRET=');
    expect(deploy).toContain('GRADING_AUDIT_SECRET');
    expect(deploy.slice(sharedStart, sharedEnd)).not.toContain('GRADING_AUDIT_SECRET');
    expect(deploy).toContain('GRADING_AUDIT_ENV_ARGS');
    expect(deploy).toMatch(/APP_ENV_ARGS=\([\s\S]*GRADING_AUDIT_ENV_ARGS/);
    expect(deploy).toMatch(/WORKER_ENV_ARGS=\([\s\S]*GRADING_AUDIT_ENV_ARGS/);
    expect(deploy).toMatch(/GC_ENV_ARGS=\([\s\S]*GRADING_AUDIT_ENV_ARGS/);
    expect(deploy).toContain('ensure-grading-policies.ts');
    expect(remoteDeploy).toContain('GC_NAME_HINT');
    expect(remoteDeploy).toMatch(/podman inspect '\$\{APP_NAME_HINT\}'[\s\S]*GRADING_AUDIT_SECRET/);
    expect(remoteDeploy).toMatch(/podman inspect '\$\{WORKER_NAME_HINT\}'[\s\S]*GRADING_AUDIT_SECRET/);
    expect(remoteDeploy).toMatch(/podman inspect '\$\{GC_NAME_HINT\}'[\s\S]*GRADING_AUDIT_SECRET/);
    expect(remoteDeploy).toMatch(/podman inspect '\$\{APP_NAME_HINT\}'[\s\S]*GRADING_LIFECYCLE_LOOKUP_SECRET/);
    expect(remoteDeploy).toMatch(/podman inspect '\$\{WORKER_NAME_HINT\}'[\s\S]*GRADING_LIFECYCLE_LOOKUP_SECRET/);
    expect(remoteDeploy).toMatch(/podman inspect '\$\{GC_NAME_HINT\}'[\s\S]*GRADING_LIFECYCLE_LOOKUP_SECRET/);
    expect(readyzValidator).toContain('get("auditSecret") is True');
  });

  it('uses the explicit seven-capability contract in the worker healthcheck and policy seed', () => {
    const readiness = read('src/lib/data-governance/math-document-grading-worker-readiness.ts');
    const deploy = read('deploy/podman/deploy.sh');
    const envExample = read('deploy/podman/.env.server.example');
    const policySeed = read('scripts/assignments/ensure-grading-policies.ts');
    for (const key of ['database', 'redis', 'objectStore', 'scanner', 'aiProvider', 'mathpix', 'auditSecret']) {
      expect(readiness).toContain(`'${key}'`);
      expect(deploy).toMatch(new RegExp(`(?:\\\\)?[\"']${key}(?:\\\\)?[\"']`));
    }
    expect(deploy).not.toContain('values.length === 6');
    expect(deploy).toContain('configReady === true');
    expect(policySeed).toContain('--dry-run');
    expect(policySeed).toContain('.upsert(');
    expect(policySeed).toContain('credentialRef');
    expect(policySeed).not.toMatch(/process\.env\.(?:AI_API_KEY|SILICONFLOW_API_KEY|MATHPIX_APP_KEY)/);
    expect(readiness).toContain('GRADING_AI_PROVIDER_ENABLED');
    expect(deploy).toContain('GRADING_AI_PROVIDER_ENABLED');
    expect(envExample).toContain('MATH_DOCUMENT_GRADING_WORKER_REQUIRED=false');
    expect(envExample).toContain('GRADING_AI_PROVIDER_ENABLED=false');
  });

  it('blocks production policy seeding when positive provider retention has no deletion adapter', () => {
    expect(() => assertProductionProviderRetentionAdapter({
      lifecycle: [{ id: 'lifecycle:conversion:v1', dataClass: 'document-conversion', version: 'v1', retentionSeconds: 60, deleteStrategy: 'delete-content', providerRetentionSeconds: 1 }],
      providers: [],
    }, true)).toThrow('provider-retention-adapter-unavailable');
    expect(() => assertProductionProviderRetentionAdapter({
      lifecycle: [{ id: 'lifecycle:conversion:v1', dataClass: 'document-conversion', version: 'v1', retentionSeconds: 60, deleteStrategy: 'delete-content', providerRetentionSeconds: 0 }],
      providers: [],
    }, true)).not.toThrow();
  });

  it('does not silently roll back failed remote migrations and does not ignore database backups', () => {
    const remoteDeploy = read('scripts/remote-deploy.sh');
    const remoteDeployStep = remoteDeploy.slice(remoteDeploy.indexOf('log "[4/5]'), remoteDeploy.indexOf('log\nlog "[5/5]'));
    expect(remoteDeploy).not.toContain('migrate resolve --rolled-back');
    expect(remoteDeploy).toContain('podman stop');
    expect(remoteDeploy).toContain('FAILED_MIGRATIONS');
    expect(remoteDeployStep).not.toMatch(/REMOTE_EXPORT_DB_SCRIPT[^\n]*\|\| true/);
  });

  it('does not turn a replay into HTTP success when durable queue delivery failed', () => {
    for (const [route, expression] of [
      ['src/app/api/teacher/document-grading/pipeline/conversions/route.ts', 'queueResult.queued ? (result.replay ? 200 : 202) : 503'],
      ['src/app/api/teacher/document-grading/pipeline/conversions/[conversionId]/route.ts', 'queue.queued ? (result.replay ? 200 : 202) : 503'],
      ['src/app/api/teacher/document-grading/pipeline/grading/route.ts', 'queueResult.queued ? (result.replay ? 200 : 202) : 503'],
      ['src/app/api/teacher/document-grading/pipeline/batches/route.ts', 'queueResult.queued ? (result.replay ? 200 : 202) : 503'],
    ]) {
      expect(read(route)).toContain(expression);
    }
  });

  it('maps batch retry reason into the shared rerun-reason validation contract', () => {
    const route = read('src/app/api/teacher/document-grading/pipeline/batches/[batchId]/route.ts');
    expect(route).toContain('rerunReason: body.reason');
  });

  it('keeps the optional math worker disabled across startup and health checks', () => {
    const worker = read('scripts/workers/data-governance-worker.ts');
    const deploy = read('deploy/podman/deploy.sh');
    const remoteDeploy = read('scripts/remote-deploy.sh');
    expect(worker).toContain('isMathDocumentGradingWorkerRequired()');
    expect(worker).toContain('Math document grading worker disabled by MATH_DOCUMENT_GRADING_WORKER_REQUIRED');
    expect(deploy).toContain('process.env.MATH_DOCUMENT_GRADING_WORKER_REQUIRED || \\\"true\\\"');
    expect(remoteDeploy).toContain('MATH_DOCUMENT_GRADING_WORKER_REQUIRED="$(remote "podman inspect');
    expect(remoteDeploy).toContain("sed -n 's/^MATH_DOCUMENT_GRADING_WORKER_REQUIRED=//p'");
    expect(remoteDeploy).toContain('fail "远端应用容器的 MATH_DOCUMENT_GRADING_WORKER_REQUIRED 缺失或无效"');
    expect(remoteDeploy).not.toContain('MATH_DOCUMENT_GRADING_WORKER_REQUIRED="${MATH_DOCUMENT_GRADING_WORKER_REQUIRED:-true}"');
    expect(remoteDeploy).toContain('数学文档批改 worker 已禁用，跳过其专用健康检查');
  });

  it('seeds lifecycle policies without requiring provider metadata when the math worker is disabled', async () => {
    const env: Record<string, string> = {
      NODE_ENV: 'production',
      MATH_DOCUMENT_GRADING_WORKER_REQUIRED: 'false',
    };
    for (const prefix of ['SOURCE_ASSET', 'ANSWER_EVIDENCE', 'DOCUMENT_CONVERSION', 'AI_DRAFT', 'RUN']) {
      env[`GRADING_${prefix}_POLICY_VERSION`] = 'v1';
      env[`GRADING_${prefix}_RETENTION_SECONDS`] = '3600';
      env[`GRADING_${prefix}_DELETE_STRATEGY`] = 'delete-content';
      env[`GRADING_${prefix}_PROVIDER_RETENTION_SECONDS`] = '0';
      env[`GRADING_${prefix}_ENABLED`] = 'true';
    }

    const config = parseGradingPolicySeedConfig(env);

    expect(config.lifecycle).toHaveLength(5);
    expect(config.providers).toEqual([]);
    const writes: unknown[] = [];
    const actions = await ensureGradingPolicies({
      db: {
        gradingLifecyclePolicy: {
          upsert: async (args) => {
            writes.push(args);
            return args.create;
          },
        },
      },
      config,
      production: true,
    });
    expect(writes).toHaveLength(5);
    expect(actions.every((action) => action.kind === 'lifecycle' && action.action === 'upserted')).toBe(true);
  });

  it('validates public readyz according to the optional math worker requirement', () => {
    const remoteDeploy = read('scripts/remote-deploy.sh');
    const readyzValidator = read('scripts/lib/validate-readyz.py');
    const packageJson = JSON.parse(read('package.json')) as { scripts: Record<string, string> };
    const readyzStart = remoteDeploy.indexOf('log "- 校验公网 readyz 健康接口"');
    const readyzEnd = remoteDeploy.indexOf('\nlog\nlog "远端部署完成并验证通过"', readyzStart);
    const readyzBlock = remoteDeploy.slice(readyzStart, readyzEnd);

    expect(readyzBlock).toContain('readyz_response=');
    expect(readyzBlock).toContain('python3 "${ROOT_DIR}/scripts/lib/validate-readyz.py" true');
    expect(readyzBlock).toContain('python3 "${ROOT_DIR}/scripts/lib/validate-readyz.py" false');
    expect(readyzBlock).toContain('if [[ "${MATH_DOCUMENT_GRADING_WORKER_REQUIRED}" =~ ^(1|true|yes)$ ]]; then');
    expect(readyzValidator).toContain('worker.get("required") is expected_required');
    expect(readyzValidator).toContain('worker.get("ready") is True');
    expect(remoteDeploy.indexOf('require_cmd python3')).toBeLessThan(remoteDeploy.indexOf('remote "mkdir -p'));
    expect(packageJson.scripts['test:math-document-grading-migration']).toContain('test:math-document-grading-readyz');
    const checker = join(process.cwd(), 'scripts/lib/validate-readyz.py');
    expect(() => execFileSync('python3', [checker, 'false'], {
      cwd: mkdtempSync(join(tmpdir(), 'readyz-non-repo-')),
      input: JSON.stringify({ db: true, redis: true, mathDocumentGradingWorker: { required: false, ready: true } }),
    })).not.toThrow();
  });

  it('keeps the example grading-run retention policy internally consistent', () => {
    const example = read('deploy/podman/.env.server.example');
    expect(example).toContain('GRADING_RUN_RETENTION_SECONDS=\n');
    expect(example).toContain('GRADING_RUN_GOVERNED_RECORD_RULE=grading-run-governed-record.v1');
    expect(example).toContain('GRADING_RUN_DELETE_STRATEGY=retain-governed-record');
  });

  it('does not accept client evaluator identity on the provider-backed API surface', () => {
    for (const route of [
      'src/app/api/teacher/document-grading/pipeline/grading/route.ts',
      'src/app/api/teacher/document-grading/pipeline/batches/route.ts',
    ]) {
      expect(read(route)).not.toContain('body.evaluatorId');
      expect(read(route)).not.toContain('body.evaluatorVersion');
    }
  });

  it('requires a provider policy before the grading queue is created', () => {
    const route = read('src/app/api/teacher/document-grading/pipeline/grading/route.ts');
    expect(route).toContain('policyId: z.string().trim().min(1).max(160),');
    expect(route).toContain('policyId: body.policyId,');
    expect(route).not.toContain('policyId: body.policyId ?? null');
  });
});
