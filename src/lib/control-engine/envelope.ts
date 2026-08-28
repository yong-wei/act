import {
  CONTROL_ENGINE_BUILD_HASH,
  CONTROL_ENGINE_EXPORTS,
} from './identity.generated';
import {
  ARENA_PREVIEW_TEACHING_SEMANTICS,
  CLIENT_RESULT_FIELDS,
  FACADE_PROTOCOL_VERSION,
  GENERATED_PACKAGE_DIR,
  IDENTITY_SCHEMA,
  type ControlEngineAuthoritySource,
  type ControlEngineCapability,
  type ControlEngineEnvelope,
  type ControlEngineErrorState,
  type ControlEngineExecutor,
  type ControlEngineLifecycle,
  type ControlEngineModelRelation,
  type ControlEngineRuntimeIdentity,
} from './types';

export function controlEngineHttpStatus(error: ControlEngineFailure): number {
  return error.state === 'timeout' || error.state === 'unavailable' ? 503 : 400;
}

export class ControlEngineFailure extends Error {
  readonly state: ControlEngineErrorState['state'];
  readonly category: string;
  readonly retryable: boolean;

  constructor(input: ControlEngineErrorState) {
    super(input.message);
    this.name = 'ControlEngineFailure';
    this.state = input.state;
    this.category = input.category;
    this.retryable = input.retryable;
  }

  toErrorState(): ControlEngineErrorState {
    return {
      state: this.state,
      category: this.category,
      message: this.message,
      retryable: this.retryable,
    };
  }
}

export function runtimeIdentity(): ControlEngineRuntimeIdentity {
  return {
    schemaVersion: IDENTITY_SCHEMA,
    protocolVersion: FACADE_PROTOCOL_VERSION,
    packageDir: GENERATED_PACKAGE_DIR,
    buildHash: CONTROL_ENGINE_BUILD_HASH,
    exports: [...CONTROL_ENGINE_EXPORTS],
  };
}

export function authoritySourceFor(
  executor: ControlEngineExecutor,
): Exclude<ControlEngineAuthoritySource, 'arena-official-evaluator'> {
  if (executor === 'server') return 'control-engine-server-facade';
  if (executor === 'worker') return 'control-engine-worker-facade';
  return 'control-engine-browser-facade';
}

export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(',')}]`;
  }
  const record = value as Record<string, unknown>;
  const keys = Object.keys(record).sort();
  return `{${keys.map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`).join(',')}}`;
}

export function rejectClientResultFields(body: unknown): string | null {
  if (!body || typeof body !== 'object') return null;
  const record = body as Record<string, unknown>;
  const present = CLIENT_RESULT_FIELDS.filter((field) => field in record);
  if (present.length > 0) {
    return `Client ${present.join('/')} fields are not accepted on the server facade.`;
  }
  const artifact = record.artifact;
  if (artifact && typeof artifact === 'object') {
    const nested = CLIENT_RESULT_FIELDS.filter((field) => field in (artifact as Record<string, unknown>));
    if (nested.length > 0) {
      return `Client artifact ${nested.join('/')} fields are not accepted on the server facade.`;
    }
  }
  return null;
}

export function assertFiniteNumber(value: unknown, label: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new ControlEngineFailure({
      state: 'unavailable',
      category: 'non-finite-result',
      message: `${label} is not a finite numerical result.`,
      retryable: false,
    });
  }
  return value;
}

export function assertFiniteTree(value: unknown, label: string): void {
  if (typeof value === 'number') {
    assertFiniteNumber(value, label);
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertFiniteTree(item, `${label}[${index}]`));
    return;
  }
  if (value && typeof value === 'object') {
    for (const [key, nested] of Object.entries(value)) {
      if (key === 'isFallback' || key === 'fallbackMessage' || key === 'source' || key === 'runtimeIdentity') {
        continue;
      }
      assertFiniteTree(nested, `${label}.${key}`);
    }
  }
}

export function identifiedClaimWithoutParameters(
  modelRelation: ControlEngineModelRelation,
  authorizedModelParameters: Record<string, number> | null | undefined,
): boolean {
  if (modelRelation !== 'identified') return false;
  if (!authorizedModelParameters) return true;
  return Object.keys(authorizedModelParameters).length === 0;
}

export function surrogateSemantics(capability: ControlEngineCapability): string {
  if (capability === 'computeArenaVirtualPreview') return ARENA_PREVIEW_TEACHING_SEMANTICS;
  if (capability === 'computeRlTraining') return 'unit-5-5-policy-learning-surrogate';
  if (capability === 'computeSimulationStep') return 'control-odyssey-surrogate';
  if (capability === 'computeVirtualSimulationStep') return 'virtual-simulation-surrogate';
  return 'control-analysis-surrogate';
}

export function okEnvelope<TResult>(input: {
  capability: ControlEngineCapability;
  executor: ControlEngineExecutor;
  requestId: string;
  canonicalRequestHash: string;
  result: TResult;
  persisted?: boolean;
  modelRelation?: ControlEngineModelRelation;
  teachingSemantics?: string;
  authoritySource?: ControlEngineAuthoritySource;
}): ControlEngineEnvelope<TResult> {
  const executor = input.executor;
  return {
    ok: true,
    capability: input.capability,
    executor,
    authoritySource: input.authoritySource ?? authoritySourceFor(executor),
    persisted: input.persisted === true,
    modelRelation: input.modelRelation ?? 'surrogate',
    teachingSemantics: input.teachingSemantics ?? surrogateSemantics(input.capability),
    prohibitsMixedClaims: true,
    runtimeIdentity: runtimeIdentity(),
    canonicalRequestHash: input.canonicalRequestHash,
    requestId: input.requestId,
    result: input.result,
  };
}

export function mapFailure(error: unknown, fallbackState: ControlEngineLifecycle = 'error'): ControlEngineFailure {
  if (error instanceof ControlEngineFailure) return error;
  const message = error instanceof Error ? error.message : 'Control engine execution failed.';
  const state = fallbackState === 'timeout' || fallbackState === 'unavailable' ? fallbackState : 'error';
  return new ControlEngineFailure({
    state,
    category: state === 'timeout' ? 'timeout' : 'execution-error',
    message,
    retryable: state === 'timeout',
  });
}

export function newRequestId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export async function sha256Hex(text: string): Promise<string> {
  const digest = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export async function canonicalRequestHash(value: unknown): Promise<string> {
  return sha256Hex(stableStringify(value));
}
