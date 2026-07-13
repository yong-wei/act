export const MATH_DOCUMENT_GRADING_WORKER_HEARTBEAT_KEY = 'math-document-grading:worker:heartbeat';
export const MATH_DOCUMENT_GRADING_WORKER_CAPABILITY_KEY = 'math-document-grading:worker:capability';
export const MATH_DOCUMENT_GRADING_WORKER_CAPABILITY_VERSION = 'math-document-grading-worker.v1';
export const MATH_DOCUMENT_GRADING_WORKER_CAPABILITY_KEYS = [
  'database',
  'redis',
  'objectStore',
  'scanner',
  'aiProvider',
  'mathpix',
  'auditSecret',
] as const;

const DEFAULT_AI_ENDPOINT = 'https://api.siliconflow.cn/v1';
const DEFAULT_AI_MODEL = 'Qwen/Qwen3.6-35B-A3B';
const DEFAULT_MATHPIX_ENDPOINT = 'https://api.mathpix.com/v3/text';

export interface MathDocumentGradingWorkerCapabilities {
  database: boolean;
  redis: boolean;
  objectStore: boolean;
  scanner: boolean;
  aiProvider: boolean;
  mathpix: boolean;
  auditSecret: boolean;
}

export interface MathDocumentGradingWorkerCapabilityStatus {
  version: string;
  ready: boolean;
  configReady: boolean;
  capabilities: MathDocumentGradingWorkerCapabilities;
  missing: string[];
}

export function isMathDocumentGradingWorkerCapabilityReady(
  status: MathDocumentGradingWorkerCapabilityStatus | null | undefined,
): boolean {
  if (!status || status.version !== MATH_DOCUMENT_GRADING_WORKER_CAPABILITY_VERSION || !status.ready || !status.configReady) return false;
  const keys = Object.keys(status.capabilities);
  return keys.length === MATH_DOCUMENT_GRADING_WORKER_CAPABILITY_KEYS.length
    && MATH_DOCUMENT_GRADING_WORKER_CAPABILITY_KEYS.every((key) => status.capabilities[key] === true)
    && keys.every((key) => (MATH_DOCUMENT_GRADING_WORKER_CAPABILITY_KEYS as readonly string[]).includes(key));
}

function nonEmpty(value: string | undefined): string {
  return value?.trim() ?? '';
}

function isPlaceholder(value: string): boolean {
  return /^(replace-with|your-|change-me|sk-your)/i.test(value);
}

function isUrl(value: string, protocols: string[]): boolean {
  try {
    return protocols.includes(new URL(value).protocol);
  } catch {
    return false;
  }
}

function isHttpsUrl(value: string): boolean {
  return isUrl(value, ['https:']);
}

export function getMathDocumentGradingWorkerCapabilityStatus(
  env: NodeJS.ProcessEnv = process.env,
): MathDocumentGradingWorkerCapabilityStatus {
  const missing = new Set<string>();
  const requireValue = (name: string, value: string) => {
    if (!nonEmpty(value)) missing.add(name);
  };
  const requireHttpsUrl = (name: string, value: string) => {
    if (!isHttpsUrl(nonEmpty(value))) missing.add(name);
  };

  const database = isUrl(nonEmpty(env.DATABASE_URL), ['postgres:', 'postgresql:']);
  const redis = isUrl(nonEmpty(env.REDIS_URL), ['redis:', 'rediss:']);
  if (!database) missing.add('DATABASE_URL');
  if (!redis) missing.add('REDIS_URL');

  const objectStore = env.SUBMISSION_OBJECT_STORE === 's3'
    && isHttpsUrl(nonEmpty(env.SUBMISSION_S3_ENDPOINT))
    && Boolean(nonEmpty(env.SUBMISSION_S3_BUCKET))
    && Boolean(nonEmpty(env.SUBMISSION_S3_ACCESS_KEY))
    && Boolean(nonEmpty(env.SUBMISSION_S3_SECRET_KEY));
  if (!objectStore) {
    if (env.SUBMISSION_OBJECT_STORE !== 's3') missing.add('SUBMISSION_OBJECT_STORE');
    requireHttpsUrl('SUBMISSION_S3_ENDPOINT', env.SUBMISSION_S3_ENDPOINT ?? '');
    requireValue('SUBMISSION_S3_BUCKET', env.SUBMISSION_S3_BUCKET ?? '');
    requireValue('SUBMISSION_S3_ACCESS_KEY', env.SUBMISSION_S3_ACCESS_KEY ?? '');
    requireValue('SUBMISSION_S3_SECRET_KEY', env.SUBMISSION_S3_SECRET_KEY ?? '');
  }

  const scannerMode = env.SUBMISSION_SCANNER_MODE === 's3-object-tag';
  const scannerProvider = env.SUBMISSION_CONTENT_SCANNER === 'clamav-tcp' || env.SUBMISSION_CONTENT_SCANNER === 'https';
  const scannerCredentials = Boolean(
    nonEmpty(env.SUBMISSION_SCANNER_ACCESS_KEY)
      && nonEmpty(env.SUBMISSION_SCANNER_SECRET_KEY)
      && nonEmpty(env.SUBMISSION_SCANNER_PROBE_KEY),
  );
  const scanner = scannerMode && scannerProvider && scannerCredentials;
  if (!scannerMode) missing.add('SUBMISSION_SCANNER_MODE');
  if (!scannerProvider) missing.add('SUBMISSION_CONTENT_SCANNER');
  requireValue('SUBMISSION_SCANNER_ACCESS_KEY', env.SUBMISSION_SCANNER_ACCESS_KEY ?? '');
  requireValue('SUBMISSION_SCANNER_SECRET_KEY', env.SUBMISSION_SCANNER_SECRET_KEY ?? '');
  requireValue('SUBMISSION_SCANNER_PROBE_KEY', env.SUBMISSION_SCANNER_PROBE_KEY ?? '');
  if (env.SUBMISSION_CONTENT_SCANNER === 'clamav-tcp') {
    requireValue('SUBMISSION_CLAMAV_HOST', env.SUBMISSION_CLAMAV_HOST ?? '');
    if (!Number.isInteger(Number(env.SUBMISSION_CLAMAV_PORT)) || Number(env.SUBMISSION_CLAMAV_PORT) < 1) {
      missing.add('SUBMISSION_CLAMAV_PORT');
    }
  }
  if (env.SUBMISSION_CONTENT_SCANNER === 'https') {
    requireHttpsUrl('SUBMISSION_SCANNER_URL', env.SUBMISSION_SCANNER_URL ?? '');
    requireValue('SUBMISSION_SCANNER_TOKEN', env.SUBMISSION_SCANNER_TOKEN ?? '');
  }

  const provider = nonEmpty(env.AI_PROVIDER) || nonEmpty(env.LLM_PROVIDER) || 'siliconflow';
  const aiEndpoint = nonEmpty(env.AI_BASE_URL) || nonEmpty(env.SILICONFLOW_API_URL) || (provider === 'siliconflow' ? DEFAULT_AI_ENDPOINT : '');
  const aiModel = nonEmpty(env.AI_MODEL) || nonEmpty(env.SILICONFLOW_MODEL) || (provider === 'siliconflow' ? DEFAULT_AI_MODEL : '');
  const aiKey = provider === 'siliconflow'
    ? nonEmpty(env.AI_API_KEY) || nonEmpty(env.SILICONFLOW_API_KEY)
    : nonEmpty(env.AI_API_KEY);
  const aiEnabled = ['1', 'true', 'yes'].includes((env.GRADING_AI_PROVIDER_ENABLED ?? '').trim().toLowerCase());
  const aiProvider = aiEnabled && isHttpsUrl(aiEndpoint) && Boolean(aiModel) && Boolean(aiKey);
  if (!aiEnabled) missing.add('GRADING_AI_PROVIDER_ENABLED');
  if (!isHttpsUrl(aiEndpoint)) missing.add('AI_BASE_URL');
  if (!aiModel) missing.add('AI_MODEL');
  if (!aiKey) missing.add(provider === 'siliconflow' ? 'SILICONFLOW_API_KEY' : 'AI_API_KEY');

  const mathpixEndpoint = nonEmpty(env.MATHPIX_ENDPOINT) || DEFAULT_MATHPIX_ENDPOINT;
  const mathpixCredentialRef = nonEmpty(env.MATHPIX_CREDENTIAL_REF) || 'env:MATHPIX_APP_KEY';
  const mathpix = isHttpsUrl(mathpixEndpoint)
    && Boolean(nonEmpty(env.MATHPIX_APP_ID))
    && Boolean(nonEmpty(env.MATHPIX_APP_KEY))
    && /^env:[A-Z][A-Z0-9_]*$/.test(mathpixCredentialRef);
  requireHttpsUrl('MATHPIX_ENDPOINT', mathpixEndpoint);
  requireValue('MATHPIX_APP_ID', env.MATHPIX_APP_ID ?? '');
  requireValue('MATHPIX_APP_KEY', env.MATHPIX_APP_KEY ?? '');
  if (!/^env:[A-Z][A-Z0-9_]*$/.test(mathpixCredentialRef)) missing.add('MATHPIX_CREDENTIAL_REF');

  const auditSecretValue = nonEmpty(env.GRADING_AUDIT_SECRET);
  const auditSecret = env.NODE_ENV !== 'production' || (Boolean(auditSecretValue) && !isPlaceholder(auditSecretValue));
  if (!auditSecret) missing.add('GRADING_AUDIT_SECRET');
  const lifecycleLookupSecretValue = nonEmpty(env.GRADING_LIFECYCLE_LOOKUP_SECRET);
  const lifecycleLookupSecret = env.NODE_ENV !== 'production' || (Boolean(lifecycleLookupSecretValue) && !isPlaceholder(lifecycleLookupSecretValue));
  if (!lifecycleLookupSecret) missing.add('GRADING_LIFECYCLE_LOOKUP_SECRET');

  const configReady = missing.size === 0;
  return {
    version: MATH_DOCUMENT_GRADING_WORKER_CAPABILITY_VERSION,
    ready: configReady,
    configReady,
    capabilities: { database, redis, objectStore, scanner, aiProvider, mathpix, auditSecret },
    missing: [...missing].sort(),
  };
}

export function assertMathDocumentGradingWorkerConfig(
  env: NodeJS.ProcessEnv = process.env,
): MathDocumentGradingWorkerCapabilityStatus {
  const status = getMathDocumentGradingWorkerCapabilityStatus(env);
  if (!status.configReady) {
    throw new Error(`math-document-grading-worker-config-missing:${status.missing.join(',')}`);
  }
  return status;
}

export function parseMathDocumentGradingWorkerCapability(
  raw: string | null,
): MathDocumentGradingWorkerCapabilityStatus | null {
  if (!raw) return null;
  try {
    const status = JSON.parse(raw) as Partial<MathDocumentGradingWorkerCapabilityStatus>;
    const capabilities = status.capabilities as Partial<MathDocumentGradingWorkerCapabilities> | undefined;
    const completeCapabilities = capabilities
      && Object.keys(capabilities).length === MATH_DOCUMENT_GRADING_WORKER_CAPABILITY_KEYS.length
      && MATH_DOCUMENT_GRADING_WORKER_CAPABILITY_KEYS.every((key) => typeof capabilities[key] === 'boolean')
      && Object.keys(capabilities).every((key) => (MATH_DOCUMENT_GRADING_WORKER_CAPABILITY_KEYS as readonly string[]).includes(key));
    if (
      status.version !== MATH_DOCUMENT_GRADING_WORKER_CAPABILITY_VERSION
      || typeof status.ready !== 'boolean'
      || typeof status.configReady !== 'boolean'
      || !completeCapabilities
    ) return null;
    return {
      version: status.version,
      ready: status.ready,
      configReady: status.configReady,
      capabilities: capabilities as MathDocumentGradingWorkerCapabilities,
      missing: Array.isArray(status.missing) ? status.missing.filter((value): value is string => typeof value === 'string').slice(0, 64) : [],
    };
  } catch {
    return null;
  }
}
