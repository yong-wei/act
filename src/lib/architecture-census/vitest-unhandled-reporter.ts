import { writeFileSync } from 'node:fs';

export default class ArchitectureCensusVitestReporter {
  onTestRunEnd(_testModules: unknown, unhandledErrors: readonly unknown[] = []): void {
    const output = process.env.ARCHITECTURE_CENSUS_VITEST_SIDECAR;
    if (!output) return;
    writeFileSync(output, `${JSON.stringify({ unhandledErrorCount: unhandledErrors.length })}\n`);
  }
}
