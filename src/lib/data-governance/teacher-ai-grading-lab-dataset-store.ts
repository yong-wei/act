import { createHash } from 'node:crypto';
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, relative, resolve } from 'node:path';

import {
  parseTeacherAiGradingBaseline,
  parseTeacherAiGradingManifest,
  parseTeacherAiGradingQuestions,
  type ParsedGradingQuestionSet,
  type TeacherAiGradingLabBaseline,
  type TeacherAiGradingLabConfig,
  type TeacherAiGradingLabManifest,
} from './teacher-ai-grading-lab-contracts';
import { importTeacherAiGradingPackageZip } from './teacher-ai-grading-lab-import';
import {
  projectTeacherAiGradingModelSubmission,
  TeacherAiGradingRedactionError,
  type TeacherAiGradingModelSubmission,
  type TeacherAiGradingRedactedDocument,
  type TeacherAiGradingRedactionReview,
} from './teacher-ai-grading-lab-redaction';

export interface TeacherAiGradingLabDatasetKey {
  datasetId: string;
  datasetVersion: string;
}

export interface LoadedTeacherAiGradingEvaluationDataset extends TeacherAiGradingLabDatasetKey {
  manifest: TeacherAiGradingLabManifest;
  questions: ParsedGradingQuestionSet;
  contentHash: string;
  readSubmission(sampleId: string, questionId: string): Promise<Buffer>;
  readAsset(logicalPath: string): Promise<Buffer>;
  readModelSubmission(sampleId: string, questionId: string): Promise<TeacherAiGradingModelSubmission & { checksum: string; sourceChecksum: string }>;
  saveRedaction(input: {
    document: TeacherAiGradingRedactedDocument;
    review: TeacherAiGradingRedactionReview;
  }): Promise<void>;
}

export interface LoadedTeacherAiGradingLabDataset extends LoadedTeacherAiGradingEvaluationDataset {
  baseline: TeacherAiGradingLabBaseline;
}

export interface TeacherAiGradingLabDatasetStore {
  importPackage(packageBytes: Buffer): Promise<{
    datasetId: string;
    datasetVersion: string;
    datasetKind: TeacherAiGradingLabManifest['datasetKind'];
    sampleCount: number;
    runnable: false;
    redactionState: 'pending';
  }>;
  list(): Promise<{
    datasets: Array<{
      datasetId: string;
      datasetVersion: string;
      datasetKind: TeacherAiGradingLabManifest['datasetKind'];
      sampleCount: number;
      questionCount: number;
    }>;
    incompatible: Array<{ datasetId: string; datasetVersion: string; reason: string }>;
  }>;
  loadEvaluation(key: TeacherAiGradingLabDatasetKey): Promise<LoadedTeacherAiGradingEvaluationDataset>;
  load(key: TeacherAiGradingLabDatasetKey): Promise<LoadedTeacherAiGradingLabDataset>;
}

export function createFileSystemTeacherAiGradingLabDatasetStore(input: {
  dataRoot: string;
  ownerTeacherUserId?: string;
}): TeacherAiGradingLabDatasetStore {
  const dataRoot = requireAbsoluteRoot(input.dataRoot);
  const config: TeacherAiGradingLabConfig = {
    dataRoot,
    ownerTeacherUserId: input.ownerTeacherUserId ?? 'grading-lab-dataset-store',
  };
  return {
    async importPackage(packageBytes) {
      const imported = await importTeacherAiGradingPackageZip(packageBytes, config);
      return {
        datasetId: imported.manifest.datasetId,
        datasetVersion: imported.manifest.datasetVersion,
        datasetKind: imported.manifest.datasetKind,
        sampleCount: imported.manifest.samples.length,
        runnable: imported.runnable,
        redactionState: imported.redactionState,
      };
    },
    async list() {
      const datasetsRoot = controlledPath(dataRoot, 'datasets');
      let datasetIds: string[];
      try {
        datasetIds = (await readdir(datasetsRoot, { withFileTypes: true }))
          .filter((entry) => entry.isDirectory() && /^[a-z0-9][a-z0-9_-]{1,63}$/.test(entry.name))
          .map((entry) => entry.name);
      } catch (error: any) {
        if (error?.code === 'ENOENT') return { datasets: [], incompatible: [] };
        throw error;
      }
      // 旧数据集可能违反 0.5 分粒度等量规契约；逐份隔离并显式上报原因，
      // 不得让单个不兼容数据集阻断整个实验室概览。
      const incompatible: Array<{ datasetId: string; datasetVersion: string; reason: string }> = [];
      const datasets: Array<{
        datasetId: string;
        datasetVersion: string;
        datasetKind: TeacherAiGradingLabManifest['datasetKind'];
        sampleCount: number;
        questionCount: number;
      }> = [];
      for (const datasetId of datasetIds) {
        const versions = await readdir(controlledPath(datasetsRoot, datasetId), { withFileTypes: true });
        for (const entry of versions) {
          if (!entry.isDirectory() || !/^[a-z0-9][a-z0-9_-]{1,63}$/.test(entry.name)) continue;
          try {
            const loaded = await loadEvaluationDataset(dataRoot, config, { datasetId, datasetVersion: entry.name });
            datasets.push({
              datasetId: loaded.datasetId,
              datasetVersion: loaded.datasetVersion,
              datasetKind: loaded.manifest.datasetKind,
              sampleCount: loaded.manifest.samples.length,
              questionCount: loaded.questions.questions.length,
            });
          } catch (error) {
            incompatible.push({
              datasetId,
              datasetVersion: entry.name,
              reason: error instanceof Error ? error.message : String(error),
            });
          }
        }
      }
      return {
        datasets: datasets.sort((left, right) => (
          left.datasetId.localeCompare(right.datasetId) || left.datasetVersion.localeCompare(right.datasetVersion)
        )),
        incompatible: incompatible.sort((left, right) => (
          left.datasetId.localeCompare(right.datasetId) || left.datasetVersion.localeCompare(right.datasetVersion)
        )),
      };
    },
    async loadEvaluation(key) {
      return loadEvaluationDataset(dataRoot, config, key);
    },
    async load(key) {
      const evaluation = await loadEvaluationDataset(dataRoot, config, key);
      const { datasetId, datasetVersion, manifest } = evaluation;
      const datasetRoot = controlledPath(dataRoot, 'datasets', datasetId, datasetVersion);
      const baselineBytes = await readFile(controlledLogicalPath(datasetRoot, manifest.baseline.path));
      assertChecksum(baselineBytes, manifest.baseline.checksum, 'teacher-ai-grading-dataset-baseline-checksum-mismatch');
      const baseline = parseTeacherAiGradingBaseline(JSON.parse(decodeUtf8(baselineBytes)));
      return {
        ...evaluation,
        baseline,
      };
    },
  };
}

async function loadEvaluationDataset(
  dataRoot: string,
  config: TeacherAiGradingLabConfig,
  key: TeacherAiGradingLabDatasetKey,
): Promise<LoadedTeacherAiGradingEvaluationDataset> {
  const datasetId = requireIdentifier(key.datasetId, 'teacher-ai-grading-dataset-id-invalid');
  const datasetVersion = requireIdentifier(key.datasetVersion, 'teacher-ai-grading-dataset-version-invalid');
  const datasetRoot = controlledPath(dataRoot, 'datasets', datasetId, datasetVersion);
  const manifest = parseTeacherAiGradingManifest(JSON.parse(await readUtf8(controlledPath(datasetRoot, 'manifest.json'))));
  if (manifest.datasetId !== datasetId || manifest.datasetVersion !== datasetVersion) throw new Error('teacher-ai-grading-dataset-identity-mismatch');
  const questionBytes = await readFile(controlledLogicalPath(datasetRoot, manifest.question.path));
  assertChecksum(questionBytes, manifest.question.checksum, 'teacher-ai-grading-dataset-question-checksum-mismatch');
  const availablePaths = new Set([
    manifest.question.path,
    manifest.baseline.path,
    ...manifest.assets.map((asset) => asset.path),
    ...manifest.samples.flatMap((sample) => sample.submissions.map((submission) => submission.path)),
  ]);
  const questions = parseTeacherAiGradingQuestions(decodeUtf8(questionBytes), availablePaths);
  // The manifest commits baseline.json by checksum, so evaluation drift can be
  // detected without opening or parsing the human scores before AI execution.
  const contentHash = sha256(Buffer.from(stableStringify({ manifest, questions })));
  const ownerTeacherUserId = config.ownerTeacherUserId;
  return {
    datasetId, datasetVersion, manifest, questions, contentHash,
    async readSubmission(sampleId, questionId) {
      const submission = findSubmission(manifest, sampleId, questionId);
      const bytes = await readFile(controlledLogicalPath(datasetRoot, submission.path));
      assertChecksum(bytes, submission.checksum, 'teacher-ai-grading-dataset-submission-checksum-mismatch');
      return bytes;
    },
    async readAsset(logicalPath) {
      const asset = manifest.assets.find((candidate) => candidate.path === logicalPath);
      if (!asset) throw new Error('teacher-ai-grading-dataset-asset-not-found');
      const bytes = await readFile(controlledLogicalPath(datasetRoot, asset.path));
      assertChecksum(bytes, asset.checksum, 'teacher-ai-grading-dataset-asset-checksum-mismatch');
      return bytes;
    },
    async readModelSubmission(sampleId, questionId) {
      const submission = findSubmission(manifest, sampleId, questionId);
      let metadata: Omit<TeacherAiGradingRedactedDocument, 'bytes'>;
      let review: TeacherAiGradingRedactionReview;
      let bytes: Buffer;
      try {
        metadata = JSON.parse(await readUtf8(controlledPath(datasetRoot, 'redacted', sampleId, `${questionId}.document.json`)));
        review = JSON.parse(await readUtf8(controlledPath(datasetRoot, 'redacted', sampleId, `${questionId}.review.json`)));
        bytes = await readFile(controlledPath(datasetRoot, 'redacted', sampleId, `${questionId}.docx`));
      } catch {
        throw new TeacherAiGradingRedactionError('LAB_REDACTION_UNRESOLVED');
      }
      const document: TeacherAiGradingRedactedDocument = { ...metadata, bytes };
      if (document.sampleId !== sampleId || document.questionId !== questionId || document.sourceChecksum !== submission.checksum) throw new Error('teacher-ai-grading-redaction-source-mismatch');
      const projected = projectTeacherAiGradingModelSubmission({ review, redactedDocument: document, ownerTeacherUserId });
      return { ...projected, checksum: document.redactedChecksum, sourceChecksum: document.sourceChecksum };
    },
    async saveRedaction(input) {
      const submission = findSubmission(manifest, input.document.sampleId, input.document.questionId);
      if (input.document.sourceChecksum !== submission.checksum
        || input.review.sampleId !== input.document.sampleId
        || input.review.questionId !== input.document.questionId) throw new Error('teacher-ai-grading-redaction-source-mismatch');
      const redactedRoot = controlledPath(datasetRoot, 'redacted');
      await mkdir(redactedRoot, { recursive: true });
      const { bytes, ...metadata } = input.document;
      const sampleRedactedRoot = controlledPath(redactedRoot, input.document.sampleId);
      await mkdir(sampleRedactedRoot, { recursive: true });
      await writeFile(controlledPath(sampleRedactedRoot, `${input.document.questionId}.docx`), bytes);
      await writeFile(controlledPath(sampleRedactedRoot, `${input.document.questionId}.document.json`), JSON.stringify(metadata));
      await writeFile(controlledPath(sampleRedactedRoot, `${input.document.questionId}.review.json`), JSON.stringify(input.review));
    },
  };
}

function findSubmission(manifest: TeacherAiGradingLabManifest, sampleId: string, questionId: string) {
  const sample = manifest.samples.find((candidate) => candidate.sampleId === sampleId);
  if (!sample) throw new Error('teacher-ai-grading-dataset-sample-not-found');
  const submission = sample.submissions.find((candidate) => candidate.questionId === questionId);
  if (!submission) throw new Error('teacher-ai-grading-dataset-question-submission-not-found');
  return submission;
}

export async function writeTeacherAiGradingLabArtifact(input: {
  artifactRoot: string;
  logicalKey: string;
  bytes: Uint8Array;
}): Promise<void> {
  const path = controlledLogicalPath(requireAbsoluteRoot(input.artifactRoot), input.logicalKey);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, input.bytes);
}

function requireAbsoluteRoot(value: string): string {
  if (!value?.trim() || !isAbsolute(value)) throw new Error('teacher-ai-grading-data-root-invalid');
  return resolve(value);
}

function requireIdentifier(value: string, code: string): string {
  if (!/^[a-z0-9][a-z0-9_-]{1,63}$/.test(value)) throw new Error(code);
  return value;
}

function controlledLogicalPath(root: string, logicalPath: string): string {
  if (!logicalPath || logicalPath.includes('\\') || logicalPath.startsWith('/') || /^[A-Za-z]:/.test(logicalPath)
    || logicalPath.split('/').some((part) => !part || part === '.' || part === '..')) {
    throw new Error('teacher-ai-grading-logical-path-invalid');
  }
  return controlledPath(root, ...logicalPath.split('/'));
}

function controlledPath(root: string, ...segments: string[]): string {
  const path = resolve(root, ...segments);
  const relation = relative(root, path);
  if (!relation || relation.startsWith('..') || isAbsolute(relation)) throw new Error('teacher-ai-grading-data-root-escape');
  return path;
}

async function readUtf8(path: string): Promise<string> {
  return decodeUtf8(await readFile(path));
}

function decodeUtf8(bytes: Buffer): string {
  return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
}

function assertChecksum(bytes: Uint8Array, expected: string, code: string): void {
  if (sha256(bytes) !== expected) throw new Error(code);
}

function sha256(bytes: Uint8Array): string {
  return `sha256:${createHash('sha256').update(bytes).digest('hex')}`;
}

function stableStringify(value: unknown): string {
  return JSON.stringify(canonicalize(value));
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => [key, canonicalize(item)]));
  }
  return value;
}
