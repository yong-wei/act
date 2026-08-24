import JSZip from 'jszip';

const SYNTHETIC_FIXTURE_HELPER = 'src/lib/data-governance/__tests__/fixtures/teacher-ai-grading-lab-synthetic.ts';
const SYNTHETIC_SUBMISSIONS = new Set([
  'src/lib/data-governance/__tests__/fixtures/teacher-ai-grading-lab-synthetic/submissions/sample-abcd/t1-4.docx',
  'src/lib/data-governance/__tests__/fixtures/teacher-ai-grading-lab-synthetic/submissions/sample-0001/t1-4.docx',
  'src/lib/data-governance/__tests__/fixtures/teacher-ai-grading-lab-synthetic/submissions/sample-0002/t1-4.docx',
]);
const IDENTITY_KEYS = new Set(['studentid', 'studentnumber', 'name', 'email']);

export interface SensitiveGradingLabPathFinding {
  path: string;
  reason: string;
}

export interface StagedTeacherAiGradingLabFile {
  path: string;
  content: Buffer;
  trackedBefore: boolean;
}

export function findSensitiveTeacherAiGradingLabPaths(paths: readonly string[]): SensitiveGradingLabPathFinding[] {
  return paths.flatMap((rawPath) => {
    const path = normalizePath(rawPath);
    const lower = path.toLowerCase();
    if (isSyntheticFixture(lower)) return [];
    if (/(^|\/)(teacher-ai-grading-lab-data|grading-lab-data|\.grading-lab-staging|grading-lab-run-artifacts)(\/|$)/.test(lower)) {
      return [{ path, reason: 'local evaluation data or runtime directory' }];
    }
    if (/(^|\/)grading-lab-identity-mapping\.(json|csv|tsv|xlsx)$/.test(lower)) {
      return [{ path, reason: 'identity mapping' }];
    }
    if (/\.grading-lab\.zip$/.test(lower)) return [{ path, reason: 'evaluation package archive' }];
    return [];
  });
}

export async function findSensitiveTeacherAiGradingLabStagedFiles(
  files: readonly StagedTeacherAiGradingLabFile[],
): Promise<SensitiveGradingLabPathFinding[]> {
  const findings = findSensitiveTeacherAiGradingLabPaths(files.map((file) => file.path));
  const alreadyBlocked = new Set(findings.map((finding) => normalizePath(finding.path).toLowerCase()));
  for (const file of files) {
    const path = normalizePath(file.path);
    const lower = path.toLowerCase();
    if (alreadyBlocked.has(lower) || isSyntheticFixture(lower)) continue;
    if (/\.(doc|docx)$/i.test(path)) {
      findings.push({ path, reason: 'potential student submission' });
      continue;
    }
    if (/\.zip$/i.test(path) && await isEvaluationPackageZip(file.content)) {
      findings.push({ path, reason: 'evaluation package archive' });
      continue;
    }
    if (/\.(json|csv|tsv)$/i.test(path) && containsIdentityMapping(path, file.content)) {
      findings.push({ path, reason: 'identity mapping' });
    }
  }
  return findings;
}

function normalizePath(path: string): string {
  return path.replace(/\\/g, '/');
}

function isSyntheticFixture(lowerPath: string): boolean {
  return lowerPath === SYNTHETIC_FIXTURE_HELPER || SYNTHETIC_SUBMISSIONS.has(lowerPath);
}

async function isEvaluationPackageZip(content: Buffer): Promise<boolean> {
  let archive: JSZip;
  try {
    archive = await JSZip.loadAsync(content);
  } catch {
    return false;
  }
  const paths = Object.keys(archive.files).map((path) => normalizePath(path).toLowerCase());
  return ['manifest.json', 't1s.md', 'baseline.json'].every((required) => paths.includes(required))
    && paths.some((path) => path === 'submissions/' || path.startsWith('submissions/'));
}

function containsIdentityMapping(path: string, content: Buffer): boolean {
  const text = decodeUtf8(content);
  if (text === null) return false;
  if (/\.json$/i.test(path)) {
    try {
      return jsonContainsIdentityMapping(JSON.parse(text));
    } catch {
      return false;
    }
  }
  const delimiter = /\.tsv$/i.test(path) ? '\t' : ',';
  const header = text.split(/\r?\n/, 1)[0]?.split(delimiter).map(normalizeField) ?? [];
  return header.includes('sampleid') && header.some((field) => IDENTITY_KEYS.has(field));
}

function jsonContainsIdentityMapping(value: unknown): boolean {
  if (Array.isArray(value)) return value.some(jsonContainsIdentityMapping);
  if (!value || typeof value !== 'object') return false;
  const record = value as Record<string, unknown>;
  const keys = Object.keys(record).map(normalizeField);
  if (keys.includes('sampleid') && keys.some((key) => IDENTITY_KEYS.has(key))) return true;
  return Object.values(record).some(jsonContainsIdentityMapping);
}

function normalizeField(field: string): string {
  return field.trim().replace(/^['"]|['"]$/g, '').replace(/[_\s-]/g, '').toLowerCase();
}

function decodeUtf8(content: Buffer): string | null {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(content);
  } catch {
    return null;
  }
}
