import { normalizeExternalProcessingPolicy, type ExternalProcessingPolicy } from '../../src/lib/data-governance/math-document-grading-contracts';
import { assertLifecyclePolicy, type LifecyclePolicyInput } from '../../src/lib/data-governance/math-document-grading-lifecycle';

export const GRADING_POLICY_DATA_CLASSES = [
  'source-asset',
  'answer-evidence',
  'document-conversion',
  'ai-draft',
  'grading-run',
] as const;

type Env = Record<string, string | undefined>;

export interface GradingPolicySeedConfig {
  lifecycle: Array<LifecyclePolicyInput & { id: string }>;
  providers: Array<ExternalProcessingPolicy & { id: string }>;
}

export function assertProductionProviderRetentionAdapter(config: GradingPolicySeedConfig, production = false): void {
  if (!production) return;
  const lifecycleRetention = config.lifecycle.some((policy) => (policy.providerRetentionSeconds ?? 0) > 0);
  const providerRetention = config.providers.some((policy) => policy.providerRetentionSeconds > 0);
  if (lifecycleRetention || providerRetention) throw new Error('grading-policy-seed-blocked:provider-retention-adapter-unavailable');
}

type PolicyRepository = {
  findUnique?: (args: any) => Promise<any>;
  upsert: (args: any) => Promise<any>;
};

type GradingPolicyDb = {
  gradingLifecyclePolicy?: PolicyRepository;
  gradingProviderPolicy?: PolicyRepository;
};

function required(env: Env, name: string): string {
  const value = env[name]?.trim() ?? '';
  if (!value) throw new Error(`grading-policy-config-missing:${name}`);
  if (/^(replace-with|your-|change-me|sk-your)/i.test(value)) throw new Error(`grading-policy-config-placeholder:${name}`);
  return value;
}

function optional(env: Env, name: string): string | null {
  const value = env[name]?.trim() ?? '';
  return value || null;
}

function parseInteger(env: Env, name: string, minimum: number, requiredValue = true): number | null {
  const raw = optional(env, name);
  if (raw === null) {
    if (requiredValue) throw new Error(`grading-policy-config-missing:${name}`);
    return null;
  }
  const value = Number(raw);
  if (!Number.isInteger(value) || value < minimum) throw new Error(`grading-policy-config-invalid:${name}`);
  return value;
}

function parseBoolean(env: Env, name: string, requiredValue = true, fallback = false): boolean {
  const raw = optional(env, name);
  if (raw === null) {
    if (requiredValue) throw new Error(`grading-policy-config-missing:${name}`);
    return fallback;
  }
  if (['1', 'true', 'yes'].includes(raw.toLowerCase())) return true;
  if (['0', 'false', 'no'].includes(raw.toLowerCase())) return false;
  throw new Error(`grading-policy-config-invalid:${name}`);
}

function parseList(env: Env, name: string, fallback: string[] = []): string[] {
  const raw = optional(env, name);
  const values = raw === null ? fallback : raw.split(',').map((value) => value.trim()).filter(Boolean);
  const unique = [...new Set(values)];
  if (unique.length === 0) throw new Error(`grading-policy-config-missing:${name}`);
  return unique;
}

function policyId(prefix: string, version: string): string {
  return `${prefix}:${version}`.replace(/[^A-Za-z0-9._:-]/g, '-');
}

function parseLifecyclePolicy(env: Env, dataClass: typeof GRADING_POLICY_DATA_CLASSES[number], prefix: string): LifecyclePolicyInput & { id: string } {
  const version = required(env, `GRADING_${prefix}_POLICY_VERSION`);
  const retentionSeconds = parseInteger(env, `GRADING_${prefix}_RETENTION_SECONDS`, 1, false);
  const governedRecordRule = optional(env, `GRADING_${prefix}_GOVERNED_RECORD_RULE`);
  const deleteStrategy = required(env, `GRADING_${prefix}_DELETE_STRATEGY`) as LifecyclePolicyInput['deleteStrategy'];
  const policy = { id: policyId(`grading-lifecycle:${dataClass}`, version), dataClass, version, retentionSeconds, governedRecordRule, deleteStrategy, providerRetentionSeconds: parseInteger(env, `GRADING_${prefix}_PROVIDER_RETENTION_SECONDS`, 0, false), enabled: parseBoolean(env, `GRADING_${prefix}_ENABLED`, false, true) };
  assertLifecyclePolicy(policy);
  return policy;
}

function parseProviderPolicy(env: Env, kind: 'ai' | 'mathpix'): ExternalProcessingPolicy & { id: string } {
  const isAi = kind === 'ai';
  const provider = isAi ? required(env, 'AI_PROVIDER') : 'mathpix';
  const version = required(env, isAi ? 'GRADING_AI_PROVIDER_VERSION' : 'GRADING_MATHPIX_POLICY_VERSION');
  const endpoint = required(env, isAi ? 'AI_BASE_URL' : 'MATHPIX_ENDPOINT');
  const credentialRef = required(env, isAi ? 'AI_SECRET_REF' : 'MATHPIX_CREDENTIAL_REF');
  if (!/^env:[A-Z][A-Z0-9_]*$/.test(credentialRef)) throw new Error(`grading-policy-config-invalid:${isAi ? 'AI_SECRET_REF' : 'MATHPIX_CREDENTIAL_REF'}`);
  const processingRegion = required(env, 'GRADING_PROVIDER_PROCESSING_REGION');
  const agreementVersion = required(env, 'GRADING_PROVIDER_AGREEMENT_VERSION');
  const noTraining = parseBoolean(env, 'GRADING_PROVIDER_NO_TRAINING');
  const deletionCapability = parseBoolean(env, 'GRADING_PROVIDER_DELETION_CAPABILITY');
  const enabled = parseBoolean(env, isAi ? 'GRADING_AI_PROVIDER_ENABLED' : 'GRADING_MATHPIX_ENABLED');
  const policy = normalizeExternalProcessingPolicy({
    id: policyId(`grading-provider:${provider}`, version),
    provider,
    version,
    model: isAi ? required(env, 'AI_MODEL') : null,
    endpoint,
    purpose: isAi ? 'rubric-grading' : 'answer-conversion',
    dataCategories: parseList(env, isAi ? 'GRADING_AI_PROVIDER_DATA_CATEGORIES' : 'GRADING_MATHPIX_DATA_CATEGORIES', ['student-answer']),
    minimizedScope: parseList(env, isAi ? 'GRADING_AI_PROVIDER_MINIMIZED_SCOPE' : 'GRADING_MATHPIX_MINIMIZED_SCOPE', ['selected-question', 'answer-evidence']),
    institutionScope: optional(env, 'GRADING_PROVIDER_INSTITUTION_SCOPE'),
    classScope: parseList(env, 'GRADING_PROVIDER_CLASS_SCOPE', ['*']),
    processingRegion,
    agreementVersion,
    noTraining,
    providerRetentionSeconds: parseInteger(env, 'GRADING_PROVIDER_RETENTION_SECONDS', 0) ?? 0,
    deletionCapability,
    rateLimitPerMinute: parseInteger(env, 'GRADING_PROVIDER_RATE_LIMIT_PER_MINUTE', 1) ?? 1,
    enabled,
    disabledAt: null,
    credentialRef,
  });
  if (!policy) throw new Error(`grading-policy-config-invalid:${kind}`);
  if (!policy.dataCategories.includes('student-answer') || !policy.minimizedScope.includes('selected-question') || !policy.minimizedScope.includes('answer-evidence')) {
    throw new Error(`grading-policy-config-incomplete:${kind}-scope`);
  }
  return { ...policy, id: policyId(`grading-provider:${provider}`, version) };
}

export function parseGradingPolicySeedConfig(env: Env = process.env): GradingPolicySeedConfig {
  const config = {
    lifecycle: [
      parseLifecyclePolicy(env, 'source-asset', 'SOURCE_ASSET'),
      parseLifecyclePolicy(env, 'answer-evidence', 'ANSWER_EVIDENCE'),
      parseLifecyclePolicy(env, 'document-conversion', 'DOCUMENT_CONVERSION'),
      parseLifecyclePolicy(env, 'ai-draft', 'AI_DRAFT'),
      parseLifecyclePolicy(env, 'grading-run', 'RUN'),
    ],
    providers: [parseProviderPolicy(env, 'ai'), parseProviderPolicy(env, 'mathpix')],
  };
  assertProductionProviderRetentionAdapter(config, env.NODE_ENV?.trim().toLowerCase() === 'production');
  return config;
}

export async function ensureGradingPolicies(input: { db: GradingPolicyDb; config: GradingPolicySeedConfig; dryRun?: boolean; production?: boolean }) {
  assertProductionProviderRetentionAdapter(input.config, input.production === true);
  const dryRun = input.dryRun === true;
  if (!dryRun && (!input.db.gradingLifecyclePolicy?.upsert || !input.db.gradingProviderPolicy?.upsert)) throw new Error('grading-policy-repository-unavailable');
  const actions: Array<{ kind: 'lifecycle' | 'provider'; key: string; action: 'would-create-or-keep' | 'upserted' }> = [];
  for (const policy of input.config.lifecycle) {
    const where = { dataClass_version: { dataClass: policy.dataClass, version: policy.version } };
    if (dryRun) {
      actions.push({ kind: 'lifecycle', key: `${policy.dataClass}:${policy.version}`, action: 'would-create-or-keep' });
    } else {
      await input.db.gradingLifecyclePolicy!.upsert({ where, create: { ...policy }, update: {} });
      actions.push({ kind: 'lifecycle', key: `${policy.dataClass}:${policy.version}`, action: 'upserted' });
    }
  }
  for (const policy of input.config.providers) {
    const where = { provider_version: { provider: policy.provider, version: policy.version } };
    if (dryRun) {
      actions.push({ kind: 'provider', key: `${policy.provider}:${policy.version}`, action: 'would-create-or-keep' });
    } else {
      await input.db.gradingProviderPolicy!.upsert({ where, create: { ...policy }, update: {} });
      actions.push({ kind: 'provider', key: `${policy.provider}:${policy.version}`, action: 'upserted' });
    }
  }
  return actions;
}

export async function main(argv = process.argv.slice(2), env: Env = process.env): Promise<void> {
  const config = parseGradingPolicySeedConfig(env);
  const dryRun = argv.includes('--dry-run');
  if (dryRun) {
    process.stdout.write(`${JSON.stringify({ dryRun: true, lifecycle: config.lifecycle.map(({ dataClass, version, retentionSeconds, deleteStrategy }) => ({ dataClass, version, retentionSeconds, deleteStrategy })), providers: config.providers.map(({ provider, version, purpose, enabled }) => ({ provider, version, purpose, enabled })) })}\n`);
    return;
  }
  const { prisma } = await import('../../src/lib/prisma');
  try {
    const actions = await ensureGradingPolicies({ db: prisma, config, production: env.NODE_ENV?.trim().toLowerCase() === 'production' });
    process.stdout.write(`${JSON.stringify({ dryRun: false, actions })}\n`);
  } finally {
    await prisma.$disconnect();
  }
}

if (process.argv[1]?.endsWith('ensure-grading-policies.ts')) {
  main().catch((error) => {
    const message = error instanceof Error ? error.message : 'grading-policy-seed-failed';
    process.stderr.write(`ERROR: ${message}\n`);
    process.exit(1);
  });
}
