import { createHash, randomUUID } from 'node:crypto';
import { lstat, mkdir, rename, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

import JSZip from 'jszip';

import {
  parseTeacherAiGradingBaseline,
  parseTeacherAiGradingManifest,
  parseTeacherAiGradingQuestions,
  TEACHER_AI_GRADING_LAB_IMPORT_VERSION,
  TeacherAiGradingLabError,
  type ParsedGradingQuestionSet,
  type TeacherAiGradingLabBaseline,
  type TeacherAiGradingLabConfig,
  type TeacherAiGradingLabManifest,
} from './teacher-ai-grading-lab-contracts';

export type TeacherAiGradingZipErrorCode =
  | 'LAB_ZIP_INVALID'
  | 'LAB_ZIP_TOO_MANY_ENTRIES'
  | 'LAB_ZIP_TOO_LARGE'
  | 'LAB_ZIP_PATH_UNSAFE'
  | 'LAB_ZIP_PATH_AMBIGUOUS'
  | 'LAB_ZIP_DUPLICATE_PATH'
  | 'LAB_ZIP_UNDECLARED_FILE'
  | 'LAB_ZIP_MISSING_FILE'
  | 'LAB_ZIP_CHECKSUM_MISMATCH'
  | 'LAB_ZIP_EXTENSION_INVALID'
  | 'LAB_IMPORT_ALREADY_EXISTS';

export class TeacherAiGradingZipError extends Error {
  constructor(
    public readonly code: TeacherAiGradingZipErrorCode,
    message: string,
    public readonly logicalPath?: string,
  ) {
    super(message);
    this.name = 'TeacherAiGradingZipError';
  }
}

interface ZipCentralEntry {
  path: string;
  directory: boolean;
  compressedSize: number;
  uncompressedSize: number;
}

export interface ValidatedTeacherAiGradingPackage {
  manifest: TeacherAiGradingLabManifest;
  baseline: TeacherAiGradingLabBaseline;
  questions: ParsedGradingQuestionSet;
  files: ReadonlyMap<string, Buffer>;
}

export interface ImportedTeacherAiGradingPackage extends Omit<ValidatedTeacherAiGradingPackage, 'files'> {
  importPath: string;
  datasetKind: TeacherAiGradingLabManifest['datasetKind'];
  runnable: false;
  redactionState: 'pending';
}

export async function validateTeacherAiGradingPackageZip(
  bytes: Buffer,
  limits: { maxEntries?: number; maxUncompressedBytes?: number; maxEntryBytes?: number } = {},
): Promise<ValidatedTeacherAiGradingPackage> {
  const entries = inspectZipCentralDirectory(bytes, {
    maxEntries: limits.maxEntries ?? 512,
    maxUncompressedBytes: limits.maxUncompressedBytes ?? 256 * 1024 * 1024,
    maxEntryBytes: limits.maxEntryBytes ?? 64 * 1024 * 1024,
  });
  for (const requiredDirectory of ['assets/', 'submissions/']) {
    if (!entries.some((entry) => entry.path === requiredDirectory || entry.path.startsWith(requiredDirectory))) {
      throw new TeacherAiGradingZipError('LAB_ZIP_MISSING_FILE', 'Required package directory is missing.', requiredDirectory);
    }
  }
  let archive: JSZip;
  try {
    archive = await JSZip.loadAsync(bytes, { checkCRC32: true });
  } catch {
    throw new TeacherAiGradingZipError('LAB_ZIP_INVALID', 'ZIP archive cannot be read.');
  }
  const files = new Map<string, Buffer>();
  for (const entry of entries) {
    if (entry.directory) continue;
    const zipFile = archive.file(entry.path);
    if (!zipFile) throw new TeacherAiGradingZipError('LAB_ZIP_INVALID', 'ZIP central and local records disagree.', entry.path);
    const content = await zipFile.async('nodebuffer');
    if (content.length !== entry.uncompressedSize) {
      throw new TeacherAiGradingZipError('LAB_ZIP_INVALID', 'ZIP entry size does not match its central record.', entry.path);
    }
    files.set(entry.path, content);
  }

  const manifest = parseTeacherAiGradingManifest(readJson(files, 'manifest.json'));
  const baseline = parseTeacherAiGradingBaseline(readJson(files, 'baseline.json'));
  validatePackageReferences(manifest, baseline, files);
  const questions = parseTeacherAiGradingQuestions(readUtf8(files, manifest.question.path), new Set(files.keys()));
  validateBaselineAgainstQuestions(manifest, baseline, questions);
  return { manifest, baseline, questions, files };
}

export async function importTeacherAiGradingPackageZip(
  bytes: Buffer,
  config: TeacherAiGradingLabConfig,
): Promise<ImportedTeacherAiGradingPackage> {
  const validated = await validateTeacherAiGradingPackageZip(bytes);
  const destination = join(config.dataRoot, 'datasets', validated.manifest.datasetId, validated.manifest.datasetVersion);
  const stagingRoot = join(config.dataRoot, '.grading-lab-staging');
  const staging = join(stagingRoot, randomUUID());
  await mkdir(staging, { recursive: true });
  try {
    for (const [logicalPath, content] of validated.files) {
      const outputPath = join(staging, ...logicalPath.split('/'));
      await mkdir(dirname(outputPath), { recursive: true });
      await writeFile(outputPath, content, { flag: 'wx' });
    }
    await writeFile(join(staging, 'import-result.json'), JSON.stringify({
      schemaVersion: TEACHER_AI_GRADING_LAB_IMPORT_VERSION,
      datasetId: validated.manifest.datasetId,
      datasetVersion: validated.manifest.datasetVersion,
      datasetKind: validated.manifest.datasetKind,
      runnable: false,
      redactionState: 'pending',
    }, null, 2), { flag: 'wx' });
    await mkdir(dirname(destination), { recursive: true });
    if (await pathExists(destination)) {
      throw new TeacherAiGradingZipError('LAB_IMPORT_ALREADY_EXISTS', 'Dataset version already exists.');
    }
    try {
      await rename(staging, destination);
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code === 'EEXIST' || code === 'ENOTEMPTY' || (code === 'EPERM' && await pathExists(destination))) {
        throw new TeacherAiGradingZipError('LAB_IMPORT_ALREADY_EXISTS', 'Dataset version already exists.');
      }
      throw error;
    }
  } catch (error) {
    await rm(staging, { recursive: true, force: true });
    throw error;
  }
  return {
    manifest: validated.manifest,
    baseline: validated.baseline,
    questions: validated.questions,
    importPath: destination,
    datasetKind: validated.manifest.datasetKind,
    runnable: false,
    redactionState: 'pending',
  };
}

function validatePackageReferences(
  manifest: TeacherAiGradingLabManifest,
  baseline: TeacherAiGradingLabBaseline,
  files: ReadonlyMap<string, Buffer>,
) {
  if (baseline.datasetId !== manifest.datasetId || baseline.datasetVersion !== manifest.datasetVersion) {
    throw new TeacherAiGradingLabError('LAB_BASELINE_INCONSISTENT', 'Baseline dataset identity does not match manifest.', 'baseline.json');
  }
  const declared = new Map<string, string>([
    ['manifest.json', checksum(files.get('manifest.json')!)],
    [manifest.question.path, manifest.question.checksum],
    [manifest.baseline.path, manifest.baseline.checksum],
    ...manifest.assets.map((asset) => [asset.path, asset.checksum] as const),
    ...manifest.samples.flatMap((sample) => sample.submissions.map((submission) => [submission.path, submission.checksum] as const)),
  ]);
  for (const path of files.keys()) {
    if (!declared.has(path)) throw new TeacherAiGradingZipError('LAB_ZIP_UNDECLARED_FILE', 'ZIP contains an undeclared file.', path);
    validateExtension(path);
  }
  for (const [path, expectedChecksum] of declared) {
    const content = files.get(path);
    if (!content) throw new TeacherAiGradingZipError('LAB_ZIP_MISSING_FILE', 'Declared package file is missing.', path);
    if (path !== 'manifest.json' && checksum(content) !== expectedChecksum) {
      throw new TeacherAiGradingZipError('LAB_ZIP_CHECKSUM_MISMATCH', 'Package file checksum does not match.', path);
    }
  }
  const baselineIds = new Set(baseline.samples.map((sample) => sample.sampleId));
  if (baselineIds.size !== baseline.samples.length || manifest.samples.some((sample) => !baselineIds.has(sample.sampleId)) || baseline.samples.length !== manifest.samples.length) {
    throw new TeacherAiGradingLabError('LAB_BASELINE_INCONSISTENT', 'Baseline samples do not exactly match manifest samples.', 'baseline.samples');
  }
}

function validateBaselineAgainstQuestions(
  manifest: TeacherAiGradingLabManifest,
  baseline: TeacherAiGradingLabBaseline,
  questions: ParsedGradingQuestionSet,
) {
  const expected = new Map(questions.questions.map((question) => [question.questionId, {
    maxScore: question.maxScore,
    criterionIds: new Set(question.rubricItems.map((item) => item.id)),
  }]));
  for (const sample of baseline.samples) {
    const seen = new Set<string>();
    for (const question of sample.questions) {
      const expectedQuestion = expected.get(question.questionId);
      if (seen.has(question.questionId) || expectedQuestion?.maxScore !== question.maxScore) {
        throw new TeacherAiGradingLabError('LAB_BASELINE_INCONSISTENT', 'Baseline question identity or maximum score is inconsistent.', `${sample.sampleId}.${question.questionId}`);
      }
      if (question.teacherScore > question.maxScore) {
        throw new TeacherAiGradingLabError('LAB_BASELINE_INCONSISTENT', 'Teacher score exceeds question maximum.', `${sample.sampleId}.${question.questionId}`);
      }
      if (baseline.gradingBasis === 'teacher-score-only') {
        if (question.deductions.length !== 0) {
          throw new TeacherAiGradingLabError('LAB_BASELINE_INCONSISTENT', 'Score-only baselines cannot declare deductions.', `${sample.sampleId}.${question.questionId}`);
        }
      } else {
        const deductions = question.deductions.reduce((sum, deduction) => sum + deduction.points, 0);
        if (Math.abs(question.maxScore - deductions - question.teacherScore) > 1e-9) {
          throw new TeacherAiGradingLabError('LAB_BASELINE_INCONSISTENT', 'Teacher score and deductions do not reconcile.', `${sample.sampleId}.${question.questionId}`);
        }
        if (question.deductions.some((deduction) => !expectedQuestion.criterionIds.has(deduction.criterionId))) {
          throw new TeacherAiGradingLabError('LAB_BASELINE_INCONSISTENT', 'Baseline deduction criterion is inconsistent with its question.', `${sample.sampleId}.${question.questionId}`);
        }
      }
      seen.add(question.questionId);
    }
    if (seen.size !== expected.size || [...expected.keys()].some((questionId) => !seen.has(questionId))) {
      throw new TeacherAiGradingLabError('LAB_BASELINE_INCONSISTENT', 'Baseline does not cover every question.', sample.sampleId);
    }
    const manifestSample = manifest.samples.find((candidate) => candidate.sampleId === sample.sampleId)!;
    if (manifestSample.submissions.length !== expected.size
      || manifestSample.submissions.some((submission) => !expected.has(submission.questionId))) {
      throw new TeacherAiGradingLabError('LAB_BASELINE_INCONSISTENT', 'Sample submissions do not cover every question.', sample.sampleId);
    }
  }
  if (manifest.samples.length !== baseline.samples.length) {
    throw new TeacherAiGradingLabError('LAB_BASELINE_INCONSISTENT', 'Baseline sample count does not match manifest.', 'baseline.samples');
  }
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await lstat(path);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false;
    throw error;
  }
}

function validateExtension(path: string) {
  const allowed = path === 'manifest.json'
    || path === 'baseline.json'
    || /^[A-Za-z0-9][A-Za-z0-9_.-]*\.md$/i.test(path)
    || /^assets\/.+\.(png|jpe?g|webp|svg|m|py|tex)$/i.test(path)
    || /^submissions\/.+\.(docx|doc)$/i.test(path);
  if (!allowed) throw new TeacherAiGradingZipError('LAB_ZIP_EXTENSION_INVALID', 'Package file extension is not allowed.', path);
}

function readJson(files: ReadonlyMap<string, Buffer>, path: string): unknown {
  try {
    return JSON.parse(readUtf8(files, path));
  } catch {
    throw new TeacherAiGradingZipError('LAB_ZIP_INVALID', 'Package JSON cannot be parsed.', path);
  }
}

function readUtf8(files: ReadonlyMap<string, Buffer>, path: string): string {
  const content = files.get(path);
  if (!content) throw new TeacherAiGradingZipError('LAB_ZIP_MISSING_FILE', 'Required package file is missing.', path);
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(content);
  } catch {
    throw new TeacherAiGradingZipError('LAB_ZIP_INVALID', 'Package text must be valid UTF-8.', path);
  }
}

function checksum(content: Buffer): string {
  return `sha256:${createHash('sha256').update(content).digest('hex')}`;
}

function inspectZipCentralDirectory(
  bytes: Buffer,
  limits: { maxEntries: number; maxUncompressedBytes: number; maxEntryBytes: number },
): ZipCentralEntry[] {
  const eocdOffset = findEndOfCentralDirectory(bytes);
  const entryCount = bytes.readUInt16LE(eocdOffset + 10);
  const centralSize = bytes.readUInt32LE(eocdOffset + 12);
  const centralOffset = bytes.readUInt32LE(eocdOffset + 16);
  if (entryCount === 0xffff || centralOffset === 0xffffffff || centralSize === 0xffffffff || centralOffset + centralSize > eocdOffset) {
    throw new TeacherAiGradingZipError('LAB_ZIP_INVALID', 'ZIP64 and malformed central directories are not supported.');
  }
  if (entryCount > limits.maxEntries) throw new TeacherAiGradingZipError('LAB_ZIP_TOO_MANY_ENTRIES', 'ZIP entry limit exceeded.');
  const entries: ZipCentralEntry[] = [];
  const exact = new Set<string>();
  const folded = new Set<string>();
  let totalSize = 0;
  let cursor = centralOffset;
  for (let index = 0; index < entryCount; index += 1) {
    if (cursor + 46 > bytes.length || bytes.readUInt32LE(cursor) !== 0x02014b50) throw new TeacherAiGradingZipError('LAB_ZIP_INVALID', 'Invalid ZIP central directory.');
    const flags = bytes.readUInt16LE(cursor + 8);
    const method = bytes.readUInt16LE(cursor + 10);
    const compressedSize = bytes.readUInt32LE(cursor + 20);
    const uncompressedSize = bytes.readUInt32LE(cursor + 24);
    const nameLength = bytes.readUInt16LE(cursor + 28);
    const extraLength = bytes.readUInt16LE(cursor + 30);
    const commentLength = bytes.readUInt16LE(cursor + 32);
    const localOffset = bytes.readUInt32LE(cursor + 42);
    const nameBytes = bytes.subarray(cursor + 46, cursor + 46 + nameLength);
    if ((flags & 1) !== 0 || ![0, 8].includes(method)) throw new TeacherAiGradingZipError('LAB_ZIP_INVALID', 'Encrypted or unsupported ZIP entries are rejected.');
    if ((flags & 0x800) === 0 && nameBytes.some((value) => value > 0x7f)) throw new TeacherAiGradingZipError('LAB_ZIP_PATH_AMBIGUOUS', 'Non-UTF-8 ZIP paths are rejected.');
    const path = decodeZipPath(nameBytes);
    validateZipPath(path);
    validateLocalHeader(bytes, localOffset, nameBytes);
    if (exact.has(path) || folded.has(path.toLowerCase())) throw new TeacherAiGradingZipError('LAB_ZIP_DUPLICATE_PATH', 'Duplicate or case-conflicting ZIP path.', path);
    exact.add(path);
    folded.add(path.toLowerCase());
    totalSize += uncompressedSize;
    if (uncompressedSize > limits.maxEntryBytes || totalSize > limits.maxUncompressedBytes) {
      throw new TeacherAiGradingZipError('LAB_ZIP_TOO_LARGE', 'ZIP uncompressed size limit exceeded.', path);
    }
    entries.push({ path, directory: path.endsWith('/'), compressedSize, uncompressedSize });
    cursor += 46 + nameLength + extraLength + commentLength;
  }
  if (cursor !== centralOffset + centralSize) throw new TeacherAiGradingZipError('LAB_ZIP_INVALID', 'ZIP central directory size is inconsistent.');
  return entries;
}

function findEndOfCentralDirectory(bytes: Buffer): number {
  const minimum = Math.max(0, bytes.length - 65_557);
  for (let offset = bytes.length - 22; offset >= minimum; offset -= 1) {
    if (bytes.readUInt32LE(offset) === 0x06054b50) return offset;
  }
  throw new TeacherAiGradingZipError('LAB_ZIP_INVALID', 'ZIP end record is missing.');
}

function decodeZipPath(bytes: Buffer): string {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    throw new TeacherAiGradingZipError('LAB_ZIP_PATH_AMBIGUOUS', 'ZIP path is not valid UTF-8.');
  }
}

function validateZipPath(path: string) {
  if (!path || path.includes('\\') || path.startsWith('/') || /^[A-Za-z]:/.test(path)) {
    throw new TeacherAiGradingZipError('LAB_ZIP_PATH_UNSAFE', 'ZIP path is absolute or ambiguous.', path);
  }
  const parts = path.replace(/\/$/, '').split('/');
  if (parts.some((part) => part === '' || part === '.' || part === '..')) {
    throw new TeacherAiGradingZipError('LAB_ZIP_PATH_UNSAFE', 'ZIP path contains unsafe segments.', path);
  }
}

function validateLocalHeader(bytes: Buffer, offset: number, centralName: Buffer) {
  if (offset + 30 > bytes.length || bytes.readUInt32LE(offset) !== 0x04034b50) throw new TeacherAiGradingZipError('LAB_ZIP_INVALID', 'ZIP local header is invalid.');
  const localNameLength = bytes.readUInt16LE(offset + 26);
  const localName = bytes.subarray(offset + 30, offset + 30 + localNameLength);
  if (!localName.equals(centralName)) throw new TeacherAiGradingZipError('LAB_ZIP_PATH_AMBIGUOUS', 'ZIP local and central paths differ.');
}
