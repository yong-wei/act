import { buildProviderRuntimeSmokeReport } from '../../src/lib/ai/provider-runtime-smoke';

const report = buildProviderRuntimeSmokeReport();

for (const check of report.checks) {
  const provider = check.providerId ?? 'none';
  console.log(`${check.ok ? 'ok' : 'fail'} ${check.id} provider=${provider} category=${check.capabilityCategory}: ${check.detail}`);
}

if (!report.ok) {
  process.exitCode = 1;
}
