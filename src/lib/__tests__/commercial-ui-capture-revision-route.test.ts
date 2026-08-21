import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  computeCaptureRevisionProof: vi.fn(),
}));

vi.mock('@/lib/commercial-ui-capture-revision', () => ({
  computeCaptureRevisionProof: mocks.computeCaptureRevisionProof,
}));

const proof = {
  commitSha: 'a'.repeat(40),
  treeSha: 'b'.repeat(40),
  sourceFingerprint: 'c'.repeat(64),
  clean: true,
} as const;

const originalNodeEnv = process.env.NODE_ENV;
const originalBridge = process.env.ACT_LOCAL_QA_BRIDGE;
const mutableEnvironment = process.env as unknown as Record<string, string | undefined>;

function restoreEnvironment() {
  if (originalNodeEnv === undefined) delete mutableEnvironment.NODE_ENV;
  else mutableEnvironment.NODE_ENV = originalNodeEnv;
  if (originalBridge === undefined) delete mutableEnvironment.ACT_LOCAL_QA_BRIDGE;
  else mutableEnvironment.ACT_LOCAL_QA_BRIDGE = originalBridge;
}

async function loadRoute() {
  vi.resetModules();
  return import('../../app/api/internal/local-qa/revision/route');
}

describe('development-only commercial UI capture revision probe', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mutableEnvironment.NODE_ENV = 'development';
    delete mutableEnvironment.ACT_LOCAL_QA_BRIDGE;
    mocks.computeCaptureRevisionProof.mockReturnValue(proof);
  });

  afterEach(() => {
    restoreEnvironment();
  });

  it('returns 404 without exposing Git metadata outside the explicit local bridge', async () => {
    const { GET } = await loadRoute();
    vi.clearAllMocks();
    mutableEnvironment.NODE_ENV = 'production';
    mutableEnvironment.ACT_LOCAL_QA_BRIDGE = '1';
    const productionResponse = await GET();
    expect(productionResponse.status).toBe(404);
    expect(await productionResponse.text()).toBe('');

    mutableEnvironment.NODE_ENV = 'development';
    delete mutableEnvironment.ACT_LOCAL_QA_BRIDGE;
    const disabledResponse = await GET();
    expect(disabledResponse.status).toBe(404);
    expect(await disabledResponse.text()).toBe('');
    expect(mocks.computeCaptureRevisionProof).not.toHaveBeenCalled();
  });

  it('returns only the fixed clean proof with no-store caching when enabled', async () => {
    const { GET } = await loadRoute();
    mutableEnvironment.ACT_LOCAL_QA_BRIDGE = '1';
    const response = await GET();
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(Object.keys(await response.json()).sort()).toEqual([
      'clean',
      'commitSha',
      'sourceFingerprint',
      'treeSha',
    ]);
  });

  it('fails closed without returning a dirty or Git error payload', async () => {
    mutableEnvironment.ACT_LOCAL_QA_BRIDGE = '1';
    mocks.computeCaptureRevisionProof.mockReturnValue({ ...proof, clean: false });
    const { GET: dirtyGet } = await loadRoute();
    const dirtyResponse = await dirtyGet();
    expect(dirtyResponse.status).toBe(503);
    expect(await dirtyResponse.text()).toBe('');

    mocks.computeCaptureRevisionProof.mockImplementation(() => {
      throw new Error('git metadata should not reach the response');
    });
    const { GET: errorGet } = await loadRoute();
    const errorResponse = await errorGet();
    expect(errorResponse.status).toBe(503);
    expect(await errorResponse.text()).toBe('');
  });

  it('keeps the first runtime proof stable for the lifetime of the route module', async () => {
    const { GET } = await loadRoute();
    mutableEnvironment.ACT_LOCAL_QA_BRIDGE = '1';
    const firstResponse = await GET();
    expect(firstResponse.status).toBe(200);
    const firstProof = await firstResponse.json();

    mocks.computeCaptureRevisionProof.mockReturnValue({
      ...proof,
      commitSha: 'd'.repeat(40),
      treeSha: 'e'.repeat(40),
    });
    const secondResponse = await GET();
    expect(secondResponse.status).toBe(200);
    expect(await secondResponse.json()).toEqual(firstProof);
  });

  it('does not expose a test-only route export', async () => {
    const route = await loadRoute();
    expect(route).not.toHaveProperty('resetRuntimeRevisionProofForTests');
  });
});
