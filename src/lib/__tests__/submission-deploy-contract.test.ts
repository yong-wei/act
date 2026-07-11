import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(join(process.cwd(), path), 'utf8');

describe('submission object production deployment contract', () => {
  it('fails closed unless private storage and one external scanner mode are configured', () => {
    const deploy = read('deploy/podman/deploy.sh');
    expect(deploy).toContain('require_submission_security_pipeline');
    expect(deploy).toContain('SUBMISSION_OBJECT_STORE:-}" != "s3"');
    expect(deploy).toContain('SUBMISSION_SCANNER_MODE:-}" != "s3-object-tag"');
    expect(deploy).toContain('clamav-tcp)'); expect(deploy).toContain('https)');
    expect(deploy.indexOf('check-submission-object-health.ts')).toBeLessThan(deploy.indexOf('echo "- 启动应用容器'));
  });

  it('runs scanner continuously and GC periodically without replacing data governance worker', () => {
    const wrapper = read('deploy/podman/container-start-wrapper.sh'); const deploy = read('deploy/podman/deploy.sh');
    expect(wrapper).toContain('ROLE" = "submission-scanner"'); expect(wrapper).toContain('scan-submission-objects.ts'); expect(wrapper).toContain('SUBMISSION_SCAN_INTERVAL_SECONDS');
    expect(wrapper).toContain('if ! ./docker-entrypoint.sh ./node_modules/.bin/tsx scripts/assignments/scan-submission-objects.ts');
    expect(wrapper).toContain('扫描批次失败，将在间隔后重试');
    expect(wrapper).toContain('ROLE" = "submission-gc"'); expect(wrapper).toContain('gc-submission-objects.ts'); expect(wrapper).toContain('SUBMISSION_GC_INTERVAL_SECONDS');
    expect(wrapper).toContain('scripts/workers/data-governance-worker.ts');
    expect(deploy).toContain('/app-container-start-wrapper.sh submission-scanner'); expect(deploy).toContain('/app-container-start-wrapper.sh submission-gc'); expect(deploy).toContain('/app-container-start-wrapper.sh worker');
  });

  it('systemd stops and validates both submission workers', () => {
    const service = read('deploy/podman/configure-service.sh');
    expect(service).toContain('ExecStop=/usr/bin/podman stop -t 20 ${SUBMISSION_SCANNER_CONTAINER}');
    expect(service).toContain('ExecStop=/usr/bin/podman stop -t 20 ${SUBMISSION_GC_CONTAINER}');
    expect(service).toContain('学生作业扫描 worker 未运行'); expect(service).toContain('学生作业 GC worker 未运行');
  });

  it('isolates app, scanner, GC, and data-worker storage credentials', () => {
    const deploy = read('deploy/podman/deploy.sh');
    const app = deploy.match(/APP_STORAGE_ENV_ARGS=\(([^\n]+)\)/)?.[1] ?? '';
    const scanner = deploy.match(/SCANNER_ENV_ARGS=\(([^\n]+)\)/)?.[1] ?? '';
    const gc = deploy.match(/GC_ENV_ARGS=\(([^\n]+)\)/)?.[1] ?? '';
    const dataWorker = deploy.match(/WORKER_ENV_ARGS=\(([\s\S]*?)\n\)/)?.[1] ?? '';
    expect(app).toContain('SUBMISSION_S3_SECRET_KEY'); expect(app).not.toContain('SUBMISSION_SCANNER_SECRET_KEY'); expect(app).not.toContain('SUBMISSION_GC_SECRET_KEY');
    expect(scanner).toContain('SUBMISSION_SCANNER_SECRET_KEY'); expect(scanner).not.toContain('SUBMISSION_S3_SECRET_KEY'); expect(scanner).not.toContain('SUBMISSION_GC_SECRET_KEY');
    expect(gc).toContain('SUBMISSION_GC_SECRET_KEY'); expect(gc).not.toContain('SUBMISSION_S3_SECRET_KEY'); expect(gc).not.toContain('SUBMISSION_SCANNER_SECRET_KEY');
    expect(dataWorker).not.toMatch(/SUBMISSION_(?:S3|SCANNER|GC)_(?:ACCESS_KEY|SECRET_KEY)/);
    expect(deploy).toContain('"${APP_STORAGE_ENV_ARGS[@]}"'); expect(deploy).toContain('"${SCANNER_ENV_ARGS[@]}"'); expect(deploy).toContain('"${GC_ENV_ARGS[@]}"');
  });
});
