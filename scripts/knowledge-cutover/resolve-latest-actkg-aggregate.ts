#!/usr/bin/env tsx

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { resolveLatestStableAggregate } from '../actkg-release/latest-stable-aggregate';

function fail(message: string): never {
  throw new Error(`resolve-latest-actkg-aggregate: ${message}`);
}

function parseArgs(argv: string[]): {
  actkgRoot: string;
  mainRef: string;
  outputJson: string;
  outputMarkdown: string;
} {
  const values = new Map<string, string>();
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index];
    const value = argv[index + 1];
    if (!key?.startsWith('--') || !value || value.startsWith('--')) {
      fail(`invalid argument near ${key ?? '<end>'}`);
    }
    if (values.has(key)) fail(`duplicate option ${key}`);
    values.set(key, value);
  }
  const allowed = new Set([
    '--actkg-root',
    '--main-ref',
    '--output-json',
    '--output-markdown',
  ]);
  for (const key of values.keys()) {
    if (!allowed.has(key)) fail(`unknown option ${key}`);
  }
  const required = (key: string): string => {
    const value = values.get(key);
    if (!value) fail(`missing ${key}`);
    return value;
  };
  return {
    actkgRoot: required('--actkg-root'),
    mainRef: values.get('--main-ref') ?? 'origin/main',
    outputJson: required('--output-json'),
    outputMarkdown: required('--output-markdown'),
  };
}

async function writeImmutable(filePath: string, content: string): Promise<void> {
  const absolute = path.resolve(filePath);
  await mkdir(path.dirname(absolute), { recursive: true });
  const existing = await readFile(absolute, 'utf8').catch(() => null);
  if (existing !== null && existing !== content) {
    fail(`refusing to overwrite immutable artifact ${absolute}`);
  }
  if (existing === null) await writeFile(absolute, content);
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const binding = await resolveLatestStableAggregate({
    actkgRoot: args.actkgRoot,
    mainRef: args.mainRef,
  });
  const artifact = {
    status: 'PASS',
    ...binding,
    gates: {
      LATEST_STABLE_AGGREGATE_RESOLUTION_GATE: 'PASS',
      LATEST_BUNDLE_INTEGRITY_GATE: 'PASS',
      LATEST_CANDIDATE_IMPORT_GATE: 'NOT_RUN',
      LATEST_DELTA_RECEIPT_ALIGNMENT_GATE: 'NOT_RUN',
      LATEST_COURSE_COVERAGE_ALIGNMENT_GATE: 'NOT_RUN',
      PRODUCTION_SELECTOR_CHANGE: 0,
      GRAPH_RAG_SELECTOR_CHANGE: 0,
      TEACHING_RELATION_GENERATION: 'NOT_RUN',
      PROJECTION_GENERATION: 'NOT_RUN',
      ATTESTATION_GENERATION: 'NOT_RUN',
    },
  };
  const json = `${JSON.stringify(artifact, null, 2)}\n`;
  const markdown = `# Issue #1179：最新稳定 ActKG Aggregate binding

\`\`\`text
status=PASS
protocol=${binding.protocol}
selection_policy=${binding.selectionPolicy}
release_id=${binding.releaseId}
release_version=${binding.releaseVersion}
bundle_revision=${binding.bundleRevision}
bundle_id=${binding.bundleId}
actkg_main_commit=${binding.actkgMainCommit}
source_commit=${binding.sourceCommit}
source_tag=${binding.sourceTag}
packaging_commit=${binding.packagingCommit}
stable_tag=${binding.stableTag}
release_hash=${binding.releaseHash}
source_dataset_hash=${binding.sourceDatasetHash}
bundle_digest=${binding.bundleDigest}
manifest_sha256=${binding.manifestSha256}
sha256sums_sha256=${binding.sha256sumsSha256}
validation_report_sha256=${binding.validationReportSha256}
schema_version=${binding.schemaVersion}
schema_sha256=${binding.schemaSha256}
predecessor_bundle_id=${binding.predecessorBundleId}
candidate_chain=${JSON.stringify(binding.candidateChain)}
candidate_chain_endpoints=${JSON.stringify(binding.candidateChainEndpoints)}
statistics=${JSON.stringify(binding.statistics)}
bundle_path=${binding.bundlePath}
predecessor_root_closure=${JSON.stringify(binding.predecessorRootClosure)}
resolved_at=${binding.resolvedAt}
resolution_digest=${binding.resolutionDigest}
\`\`\`

## 门禁

\`\`\`text
LATEST_STABLE_AGGREGATE_RESOLUTION_GATE=PASS
LATEST_BUNDLE_INTEGRITY_GATE=PASS
LATEST_CANDIDATE_IMPORT_GATE=NOT_RUN
LATEST_DELTA_RECEIPT_ALIGNMENT_GATE=NOT_RUN
LATEST_COURSE_COVERAGE_ALIGNMENT_GATE=NOT_RUN
PRODUCTION_SELECTOR_CHANGE=0
GRAPH_RAG_SELECTOR_CHANGE=0
TEACHING_RELATION_GENERATION=NOT_RUN
PROJECTION_GENERATION=NOT_RUN
ATTESTATION_GENERATION=NOT_RUN
\`\`\`

本工件只冻结动态解析结果，不表示 ACT 已完成候选导入、Delta 或 CourseCoverage。
`;
  await writeImmutable(args.outputJson, json);
  await writeImmutable(args.outputMarkdown, markdown);
  process.stdout.write(json);
}

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
