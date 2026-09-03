import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';

const hasEnvFile = existsSync('.env');
if (hasEnvFile) process.loadEnvFile('.env');

const scannerEnabled = process.env.SUBMISSION_OBJECT_STORE === 's3'
  && process.env.SUBMISSION_SCANNER_MODE === 's3-object-tag'
  && ['clamav-tcp', 'https'].includes(process.env.SUBMISSION_CONTENT_SCANNER ?? '');
let stopping = false;
let scanning = false;
let scanTimer;

function runScannerBatch() {
  if (!scannerEnabled || stopping || scanning) return;
  scanning = true;
  const worker = spawn(process.execPath, [
    ...(hasEnvFile ? ['--env-file=.env'] : []),
    '--import', 'tsx',
    'scripts/assignments/scan-submission-objects.ts',
  ], { stdio: ['ignore', 'ignore', 'pipe'] });
  let stderr = '';
  worker.stderr.on('data', (chunk) => { stderr += chunk; });
  worker.once('close', (code) => {
    scanning = false;
    if (!stopping && code !== 0) {
      process.stderr.write(`[local-submission-scan] 扫描批次失败：${stderr.trim() || `退出码 ${code}`}\n`);
    }
  });
}

const next = spawn(process.execPath, [
  './node_modules/next/dist/bin/next',
  'dev',
  ...process.argv.slice(2),
], { stdio: 'inherit' });

if (scannerEnabled) {
  runScannerBatch();
  scanTimer = setInterval(runScannerBatch, Number(process.env.SUBMISSION_SCAN_INTERVAL_SECONDS ?? '3') * 1000);
}

function stop(signal) {
  stopping = true;
  if (scanTimer) clearInterval(scanTimer);
  next.kill(signal);
}

process.once('SIGINT', () => stop('SIGINT'));
process.once('SIGTERM', () => stop('SIGTERM'));
next.once('close', (code) => {
  stopping = true;
  if (scanTimer) clearInterval(scanTimer);
  process.exitCode = code ?? 0;
});
