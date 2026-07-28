#!/usr/bin/env node

import fs from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import process from 'node:process';
import Ajv2020 from 'ajv/dist/2020.js';

function parseArgs(argv) {
  const indexDirs = [];
  const files = [];
  let schemaPath =
    'course-content/contracts/textbook-hybrid-retrieval-v1.schema.json';
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--schema') {
      schemaPath = argv[++index];
    } else if (argument === '--index-dir') {
      indexDirs.push(argv[++index]);
    } else if (
      argument === '--file'
      || argument === '--fixture'
      || argument === '--manifest'
      || argument === '--windows'
      || argument === '--build-report'
      || argument === '--selection-report'
      || argument === '--acceptance-report'
    ) {
      files.push(argv[++index]);
    } else {
      throw new Error(`unknown argument: ${argument}`);
    }
  }
  if (indexDirs.length === 0 && files.length === 0) {
    throw new Error('at least one --index-dir or --file is required');
  }
  return { files, indexDirs, schemaPath };
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function readJsonl(filePath) {
  return fs.readFileSync(filePath, 'utf8')
    .split(/\r?\n/u)
    .filter((line) => line.trim().length > 0)
    .map((line) => JSON.parse(line));
}

function recordsForFile(filePath) {
  return filePath.endsWith('.jsonl')
    ? readJsonl(filePath)
    : [readJson(filePath)];
}

function recordsForIndex(indexDir) {
  return [
    ...recordsForFile(path.join(indexDir, 'manifest.json')),
    ...recordsForFile(path.join(indexDir, 'windows.jsonl')),
    ...recordsForFile(path.join(indexDir, 'lexical-terms.jsonl')),
    ...recordsForFile(path.join(indexDir, 'build-report.json')),
  ];
}

function sha256File(filePath) {
  return `sha256:${createHash('sha256').update(fs.readFileSync(filePath)).digest('hex')}`;
}

function compareUtf8(left, right) {
  return Buffer.compare(Buffer.from(left, 'utf8'), Buffer.from(right, 'utf8'));
}

function readUnsignedVarint(buffer, start, end) {
  let value = 0;
  let shift = 0;
  let offset = start;
  while (offset < end) {
    if (shift > 49) throw new Error('varint value exceeds the supported range');
    const byte = buffer[offset++];
    const payload = byte & 0x7f;
    value += payload * (2 ** shift);
    if (!Number.isSafeInteger(value)) {
      throw new Error('varint value exceeds the supported range');
    }
    if (byte < 0x80) {
      if (offset - start > 1 && payload === 0) {
        throw new Error('lexical postings contain noncanonical varint');
      }
      return [value, offset];
    }
    shift += 7;
  }
  throw new Error('lexical postings contain a truncated varint');
}

function compactLexicalError(indexDir) {
  try {
    const manifest = readJson(path.join(indexDir, 'manifest.json'));
    const lexicalRecords = readJsonl(path.join(indexDir, 'lexical-terms.jsonl'));
    const postings = fs.readFileSync(path.join(indexDir, 'lexical-postings.bin'));
    for (const [name, expectedHash] of Object.entries(manifest.files ?? {})) {
      if (sha256File(path.join(indexDir, name)) !== expectedHash) {
        return `index file hash mismatch: ${name}`;
      }
    }
    const [header, ...terms] = lexicalRecords;
    if (
      header?.recordType !== 'lexical-terms-header'
      || header.formatVersion !== manifest.formatVersion
      || header.normalizationVersion !== manifest.normalizationVersion
    ) {
      return 'lexical terms identity is invalid';
    }
    const tokens = terms.map((term) => term.token);
    if (
      new Set(tokens).size !== tokens.length
      || tokens.join('\0') !== [...tokens].sort(compareUtf8).join('\0')
    ) {
      return 'lexical terms are not sorted';
    }
    let nextOffset = 0;
    for (const term of terms) {
      const { token } = term;
      if (
        term.recordType !== 'lexical-term'
        ||
        token !== token.normalize('NFKC').toLowerCase()
        || term.byteOffset !== nextOffset
      ) return 'lexical term offsets are not contiguous and normalized';
      const end = term.byteOffset + term.byteLength;
      if (end > postings.length) return 'lexical term slice exceeds postings binary';
      let offset = term.byteOffset;
      let previous = -1;
      for (let index = 0; index < term.postingCount; index += 1) {
        const [delta, afterDelta] = readUnsignedVarint(postings, offset, end);
        const [frequency, afterFrequency] = readUnsignedVarint(
          postings, afterDelta, end,
        );
        const row = previous + delta;
        if (
          delta <= 0
          || row <= previous
          || row >= manifest.counts.windows
          || frequency <= 0
        ) return 'lexical posting row is invalid';
        previous = row;
        offset = afterFrequency;
      }
      if (offset !== end) return 'lexical posting count does not close its slice';
      nextOffset = end;
    }
    if (nextOffset !== postings.length) {
      return 'lexical term offsets do not close over postings binary';
    }
    if (tokens.length !== manifest.counts.lexicalTerms) {
      return 'lexical term count is invalid';
    }
    return null;
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
}

const declaredModels = [
  'BAAI/bge-m3',
  'Qwen/Qwen3-Embedding-0.6B',
  'Qwen/Qwen3-Embedding-4B',
];
const inputCnyPerMillionTokens = {
  'BAAI/bge-m3': 0,
  'Qwen/Qwen3-Embedding-0.6B': 0.07,
  'Qwen/Qwen3-Embedding-4B': 0.14,
};
const safeTraceId = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,199}$/u;

function percentile(values, fraction) {
  const ordered = [...values].sort((left, right) => left - right);
  const position = (ordered.length - 1) * fraction;
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  return lower === upper
    ? ordered[lower]
    : ordered[lower] + (ordered[upper] - ordered[lower]) * (position - lower);
}

function approximatelyEqual(left, right) {
  return Math.abs(left - right) <= 1e-12 * Math.max(1, Math.abs(left), Math.abs(right));
}

function tracesAreSafe(values) {
  return Array.isArray(values)
    && new Set(values).size === values.length
    && values.every((value) => typeof value === 'string' && safeTraceId.test(value));
}

function latencyError(latency, allowEmpty) {
  const samples = latency?.samples;
  if (
    !Array.isArray(samples)
    || latency.batchCount !== samples.length
    || samples.some((sample) => !Number.isFinite(sample) || sample < 0)
  ) return true;
  if (samples.length === 0) {
    return !allowEmpty || latency.p50 !== 0 || latency.p95 !== 0 || latency.total !== 0;
  }
  return !approximatelyEqual(latency.p50, percentile(samples, 0.5))
    || !approximatelyEqual(latency.p95, percentile(samples, 0.95))
    || !approximatelyEqual(
      latency.total,
      samples.reduce((total, sample) => total + sample, 0),
    );
}

function metricError(candidate) {
  const samples = candidate.embeddingLatencyMs?.samples;
  const results = candidate.results;
  const recallPassed = candidate.recallAt10 >= candidate.threshold;
  const isSelectionCandidate = candidate.recallPassed !== undefined;
  if (
    latencyError(candidate.embeddingLatencyMs, false)
    || !Array.isArray(results)
    || candidate.evaluatedQueries !== results.length
    || candidate.hitsAt10 !== results.filter((row) => row.hitAt10).length
    || candidate.recallAt10 !== (
      candidate.evaluatedQueries === 0
        ? 0
        : candidate.hitsAt10 / candidate.evaluatedQueries
    )
    || (
      isSelectionCandidate
        ? candidate.recallPassed !== recallPassed
          || candidate.passed !== (
            candidate.recallPassed && candidate.residentArtifactPassed
          )
        : candidate.passed !== recallPassed
    )
    || candidate.indexBytes < candidate.vectorBytes
    || !tracesAreSafe(candidate.queryTraceIds)
    || !tracesAreSafe(candidate.providerTraceIds)
    || candidate.queryTraceIds.some((traceId) =>
      !candidate.providerTraceIds.includes(traceId))
    || !approximatelyEqual(
      candidate.queryApiCostCny,
      candidate.queryUsageTokens
        * inputCnyPerMillionTokens[candidate.model] / 1_000_000,
    )
  ) {
    return 'evaluation metrics are internally inconsistent';
  }
  return null;
}

function semanticError(record) {
  if (record.recordType === 'index-window') {
    if (
      record.id !== record.sourceWindowId
      && !record.id.startsWith(`${record.sourceWindowId}::embedding-chunk-`)
    ) return 'index window does not match its source window identity';
  } else if (record.recordType === 'lexical-term') {
    if (record.token !== record.token.normalize('NFKC').toLowerCase()) {
      return 'lexical terms must be normalized';
    }
  } else if (record.recordType === 'build-report') {
    if (
      record.cacheHits + record.cacheMisses !== record.windowCount
      || latencyError(record.providerLatencyMs, true)
      || record.providerLatencyMs.batchCount !== record.providerBatches
      || !tracesAreSafe(record.providerTraceIds)
      || record.providerTraceIds.length > record.providerBatches
      || (record.cacheMisses === 0) !== (record.providerBatches === 0)
    ) return 'build provider evidence is internally inconsistent';
  } else if (record.recordType === 'selection-report') {
    const candidates = record.candidates;
    if (
      !Array.isArray(candidates)
      || candidates.length !== 3
      || JSON.stringify(candidates.map((candidate) => candidate.model).sort())
        !== JSON.stringify([...declaredModels].sort())
    ) {
      return 'selection report must contain exactly the three declared models';
    }
    const metricFailure = candidates.map(metricError).find(Boolean);
    if (metricFailure) {
      return metricFailure;
    }
    if (candidates.some((candidate) => (
      !tracesAreSafe(candidate.corpusTraceIds)
      || candidate.residentArtifactBudgetBytes !== 150 * 1024 * 1024
      || candidate.residentArtifactPassed !== (
        candidate.residentArtifactBytes <= candidate.residentArtifactBudgetBytes
      )
      || candidate.residentArtifactBytes < candidate.vectorBytes
      || candidate.indexBytes < candidate.residentArtifactBytes
      || candidate.usageTokens
        !== candidate.corpusUsageTokens + candidate.queryUsageTokens
      || !approximatelyEqual(
        candidate.corpusApiCostCny,
        candidate.corpusUsageTokens
          * inputCnyPerMillionTokens[candidate.model] / 1_000_000,
      )
      || !approximatelyEqual(
        candidate.apiCostCny,
        candidate.corpusApiCostCny + candidate.queryApiCostCny,
      )
      || JSON.stringify(candidate.providerTraceIds)
        !== JSON.stringify([...new Set([
          ...candidate.corpusTraceIds,
          ...candidate.queryTraceIds,
        ])])
    ))) {
      return 'selection usage, cost, or trace evidence is internally inconsistent';
    }
    const passing = candidates.filter((candidate) => candidate.passed);
    if (passing.length === 0) {
      return 'selection report has no passing candidate';
    }
    passing.sort((left, right) => (
      left.apiCostCny - right.apiCostCny
      || left.indexBytes - right.indexBytes
      || left.model.localeCompare(right.model)
    ));
    const selected = passing[0];
    if (
      record.selectionRule
        !== 'recall-and-resident-artifact-passing-apiCostCny-indexBytes-model'
      ||
      record.selectedModel !== selected.model
      || record.selectedObservedDimension !== selected.observedDimension
      || record.selectedNormalizationVersion !== selected.normalizationVersion
      || record.selectedIndexManifestHash !== selected.indexManifestHash
    ) {
      return 'selection report selected candidate violates the deterministic rule';
    }
  } else if (record.recordType === 'acceptance-report') {
    return metricError(record)
      || (
        record.usageTokens !== record.queryUsageTokens
        || !approximatelyEqual(record.apiCostCny, record.queryApiCostCny)
        || JSON.stringify(record.providerTraceIds)
          !== JSON.stringify(record.queryTraceIds)
          ? 'acceptance usage, cost, or trace evidence is internally inconsistent'
          : null
      );
  }
  return null;
}

function main() {
  const { files, indexDirs, schemaPath } = parseArgs(process.argv.slice(2));
  const schema = readJson(schemaPath);
  const validate = new Ajv2020({
    allErrors: true,
    strict: true,
  }).compile(schema);
  const failures = [];
  let recordsValidated = 0;
  const validateRecord = (record, source) => {
    recordsValidated += 1;
    const structurallyValid = validate(record);
    const semanticFailure = structurallyValid ? semanticError(record) : null;
    if (!structurallyValid || semanticFailure) {
      failures.push({
        source,
        recordType: record?.recordType ?? '<missing>',
        id: record?.id ?? record?.sourceRevision ?? '<missing>',
        errors: semanticFailure
          ? [{ keyword: 'semantic', message: semanticFailure }]
          : validate.errors,
      });
    }
  };
  for (const indexDir of indexDirs) {
    for (const record of recordsForIndex(indexDir)) {
      validateRecord(record, indexDir);
    }
    const compactFailure = compactLexicalError(indexDir);
    if (compactFailure) {
      failures.push({
        source: indexDir,
        recordType: 'lexical-index',
        id: '<compact-layout>',
        errors: [{ keyword: 'semantic', message: compactFailure }],
      });
    }
  }
  for (const filePath of files) {
    for (const record of recordsForFile(filePath)) {
      validateRecord(record, filePath);
    }
  }
  process.stdout.write(`${JSON.stringify({
    schemaVersion: schema.title,
    indexDirectories: indexDirs.length,
    files: files.length,
    recordsValidated,
    failures,
  }, null, 2)}\n`);
  return failures.length === 0 ? 0 : 1;
}

try {
  process.exitCode = main();
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
}
