import { privacyViolation as censusPrivacyViolation } from '@/lib/architecture-census/privacy';

const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/u;
const ABSOLUTE_PATH = /(?:^|[\s"'`=(,:])(?:\/(?:Users|home|private|var|tmp|opt|etc|workspace|root|mnt|media|usr|data)(?:\/|[\\"'\s,]|$)|[A-Za-z]:\\|(?:\/[\w.-]+){2,}\/[\w.-]+)/u;
const LEARNER = /\b(?:studentId|userId|rawAnswer|eventPayload|cookie|learner)\b/iu;
const RAW_LOG = /(?:^|[\\"'\s=(,:])(?:\.logs\/|\/(?:[\w.-]+\/)*\.logs\/)/u;
const USER_IDENTITY = /(?:^|[^A-Za-z])(?:student|user|learner|uid|email)[-_][A-Za-z0-9_-]+/iu;
const OWNER_TOKEN = /^[a-z]+(?:-[a-z]+)*$/u;
const FORBIDDEN_OWNER = /^(?:student|user|learner|uid|email)$/u;

const RECEIPT_KEYS = [
  'schemaVersion', 'receiptId', 'sourceIdentity', 'inputReceiptIdentities',
  'beforeMetrics', 'afterMetrics', 'totals', 'terminalCoverage',
  'remainingCompatibilityRecords', 'blockedRecords', 'status',
] as const;
const SOURCE_IDENTITY_KEYS = ['sourceCommit', 'sourceTree'] as const;
const RECEIPT_IDENTITY_KEYS = [
  'stageId', 'receiptId', 'contentDigest', 'schemaVersion', 'owner', 'scope',
  'sourceCommit', 'sourceTree', 'producerChange', 'producerRevision',
  'status', 'current', 'evidenceClass',
] as const;
const METRIC_KEYS = [
  'metricId', 'scope', 'unit', 'value', 'sourceReceiptId', 'sourceField', 'status',
] as const;
const TOTALS_KEYS = ['discovered', 'included', 'excluded', 'duplicate', 'unresolved'] as const;
const COVERAGE_KEYS = [
  'expected', 'present', 'missing', 'duplicate', 'stale', 'blocked', 'unresolved',
] as const;
const COMPATIBILITY_KEYS = [
  'identity', 'owner', 'inClosureScope', 'deletionProof', 'reason', 'resolutionCondition',
] as const;
const BLOCKED_KEYS = [
  'identity', 'owner', 'sourceReceiptId', 'reason', 'resolutionCondition',
] as const;

function extraKeys(value: object, allowed: readonly string[]): string | null {
  for (const key of Object.keys(value)) {
    if (!allowed.includes(key)) return 'unexpected-field';
  }
  return null;
}

export function publicEvidenceTextViolation(text: string): string | null {
  if (EMAIL.test(text)) return 'user-identifier';
  if (USER_IDENTITY.test(text)) return 'user-identifier';
  if (ABSOLUTE_PATH.test(text)) return 'absolute-path';
  if (LEARNER.test(text)) return 'forbidden-payload';
  if (RAW_LOG.test(text)) return 'raw-log';
  return null;
}

export function publicOwnerViolation(owner: string): string | null {
  const text = publicEvidenceTextViolation(owner);
  if (text) return text;
  if (!OWNER_TOKEN.test(owner) || FORBIDDEN_OWNER.test(owner)) return 'user-identifier';
  return null;
}

function walkStrings(value: unknown): string | null {
  if (typeof value === 'string') return publicEvidenceTextViolation(value);
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = walkStrings(item);
      if (found) return found;
    }
    return null;
  }
  if (value && typeof value === 'object') {
    for (const nested of Object.values(value)) {
      const found = walkStrings(nested);
      if (found) return found;
    }
  }
  return null;
}

function inspectArray(
  value: unknown,
  allowed: readonly string[],
): string | null {
  if (!Array.isArray(value)) return 'unexpected-field';
  for (const item of value) {
    if (typeof item === 'string') {
      const found = publicEvidenceTextViolation(item);
      if (found) return found;
      continue;
    }
    if (!item || typeof item !== 'object' || Array.isArray(item)) return 'unexpected-field';
    const extra = extraKeys(item, allowed);
    if (extra) return extra;
    if ('owner' in item && typeof (item as { owner: unknown }).owner === 'string') {
      const ownerViolation = publicOwnerViolation((item as { owner: string }).owner);
      if (ownerViolation) return ownerViolation;
    }
    const found = walkStrings(item);
    if (found) return found;
  }
  return null;
}

function inspectReceiptShape(value: unknown): string | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return 'unexpected-field';
  const receipt = value as Record<string, unknown>;
  const extra = extraKeys(receipt, RECEIPT_KEYS);
  if (extra) return extra;
  if (receipt.sourceIdentity && typeof receipt.sourceIdentity === 'object' && !Array.isArray(receipt.sourceIdentity)) {
    const found = extraKeys(receipt.sourceIdentity, SOURCE_IDENTITY_KEYS);
    if (found) return found;
  }
  if (receipt.totals && typeof receipt.totals === 'object' && !Array.isArray(receipt.totals)) {
    const found = extraKeys(receipt.totals, TOTALS_KEYS);
    if (found) return found;
  }
  if (receipt.terminalCoverage && typeof receipt.terminalCoverage === 'object' && !Array.isArray(receipt.terminalCoverage)) {
    const found = extraKeys(receipt.terminalCoverage, COVERAGE_KEYS);
    if (found) return found;
  }
  return inspectArray(receipt.inputReceiptIdentities, RECEIPT_IDENTITY_KEYS)
    ?? inspectArray(receipt.beforeMetrics, METRIC_KEYS)
    ?? inspectArray(receipt.afterMetrics, METRIC_KEYS)
    ?? inspectArray(receipt.remainingCompatibilityRecords, COMPATIBILITY_KEYS)
    ?? inspectArray(receipt.blockedRecords, BLOCKED_KEYS)
    ?? walkStrings(value);
}

export function closureOutputPrivacyViolation(text: string): string | null {
  const census = censusPrivacyViolation(text);
  if (census) return census;
  const fromText = publicEvidenceTextViolation(text);
  if (fromText) return fromText;
  try {
    return inspectReceiptShape(JSON.parse(text));
  } catch {
    return null;
  }
}
