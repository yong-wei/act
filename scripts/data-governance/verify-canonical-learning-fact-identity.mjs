#!/usr/bin/env node
/**
 * #1116 operational verification for Canonical LearningFact fixed identity.
 *
 * - Producer inventory static gate
 * - Authority selector remains LEGACY for formal production
 * - Shadow validation path is importable and zero-write by construction
 *
 * Does not activate Canonical authority, migrate data, or write LearningFacts.
 */

import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

async function main() {
  const modulePath = pathToFileURL(
    path.join(root, 'src/lib/canonical-learning-fact-identity/index.ts'),
  ).href;

  // tsx resolves TypeScript; under plain node this script is run via tsx/npm.
  const identity = await import(modulePath);

  const findings = identity.runLearningFactProducerStaticGate(root);
  if (findings.length > 0) {
    console.error('LearningFact producer static gate failed:');
    for (const finding of findings) {
      console.error(`- ${finding.code}@${finding.path}: ${finding.detail}`);
    }
    process.exitCode = 1;
    return;
  }

  const production = identity.selectLearningFactAuthority('FORMAL_PRODUCTION');
  if (
    production.authority !== 'LEGACY'
    || production.canonicalWriterEnabled
    || !production.productionAuthoritative
  ) {
    console.error('Formal LearningFact authority must remain LEGACY before #1117');
    process.exitCode = 1;
    return;
  }

  let cutoverBlocked = false;
  try {
    identity.selectLearningFactAuthority('CUTOVER_ACTIVATION');
  } catch {
    cutoverBlocked = true;
  }
  if (!cutoverBlocked) {
    console.error('CUTOVER_ACTIVATION must remain non-executable in #1116');
    process.exitCode = 1;
    return;
  }

  const inventory = identity.KNOWLEDGE_SCOPED_LEARNING_FACT_PRODUCERS;
  console.log(JSON.stringify({
    ok: true,
    change: 'write-learning-facts-with-canonical-knowledge',
    productionAuthority: production.authority,
    canonicalWriterEnabled: production.canonicalWriterEnabled,
    producerCount: inventory.length,
    producers: inventory.map((item) => ({
      id: item.id,
      path: item.path,
      adapter: item.adapter,
    })),
    staticGateFindings: 0,
    note: 'Canonical authority activation is reserved for #1117; shadow validation only.',
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
