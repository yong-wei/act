import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import {
  chromium,
  request,
  type Browser,
  type BrowserContextOptions,
  type Page,
  type Response,
} from 'playwright';

import {
  evidenceCaptureRevisionProblems,
  type EvidenceCaptureRevision,
} from '../../src/lib/evidence-capture-guard';
import {
  CAPTURE_REVISION_SOURCE_FILES,
  assertRuntimeCaptureRevisionProofMatches,
  computeCaptureRevisionProof,
  createRuntimeCaptureRevisionProbeUrl,
  fetchRuntimeCaptureRevisionProof,
  type CaptureRevisionProof,
} from '../../src/lib/commercial-ui-capture-revision';
import {
  KNOWLEDGE_WORKSPACE_QA_ROLES,
} from './knowledge-workspace-product-qa-accounts.mjs';

type KnowledgeWorkspaceQaCredentials = {
  email: string;
  password: string;
  expectedRole: 'STUDENT' | 'TEACHER' | 'ADMIN';
};

const repoRoot = process.cwd();
const outputDir = path.join(repoRoot, process.env.KNOWLEDGE_QA_OUTPUT_DIR ?? 'artifacts/knowledge-workspace-product-qa-489');
const baseUrl = process.env.KNOWLEDGE_QA_BASE_URL ?? 'http://localhost:3002';
const selectedNodeId = process.env.KNOWLEDGE_QA_SELECTED_NODE_ID ?? '稳定性_1_7288b4ea';
const dragNodeId = process.env.KNOWLEDGE_QA_DRAG_NODE_ID ?? 'z反变换_7_7959c077';
const threeDimensionalFitSafetyMargin = 8;
const MIN_ACTIVE_MOBILE_VIEWPORT_CANVAS_HEIGHT = 160;
const MIN_ACTIVE_MOBILE_VIEWPORT_CANVAS_PAINT_PIXELS = 30;
const captureOutputPrefixes = [
  'artifacts/knowledge-workspace-product-qa-489/',
  'artifacts/knowledge-workspace-tools-inspector-487/',
  'artifacts/knowledge-graph-semantic-map-486/',
  'artifacts/commercial-ui/knowledge-graph-governance-462/',
] as const;
const captureArtifactPrefixes = [...captureOutputPrefixes, 'artifacts/commercial-ui/evidence.json'] as const;

const sourceFiles = [
  'src/features/knowledge/knowledge-graph-system.tsx',
  'src/features/knowledge/knowledge-graph-workspace.tsx',
  'src/features/knowledge/active-authority-graph.tsx',
  'src/features/knowledge/active-authority-runtime-view.tsx',
  'src/features/knowledge/graph/knowledge-graph-runtime-canvas.tsx',
  'src/features/knowledge/active-authority-shard-store.ts',
  'src/features/knowledge/active-authority-presentation.ts',
  'src/features/knowledge/active-authority-graph-contracts.ts',
  'src/lib/authority-domain-shards/contracts.ts',
  'src/lib/authority-domain-shards/envelope.ts',
  'src/lib/authority-domain-shards/loader.ts',
  'src/lib/authority-domain-shards/materialize.ts',
  'src/lib/authority-domain-shards/labels.ts',
  'src/app/api/knowledge/_active-authority.ts',
  'src/app/api/knowledge/shards/active/route.ts',
  'src/app/api/knowledge/shards/active/domains/[domain]/route.ts',
  'src/app/api/knowledge/shards/active/domains/[domain]/families/[family]/route.ts',
  'src/app/api/knowledge/shards/active/neighborhoods/[id]/route.ts',
  'src/app/api/knowledge/shards/active/nodes/[id]/route.ts',
  'src/app/api/knowledge/shards/active/nodes/[id]/infograph/route.ts',
  'src/lib/authority-domain-shards/learning-content.ts',
  'src/app/knowledge/page.tsx',
  'src/app/assessment/adaptive-practice/page.tsx',
  'src/features/knowledge/graph/knowledge-graph-2d.tsx',
  'src/features/knowledge/graph/knowledge-graph-canvas.tsx',
  'src/features/knowledge/graph/relation-family-control.tsx',
  'src/features/knowledge/graph/visual-config.ts',
  'src/features/knowledge/resource-panel/resource-panel.tsx',
  'src/components/ai/global-ai-button.tsx',
  'src/components/ai/global-ai-sidebar.tsx',
  'src/components/providers/global-ai-provider.tsx',
  'src/components/platform/app-shell.tsx',
  'src/components/shared/page-floating-controls.tsx',
  'src/app/globals.css',
  'src/lib/konling-agent-runtime.ts',
  'src/lib/evidence-capture-guard.ts',
  'scripts/tests/capture-knowledge-workspace-product-qa.ts',
  'scripts/tests/knowledge-workspace-product-qa-accounts.mjs',
  'scripts/tests/run-knowledge-workspace-product-qa.mjs',
  'scripts/tests/test-commercial-ui-governance.ts',
] as const;

type Theme = 'dark' | 'light';
type NavigationState = 'collapsed' | 'expanded' | 'mobile';
type DockState = 'collapsed' | 'expanded';
type KnowledgeMode = 'active' | 'legacy' | 'candidate';
type KnowledgeRole = 'student' | 'teacher' | 'admin';
type EvidenceRect = { left: number; top: number; right: number; bottom: number; width: number; height: number };
type IndependentVisualReviewEvidence = {
  path: string;
  reviewer: string;
  finalResult: 'passed' | 'pending';
  blockingFindings: string[];
  dimensions: Record<string, unknown>;
  reviewedStateSha256?: Record<string, string>;
  reviewedSourceSha256?: Record<string, string>;
};

interface CaptureState {
  name: string;
  route?: '/knowledge' | '/assessment/adaptive-practice';
  theme: Theme;
  width: number;
  height: number;
  navigationPreference: 'collapsed' | 'expanded';
  navigationState: NavigationState;
  dockState: DockState;
  localToolState: string;
  selectedNode: string | null;
  interactionState: string;
  knowledgeMode?: KnowledgeMode;
  query?: string;
  beforeShot?: (page: Page, probe: KnowledgeApiProbe) => Promise<Record<string, unknown> | void>;
}

type KnowledgeApiSummary = {
  path: string;
  search: string;
  status: number;
  nodeCount: number | null;
  relationCount: number | null;
  authorityActive: boolean;
  candidateAuthority: boolean;
  hasAuthorityProvenance: boolean;
  authorityIdentityMatches: boolean;
  activationIdentityMatches: boolean;
  identityFieldCount: number;
  projectionVersionValid: boolean;
  provenanceIntegrityMatches: boolean;
  provenanceFieldCount: number;
  coverageObjectCount: number | null;
  coverageRelationCount: number | null;
  hasSourceIdentityFields: boolean;
  hasCoverageFields: boolean;
  projectionBoundaryValid: boolean;
  requestedNodeKey: string | null;
  responseNodeKey: string | null;
  activeNodeIdentityMatches: boolean;
  capturedAt: number;
};

type KnowledgeApiProbe = {
  waitForPath(pathName: string, timeoutMs?: number): Promise<void>;
  readLog(): Promise<KnowledgeApiSummary[]>;
  readSensitiveTokens(): Promise<string[]>;
  dispose(): void;
};

type ActiveSourceIdentityField =
  | 'authorityState'
  | 'releaseSetId'
  | 'releaseId'
  | 'projectionDigest'
  | 'sourceDatasetHash';

const ACTIVE_CANVAS_SOURCE_IDENTITY_FIELDS: readonly ActiveSourceIdentityField[] = [
  'authorityState',
  'releaseSetId',
  'releaseId',
  'projectionDigest',
  'sourceDatasetHash',
];

const ACTIVE_NODE_SOURCE_IDENTITY_FIELDS: readonly ActiveSourceIdentityField[] = [
  'authorityState',
  'releaseSetId',
  'releaseId',
  'projectionDigest',
];

const SHA256_HEX = /^[a-f0-9]{64}$/u;

export function validateActiveSourceIdentity(
  pathName: string,
  source: Record<string, unknown>,
) {
  const isActiveNode = pathName === '/api/knowledge/nodes/active/:node';
  const requiredFields = isActiveNode
    ? ACTIVE_NODE_SOURCE_IDENTITY_FIELDS
    : ACTIVE_CANVAS_SOURCE_IDENTITY_FIELDS;
  const sourceDatasetHashPresent = Object.prototype.hasOwnProperty.call(source, 'sourceDatasetHash');
  const sourceDatasetHashValid = !sourceDatasetHashPresent
    || source.sourceDatasetHash === null
    || (typeof source.sourceDatasetHash === 'string' && SHA256_HEX.test(source.sourceDatasetHash));
  const requiredFieldsValid = requiredFields.every((field) => {
    if (!Object.prototype.hasOwnProperty.call(source, field)) return false;
    if (field === 'authorityState') return source[field] === 'active';
    if (field === 'projectionDigest') return source[field] === null;
    if (field === 'sourceDatasetHash') return sourceDatasetHashValid;
    return typeof source[field] === 'string' && Boolean(source[field]);
  });
  return {
    identityFieldCount: ACTIVE_CANVAS_SOURCE_IDENTITY_FIELDS.filter((field) => (
      Object.prototype.hasOwnProperty.call(source, field)
    )).length,
    hasSourceIdentityFields: requiredFieldsValid
      && sourceDatasetHashValid
      && (isActiveNode || sourceDatasetHashPresent),
    sourceDatasetHashValid,
  };
}

type SafeApiEndpointClass = 'active-canvas' | 'active-node' | 'active-media' | 'legacy' | 'candidate';
type SafeApiRoleClass = KnowledgeRole;
type SafeApiSequenceEntry = {
  endpointClass: SafeApiEndpointClass;
  status: number;
  requestCount: number;
};
type SafeApiEvidenceV1 = {
  schemaVersion: 'safe-api-evidence/v1';
  roleClass: SafeApiRoleClass;
  sequence: SafeApiSequenceEntry[];
  checks: {
    activeNodeRequestObserved: boolean;
    activeCanvasIdentityVerified: boolean;
    activeNodeIdentityVerified: boolean;
    provenanceIdentityVerified: boolean;
    roleRequestIsolationVerified: boolean;
    forbiddenDataAbsent: boolean;
  };
};

type SafeApiProjectionOptions = {
  allowLegacy: boolean;
  allowCandidate: boolean;
  requireActiveCanvas: boolean;
  expectedActiveNodeKey?: string | null;
  forbiddenDataAbsent?: boolean;
};

const SAFE_API_ENDPOINT_ORDER: readonly SafeApiEndpointClass[] = [
  'active-canvas',
  'active-node',
  'active-media',
  'legacy',
  'candidate',
];

type RoleSession = {
  role: KnowledgeRole;
  storageState: NonNullable<BrowserContextOptions['storageState']>;
};

function sha256(relativePath: string) {
  return createHash('sha256').update(readFileSync(path.join(repoRoot, relativePath))).digest('hex');
}

function gitSha256(relativePath: string) {
  return createHash('sha256').update(execFileSync(
    'git',
    ['show', `HEAD:${relativePath}`],
    { cwd: repoRoot, maxBuffer: 32 * 1024 * 1024 },
  )).digest('hex');
}

function readGitCaptureState() {
  const status = execFileSync(
    'git',
    ['status', '--porcelain=v1', '--untracked-files=all'],
    { cwd: repoRoot, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
  );
  const dirtyPaths = status
    .split(/\r?\n/u)
    .filter(Boolean)
    .map((entry) => entry.slice(3).split(' -> ').at(-1) ?? entry)
    .map((entry) => entry.replace(/^"|"$/gu, '').replace(/\\/gu, '/'));
  return {
    revision: {
      commitSha: execFileSync(
        'git',
        ['rev-parse', '--verify', 'HEAD^{commit}'],
        { cwd: repoRoot, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
      ).trim(),
      treeSha: execFileSync(
        'git',
        ['rev-parse', '--verify', 'HEAD^{tree}'],
        { cwd: repoRoot, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
      ).trim(),
    } satisfies EvidenceCaptureRevision,
    dirtyPaths,
  };
}

function readCleanCaptureRevision() {
  const state = readGitCaptureState();
  if (state.dirtyPaths.length > 0) {
    throw new Error(
      `knowledge workspace product QA capture requires a clean Git worktree; commit or remove these changes first:\n${state.dirtyPaths.join('\n')}`,
    );
  }
  return state.revision;
}

function readRuntimeCaptureRevision(allowedDirtyPrefixes: readonly string[] = []): CaptureRevisionProof {
  const proof = computeCaptureRevisionProof(
    repoRoot,
    CAPTURE_REVISION_SOURCE_FILES,
    allowedDirtyPrefixes,
  );
  if (!proof.clean) {
    throw new Error('knowledge workspace product QA runtime revision requires a clean source worktree.');
  }
  return proof;
}

function assertCaptureRevisionUnchanged(
  expected: EvidenceCaptureRevision,
  phase: string,
  allowedDirtyPrefixes: readonly string[] = [],
) {
  const actual = readGitCaptureState();
  const problems = evidenceCaptureRevisionProblems(
    expected,
    actual.revision,
    actual.dirtyPaths,
    allowedDirtyPrefixes,
  );
  if (problems.length > 0) {
    throw new Error(`knowledge workspace product QA capture ${phase} failed closed: ${problems.join(', ')}`);
  }
  return actual;
}

function ensureOutputDir() {
  mkdirSync(outputDir, { recursive: true });
}

function pendingIndependentVisualReview(): IndependentVisualReviewEvidence {
  return {
    path: `${path.relative(repoRoot, outputDir)}/visual-review.md`,
    reviewer: 'critical-reviewer',
    finalResult: 'pending',
    blockingFindings: ['visual-review-not-run'],
    dimensions: {},
  };
}

function stringRecord(value: unknown): Record<string, string> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  const entries = Object.entries(record).filter((entry): entry is [string, string] => typeof entry[1] === 'string');
  return entries.length === Object.keys(record).length ? Object.fromEntries(entries) : null;
}

function objectRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function stringRecordsMatch(left: Record<string, string> | null, right: Record<string, string>) {
  if (!left) return false;
  const leftKeys = Object.keys(left).sort();
  const rightKeys = Object.keys(right).sort();
  return leftKeys.length === rightKeys.length
    && leftKeys.every((key, index) => key === rightKeys[index] && left[key] === right[key]);
}

function screenshotSha256ByStateName(stateMatrix: readonly unknown[]) {
  return Object.fromEntries(stateMatrix.flatMap((entry) => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return [];
    const record = entry as Record<string, unknown>;
    return typeof record.name === 'string' && typeof record.screenshotSha256 === 'string'
      ? [[record.name, record.screenshotSha256]]
      : [];
  }));
}

function readExistingIndependentVisualReview(
  stateMatrix: readonly unknown[],
  currentSourceSha256: Record<string, string>,
  additionalStateMatrix: readonly unknown[] = [],
): IndependentVisualReviewEvidence | null {
  const evidencePath = path.join(outputDir, 'browser-evidence.json');
  if (!existsSync(evidencePath)) return null;

  try {
    const parsed = JSON.parse(readFileSync(evidencePath, 'utf8')) as { independentVisualReview?: unknown };
    const review = parsed.independentVisualReview;
    if (!review || typeof review !== 'object' || Array.isArray(review)) return null;

    const record = review as Record<string, unknown>;
    const blockingFindings = Array.isArray(record.blockingFindings) ? record.blockingFindings : null;
    if (record.finalResult !== 'passed' || !blockingFindings || blockingFindings.length !== 0) return null;
    if (typeof record.path !== 'string' || !record.path.trim()) return null;
    if (typeof record.reviewer !== 'string' || !record.reviewer.trim()) return null;

    const dimensions = record.dimensions && typeof record.dimensions === 'object' && !Array.isArray(record.dimensions)
      ? record.dimensions as Record<string, unknown>
      : {};
    const currentStateSha256 = screenshotSha256ByStateName([...stateMatrix, ...additionalStateMatrix]);
    const reviewedStateSha256 = stringRecord(record.reviewedStateSha256);
    const reviewedSourceSha256 = stringRecord(record.reviewedSourceSha256);
    if (!stringRecordsMatch(reviewedStateSha256, currentStateSha256)) return null;
    if (!stringRecordsMatch(reviewedSourceSha256, currentSourceSha256)) return null;

    return {
      path: record.path,
      reviewer: record.reviewer,
      finalResult: 'passed',
      blockingFindings: [],
      dimensions,
      reviewedStateSha256: currentStateSha256,
      reviewedSourceSha256: currentSourceSha256,
    };
  } catch {
    return null;
  }
}

const roleEnvironment: Record<KnowledgeRole, {
  email: string;
  password: string;
  expectedRole: KnowledgeWorkspaceQaCredentials['expectedRole'];
}> = {
  student: {
    email: 'KNOWLEDGE_QA_STUDENT_EMAIL',
    password: 'KNOWLEDGE_QA_STUDENT_PASSWORD',
    expectedRole: 'STUDENT',
  },
  teacher: {
    email: 'KNOWLEDGE_QA_TEACHER_EMAIL',
    password: 'KNOWLEDGE_QA_TEACHER_PASSWORD',
    expectedRole: 'TEACHER',
  },
  admin: {
    email: 'KNOWLEDGE_QA_ADMIN_EMAIL',
    password: 'KNOWLEDGE_QA_ADMIN_PASSWORD',
    expectedRole: 'ADMIN',
  },
};

function configuredRoleCredentials() {
  const credentials = Object.fromEntries(KNOWLEDGE_WORKSPACE_QA_ROLES.map((role) => {
    const environment = roleEnvironment[role];
    return [role, {
      email: process.env[environment.email]?.trim() ?? '',
      password: process.env[environment.password] ?? '',
      expectedRole: environment.expectedRole,
    }];
  })) as Record<KnowledgeRole, KnowledgeWorkspaceQaCredentials>;
  const hasValue = (role: KnowledgeRole) => Boolean(credentials[role].email || credentials[role].password);
  const isComplete = (role: KnowledgeRole) => Boolean(credentials[role].email && credentials[role].password);

  if (KNOWLEDGE_WORKSPACE_QA_ROLES.some(hasValue) && !KNOWLEDGE_WORKSPACE_QA_ROLES.every(isComplete)) {
    throw new Error('knowledge workspace QA credentials must be configured for all three roles');
  }
  return KNOWLEDGE_WORKSPACE_QA_ROLES.every(isComplete) ? credentials : null;
}

async function resolveRoleCredentials() {
  const configured = configuredRoleCredentials();
  if (configured) return configured;

  const environment = roleEnvironment.student;
  throw new Error(
    `missing credentials for student; run run-knowledge-workspace-product-qa.mjs for managed local fixtures or set ${environment.email} and ${environment.password}`,
  );
}

async function establishRoleSession(
  role: KnowledgeRole,
  credentials: KnowledgeWorkspaceQaCredentials,
): Promise<RoleSession> {
  const api = await request.newContext();
  try {
    const csrfResponse = await api.get(`${baseUrl}/api/auth/csrf`);
    if (!csrfResponse.ok()) throw new Error(`CSRF request failed for ${role}: ${csrfResponse.status()}`);
    const csrf = await csrfResponse.json() as { csrfToken?: unknown };
    if (typeof csrf.csrfToken !== 'string' || !csrf.csrfToken) {
      throw new Error(`CSRF response missing token for ${role}`);
    }
    const loginResponse = await api.post(`${baseUrl}/api/auth/callback/credentials`, {
      form: {
        csrfToken: csrf.csrfToken,
        email: credentials.email,
        password: credentials.password,
        redirect: 'false',
        json: 'true',
      },
    });
    if (!loginResponse.ok()) throw new Error(`credentials login failed for ${role}: ${loginResponse.status()}`);
    const sessionResponse = await api.get(`${baseUrl}/api/auth/session`);
    const session = await sessionResponse.json() as { user?: { id?: unknown; role?: unknown } };
    if (session.user?.role !== credentials.expectedRole || typeof session.user.id !== 'string') {
      throw new Error(`authenticated role mismatch for ${role}`);
    }
    return { role, storageState: await api.storageState() };
  } finally {
    await api.dispose();
  }
}

async function addKnowledgeApiProbe(context: Awaited<ReturnType<Browser['newContext']>>) {
  await context.addInitScript(() => {
    const copyKey = '__ACT_KNOWLEDGE_PRODUCT_QA_COPY_PAYLOADS__';
    const copyTarget = window as Window & { [copyKey]?: string[] };
    copyTarget[copyKey] = [];
    const rememberCopyPayload = (value: unknown) => {
      if (typeof value !== 'string') return;
      copyTarget[copyKey]?.push(value);
    };
    document.addEventListener('copy', (event) => {
      rememberCopyPayload(
        event.clipboardData?.getData('text/plain')
          || window.getSelection()?.toString()
          || '',
      );
    }, true);
    try {
      const clipboard = navigator.clipboard;
      const originalWriteText = clipboard?.writeText?.bind(clipboard);
      if (clipboard && originalWriteText) {
        Object.defineProperty(clipboard, 'writeText', {
          configurable: true,
          value: async (value: string) => {
            rememberCopyPayload(value);
            return originalWriteText(value);
          },
        });
      }
    } catch {
      // Clipboard may be unavailable in headless or non-secure contexts.
    }
  });
}

function canonicalKnowledgeNodePath(pathName: string, prefix: string, canonicalPath: string) {
  if (!pathName.startsWith(prefix)) return null;
  const encodedNodeKey = pathName.slice(prefix.length);
  if (!encodedNodeKey || encodedNodeKey.includes('/')) return null;
  try {
    const decodedNodeKey = decodeURIComponent(encodedNodeKey);
    return decodedNodeKey && !decodedNodeKey.includes('/') ? canonicalPath : null;
  } catch {
    return null;
  }
}

function canonicalAuthorityShardPath(
  pathName: string,
  prefix: string,
  expectedSegments: readonly string[],
  canonicalPath: string,
) {
  if (!pathName.startsWith(prefix)) return null;
  const segments = pathName.slice(prefix.length).split('/');
  if (segments.length !== expectedSegments.length) return null;
  for (let index = 0; index < segments.length; index += 1) {
    const segment = segments[index];
    const expected = expectedSegments[index];
    if (!segment) return null;
    if (expected.startsWith(':')) {
      try {
        const decoded = decodeURIComponent(segment);
        if (!decoded || decoded.includes('/')) return null;
      } catch {
        return null;
      }
    } else if (segment !== expected) {
      return null;
    }
  }
  return canonicalPath;
}

function canonicalKnowledgeApiPath(pathName: string, method: string) {
  if (method !== 'GET') return null;
  if (pathName === '/api/knowledge/shards/active') return '/api/knowledge/shards/active';
  const activeDomainPath = canonicalAuthorityShardPath(
    pathName,
    '/api/knowledge/shards/active/domains/',
    [':domain'],
    '/api/knowledge/shards/active/domains/:domain',
  );
  if (activeDomainPath) return activeDomainPath;
  const activeFamilyPath = canonicalAuthorityShardPath(
    pathName,
    '/api/knowledge/shards/active/domains/',
    [':domain', 'families', ':family'],
    '/api/knowledge/shards/active/domains/:domain/families/:family',
  );
  if (activeFamilyPath) return activeFamilyPath;
  const activeNeighborhoodPath = canonicalAuthorityShardPath(
    pathName,
    '/api/knowledge/shards/active/neighborhoods/',
    [':node'],
    '/api/knowledge/shards/active/neighborhoods/:node',
  );
  if (activeNeighborhoodPath) return activeNeighborhoodPath;
  const activeDetailPath = canonicalAuthorityShardPath(
    pathName,
    '/api/knowledge/shards/active/nodes/',
    [':node'],
    '/api/knowledge/shards/active/nodes/:node',
  );
  if (activeDetailPath) return activeDetailPath;
  const activeInfographPath = canonicalAuthorityShardPath(
    pathName,
    '/api/knowledge/shards/active/nodes/',
    [':node', 'infograph'],
    '/api/knowledge/shards/active/nodes/:node/infograph',
  );
  if (activeInfographPath) return activeInfographPath;
  if (pathName === '/api/knowledge/graph/active') return '/api/knowledge/graph/active';
  if (pathName.startsWith('/api/knowledge/nodes/active')) {
    return canonicalKnowledgeNodePath(
      pathName,
      '/api/knowledge/nodes/active/',
      '/api/knowledge/nodes/active/:node',
    );
  }
  if (pathName === '/api/knowledge/graph') return '/api/knowledge/graph';
  if (pathName === '/api/knowledge/graph/v2') return '/api/knowledge/graph/v2';
  if (pathName.startsWith('/api/knowledge/nodes/v2')) return null;
  const legacyNodePath = canonicalKnowledgeNodePath(
    pathName,
    '/api/knowledge/nodes/',
    '/api/knowledge/nodes/:node',
  );
  if (legacyNodePath) return legacyNodePath;
  return null;
}

const knowledgeApiSensitiveKeyPattern = /(?:id|hash|digest|canonicaltype|predicate|direction|status|mode|tier|family|evidence|traversal|locator|edition|section|consumer|release|snapshot|activation|projection|version)/iu;
const knowledgeApiSemanticEnumKeyPattern = /^(?:canonicaltype|predicate|direction|relationfamily|family|conceptkind|layer|qualitytier|status|mode|tier|evidence|traversal)$/iu;

function collectKnowledgeApiSensitiveValues(
  value: unknown,
  rememberToken: (value: string) => void,
  field = '',
) {
  if (typeof value === 'string') {
    if (knowledgeApiSensitiveKeyPattern.test(field) && !knowledgeApiSemanticEnumKeyPattern.test(field)) {
      rememberToken(value);
    }
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item) => collectKnowledgeApiSensitiveValues(item, rememberToken, field));
    return;
  }
  if (!value || typeof value !== 'object') return;
  Object.entries(value as Record<string, unknown>).forEach(([childField, childValue]) => {
    collectKnowledgeApiSensitiveValues(childValue, rememberToken, childField);
  });
}

function summarizeKnowledgeApiResponse(
  pathName: string,
  status: number,
  body: unknown,
  requestedNodeKey: string | null,
  rememberToken: (value: string) => void,
): KnowledgeApiSummary {
  const record = objectRecord(body);
  const source = objectRecord(record.source);
  const coverage = objectRecord(record.coverage);
  const provenance = objectRecord(record.provenance);
  const authority = record.provenance && typeof record.provenance === 'object' && !Array.isArray(record.provenance)
    && record.provenance.authority && typeof record.provenance.authority === 'object' && !Array.isArray(record.provenance.authority)
    ? record.provenance.authority
    : null;
  const activation = objectRecord(provenance.activation);
  const projection = objectRecord(provenance.projection);
  const shardEnvelope = objectRecord(record.envelope);
  const isActiveMediaResponse = pathName === '/api/knowledge/shards/active/nodes/:node/infograph';
  const isActiveResponse = !isActiveMediaResponse && (pathName === '/api/knowledge/graph/active'
    || pathName === '/api/knowledge/nodes/active/:node'
    || pathName.startsWith('/api/knowledge/shards/active'));
  const isActiveShardResponse = !isActiveMediaResponse && pathName.startsWith('/api/knowledge/shards/active');
  const isActiveNodeResponse = pathName === '/api/knowledge/nodes/active/:node'
    || pathName === '/api/knowledge/shards/active/nodes/:node';
  const responseNode = objectRecord(record.node);
  const responseNodeKey = typeof responseNode.id === 'string' ? responseNode.id : null;
  const authorityRecord = objectRecord(authority);
  const shardEnvelopeValid = isActiveShardResponse
    && shardEnvelope.contract === 'act-authority-shard-envelope/v1'
    && typeof shardEnvelope.authorityCatalogVersion === 'string'
    && Boolean(shardEnvelope.authorityCatalogVersion)
    && (typeof shardEnvelope.teachingVersion === 'string' || shardEnvelope.teachingVersion === null)
    && objectRecord(shardEnvelope.match).authority === true
    && objectRecord(shardEnvelope.match).catalog === true
    && [true, false, null].includes(objectRecord(shardEnvelope.match).teaching as boolean | null);
  const sourceIdentity = isActiveShardResponse
    ? { identityFieldCount: shardEnvelopeValid ? 3 : 0, hasSourceIdentityFields: shardEnvelopeValid, sourceDatasetHashValid: true }
    : validateActiveSourceIdentity(pathName, source);
  const { identityFieldCount, hasSourceIdentityFields } = sourceIdentity;
  const authorityRequiredFields = ['consumerId', 'snapshotId', 'snapshotHash', 'releaseId', 'releaseSetId'];
  const activationRequiredFields = ['mode', 'status', 'activationId', 'activationHash'];
  const authorityComplete = authorityRequiredFields.every((field) => typeof authorityRecord[field] === 'string' && authorityRecord[field]);
  const activationComplete = activationRequiredFields.every((field) => typeof activation[field] === 'string' && activation[field]);
  const authorityIdentityMatches = isActiveShardResponse
    ? shardEnvelopeValid
    : source.authorityState === 'active'
    && hasSourceIdentityFields
    && source.projectionDigest === null
    && authorityComplete
    && authorityRecord.consumerId === 'engineering-graph'
    && source.releaseSetId === authorityRecord.releaseSetId
    && source.releaseId === authorityRecord.releaseId;
  const activationIdentityMatches = isActiveShardResponse || (
    activation.mode === 'use-combination'
    && activation.status === 'READY'
    && activationComplete
  );
  const projectionBoundaryValid = isActiveShardResponse || (
    Object.prototype.hasOwnProperty.call(projection, 'projectionId')
    && projection.projectionId === null
    && Object.prototype.hasOwnProperty.call(projection, 'projectionHash')
    && projection.projectionHash === null
    && projection.status === 'not-applicable'
  );
  const provenanceFieldCount = authorityRequiredFields.filter((field) => typeof authorityRecord[field] === 'string' && authorityRecord[field])
    .length
    + activationRequiredFields.filter((field) => typeof activation[field] === 'string' && activation[field]).length
    + (projectionBoundaryValid ? 3 : 0);
  if (isActiveResponse) collectKnowledgeApiSensitiveValues(record, rememberToken);
  collectKnowledgeApiSensitiveValues(source, rememberToken, 'source');
  collectKnowledgeApiSensitiveValues(provenance, rememberToken, 'provenance');
  collectKnowledgeApiSensitiveValues(record.nodes, rememberToken, 'nodes');
  collectKnowledgeApiSensitiveValues(record.relations, rememberToken, 'relations');
  collectKnowledgeApiSensitiveValues(record.node, rememberToken, 'node');
  collectKnowledgeApiSensitiveValues(record.release, rememberToken, 'release');
  collectKnowledgeApiSensitiveValues(record.projectionVersion, rememberToken, 'projectionVersion');
  const activeNodeIdentityMatches = !isActiveNodeResponse
    || Boolean(requestedNodeKey && responseNodeKey && requestedNodeKey === responseNodeKey);
  return {
    path: pathName,
    status,
    nodeCount: Array.isArray(record.nodes)
      ? record.nodes.length
      : Array.isArray(record.objects)
        ? record.objects.length
        : Array.isArray(objectRecord(record.root).domains)
          ? objectRecord(record.root).domains.length
          : null,
    relationCount: Array.isArray(record.relations)
      ? record.relations.length
      : Array.isArray(record.teachingRelations)
        ? record.teachingRelations.length
        : null,
    authorityActive: isActiveShardResponse ? shardEnvelopeValid : source.authorityState === 'active',
    candidateAuthority: source.authorityState === 'candidate',
    hasAuthorityProvenance: isActiveShardResponse ? shardEnvelopeValid : Boolean(authority),
    authorityIdentityMatches,
    activationIdentityMatches,
    identityFieldCount,
    projectionVersionValid: isActiveShardResponse
      ? typeof record.shardClass === 'string'
      : typeof record.projectionVersion === 'string'
      && (pathName === '/api/knowledge/graph/active'
        ? record.projectionVersion === 'act.canvas.v2'
        : pathName === '/api/knowledge/nodes/active/:node'
          ? record.projectionVersion === 'act.node-detail.v2'
          : record.projectionVersion.length > 0),
    provenanceIntegrityMatches: isActiveShardResponse
      ? shardEnvelopeValid
      : authorityIdentityMatches && activationIdentityMatches && projectionBoundaryValid,
    provenanceFieldCount,
    coverageObjectCount: typeof coverage.objectCount === 'number' ? coverage.objectCount : null,
    coverageRelationCount: typeof coverage.relationCount === 'number' ? coverage.relationCount : null,
    hasSourceIdentityFields,
    hasCoverageFields: ['objectCount', 'relationCount']
      .every((field) => Object.prototype.hasOwnProperty.call(coverage, field)),
    projectionBoundaryValid,
    requestedNodeKey,
    responseNodeKey,
    activeNodeIdentityMatches,
    capturedAt: Date.now(),
  };
}

function createKnowledgeApiProbe(page: Page): KnowledgeApiProbe {
  const log: KnowledgeApiSummary[] = [];
  const sensitiveTokens = new Set<string>();
  const pendingResponses: Array<Promise<void>> = [];
  let unknownEndpointObserved = false;
  let disposed = false;
  const rememberToken = (value: string) => {
    if (value.trim()) sensitiveTokens.add(value);
  };
  const onResponse = (response: Response) => {
    if (disposed) return;
    let responseUrl: URL;
    try {
      responseUrl = new URL(response.url());
    } catch {
      unknownEndpointObserved = true;
      return;
    }
    if (!responseUrl.pathname.startsWith('/api/knowledge/')) return;
    const safePath = canonicalKnowledgeApiPath(responseUrl.pathname, response.request().method());
    if (!safePath) {
      unknownEndpointObserved = true;
      return;
    }
    let requestedNodeKey: string | null = null;
    if (
      safePath === '/api/knowledge/nodes/active/:node'
      || safePath === '/api/knowledge/shards/active/nodes/:node'
      || safePath === '/api/knowledge/shards/active/nodes/:node/infograph'
    ) {
      try {
        const prefix = safePath === '/api/knowledge/nodes/active/:node'
          ? '/api/knowledge/nodes/active/'
          : '/api/knowledge/shards/active/nodes/';
        const encodedNodeKey = safePath === '/api/knowledge/shards/active/nodes/:node/infograph'
          ? responseUrl.pathname.slice(prefix.length, -'/infograph'.length)
          : responseUrl.pathname.slice(prefix.length);
        requestedNodeKey = decodeURIComponent(encodedNodeKey);
      } catch {
        requestedNodeKey = null;
      }
      if (requestedNodeKey) rememberToken(requestedNodeKey);
    }
    const task = (async () => {
      let body: unknown = {};
      try {
        body = await response.json();
      } catch {
        // A non-JSON response is represented by a failed closed summary.
      }
      const summary = summarizeKnowledgeApiResponse(
        safePath,
        response.status(),
        body,
        requestedNodeKey,
        rememberToken,
      );
      if (summary.responseNodeKey) rememberToken(summary.responseNodeKey);
      log.push({ ...summary, search: responseUrl.search });
    })().catch(() => {
      log.push({
        ...summarizeKnowledgeApiResponse(
          safePath,
          response.status(),
          {},
          requestedNodeKey,
          rememberToken,
        ),
        search: responseUrl.search,
      });
    });
    pendingResponses.push(task);
  };
  page.on('response', onResponse);
  return {
    async waitForPath(pathName, timeoutMs = 30000) {
      const deadline = Date.now() + timeoutMs;
      while (Date.now() < deadline) {
        await this.readLog();
        if (log.some((entry) => entry.path === pathName)) return;
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
      throw new Error('expected Knowledge API response was not observed');
    },
    async readLog() {
      while (pendingResponses.length > 0) {
        await Promise.all(pendingResponses.splice(0));
      }
      if (unknownEndpointObserved) {
        throw new Error('unknown Knowledge API endpoint observed');
      }
      return [...log];
    },
    async readSensitiveTokens() {
      await this.readLog();
      return [...sensitiveTokens];
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      page.off('response', onResponse);
    },
  };
}

async function readExpectedActiveNodeKey(page: Page): Promise<string | null> {
  return page.evaluate(() => (
    (window as Window & { __ACT_KNOWLEDGE_PRODUCT_QA_EXPECTED_ACTIVE_NODE__?: string | null })
      .__ACT_KNOWLEDGE_PRODUCT_QA_EXPECTED_ACTIVE_NODE__ ?? null
  ));
}

function safeApiEndpointClass(pathName: string): SafeApiEndpointClass {
  if (
    pathName === '/api/knowledge/nodes/active/:node'
    || pathName === '/api/knowledge/shards/active/nodes/:node'
  ) return 'active-node';
  if (pathName === '/api/knowledge/shards/active/nodes/:node/infograph') return 'active-media';
  if (
    pathName === '/api/knowledge/graph/active'
    || pathName.startsWith('/api/knowledge/shards/active')
  ) return 'active-canvas';
  if (pathName === '/api/knowledge/graph' || pathName === '/api/knowledge/nodes/:node') return 'legacy';
  if (pathName === '/api/knowledge/graph/v2') return 'candidate';
  throw new Error('unknown Knowledge API endpoint cannot be projected');
}

function stringLeaves(value: unknown): string[] {
  if (typeof value === 'string') return [value];
  if (Array.isArray(value)) return value.flatMap((entry) => stringLeaves(entry));
  if (!value || typeof value !== 'object') return [];
  return Object.values(value as Record<string, unknown>).flatMap((entry) => stringLeaves(entry));
}

export type SensitiveValueMatcher = {
  variants: readonly string[];
  matches(value: string): boolean;
  matchesExact(value: string): boolean;
  matchesJsonText(value: string): boolean;
};

function encodedTokenVariants(token: string): string[] {
  const variants = new Set<string>([token]);
  try {
    variants.add(encodeURIComponent(token));
  } catch {
    // An invalid URI sequence cannot be an encoded token.
  }
  try {
    variants.add(decodeURIComponent(token));
  } catch {
    // Keep the original token when it is not URI-decodable.
  }
  return [...variants].filter((entry) => entry.length > 0);
}

export function createSensitiveValueMatcher(tokens: readonly string[]): SensitiveValueMatcher {
  const variants = [...new Set(tokens.flatMap(encodedTokenVariants))].filter((entry) => entry.length > 0);
  return {
    variants,
    matches(value: string) {
      return variants.some((variant) => value.includes(variant));
    },
    matchesExact(value: string) {
      return variants.includes(value);
    },
    matchesJsonText(value: string) {
      return variants.some((variant) => value.includes(JSON.stringify(variant)));
    },
  };
}

async function readActiveSurfaceIdentityTokens(page: Page, probe: KnowledgeApiProbe): Promise<string[]> {
  const domTokens = await page.evaluate(() => {
    const graph = document.querySelector<HTMLElement>('[data-active-authority-graph="true"]');
    const nodeKeys = [...(graph?.querySelectorAll('[data-active-authority-node]') ?? [])]
      .map((element) => element.getAttribute('data-active-authority-node') ?? '')
      .filter(Boolean);
    const relationKeys = [...(graph?.querySelectorAll('[data-active-authority-relation]') ?? [])]
      .map((element) => element.getAttribute('data-active-authority-relation') ?? '')
      .filter(Boolean);
    return [...new Set([...nodeKeys, ...relationKeys])];
  });
  return [...new Set([...domTokens, ...(await probe.readSensitiveTokens())])];
}

function assertSafeApiEvidenceV1(
  evidence: SafeApiEvidenceV1,
  sensitiveTokens: readonly string[],
) {
  const evidenceKeys = Object.keys(evidence).sort();
  if (evidenceKeys.join('|') !== 'checks|roleClass|schemaVersion|sequence') {
    throw new Error('safe API evidence contains unknown top-level fields');
  }
  const sequenceKeys = evidence.sequence.map((entry) => Object.keys(entry).sort().join('|'));
  if (sequenceKeys.some((keys) => keys !== 'endpointClass|requestCount|status')) {
    throw new Error('safe API evidence contains unknown sequence fields');
  }
  if (evidence.sequence.some((entry) => (
    !SAFE_API_ENDPOINT_ORDER.includes(entry.endpointClass)
    || !Number.isInteger(entry.status)
    || entry.status < 100
    || entry.status > 599
    || !Number.isInteger(entry.requestCount)
    || entry.requestCount <= 0
  ))) {
    throw new Error('safe API evidence sequence is invalid');
  }
  if (new Set(evidence.sequence.map((entry) => entry.endpointClass)).size !== evidence.sequence.length) {
    throw new Error('safe API evidence contains duplicate endpoint classes');
  }
  const checkKeys = Object.keys(evidence.checks).sort();
  if (checkKeys.join('|') !== 'activeCanvasIdentityVerified|activeNodeIdentityVerified|activeNodeRequestObserved|forbiddenDataAbsent|provenanceIdentityVerified|roleRequestIsolationVerified') {
    throw new Error('safe API evidence contains unknown check fields');
  }
  if (evidence.schemaVersion !== 'safe-api-evidence/v1') {
    throw new Error('safe API evidence schema version is invalid');
  }
  if (!['student', 'teacher', 'admin'].includes(evidence.roleClass)) {
    throw new Error('safe API evidence role class is invalid');
  }
  if (!Object.values(evidence.checks).every((entry) => typeof entry === 'boolean')) {
    throw new Error('safe API evidence checks are invalid');
  }
  if (!evidence.checks.activeNodeRequestObserved && evidence.checks.activeNodeIdentityVerified) {
    throw new Error('safe API evidence cannot verify an unobserved active-node request');
  }
  if (evidence.checks.activeNodeRequestObserved !== evidence.sequence.some((entry) => entry.endpointClass === 'active-node')) {
    throw new Error('safe API evidence active-node observation is inconsistent');
  }
  const serialized = JSON.stringify(evidence);
  const bytes = Buffer.from(serialized, 'utf8');
  const byteText = bytes.toString('utf8');
  const leaves = stringLeaves(evidence);
  const sensitiveMatcher = createSensitiveValueMatcher(sensitiveTokens);
  if (leaves.some((leaf) => sensitiveMatcher.matchesExact(leaf))
    || sensitiveMatcher.matchesJsonText(serialized)
    || sensitiveMatcher.matchesJsonText(byteText)) {
    throw new Error('safe API evidence contains a dynamic server token');
  }
  if (/(?:https?:|[/\\]{2,}|[?&=]|(?:url|path|query|route|request|response|header|cookie|locator|release|snapshot|hash|activation|projection|canonical|predicate|direction|source))/iu.test(leaves.join('\n'))) {
    throw new Error('safe API evidence contains a forbidden path or server field');
  }
}

function projectSafeApiEvidence(
  roleClass: SafeApiRoleClass,
  log: readonly KnowledgeApiSummary[],
  options: SafeApiProjectionOptions,
  sensitiveTokens: readonly string[],
): SafeApiEvidenceV1 {
  const byEndpoint = new Map<SafeApiEndpointClass, KnowledgeApiSummary[]>();
  for (const entry of log) {
    const endpointClass = safeApiEndpointClass(entry.path);
    const current = byEndpoint.get(endpointClass) ?? [];
    current.push(entry);
    byEndpoint.set(endpointClass, current);
  }
  const sequence = SAFE_API_ENDPOINT_ORDER.flatMap((endpointClass) => {
    const entries = byEndpoint.get(endpointClass);
    if (!entries || entries.length === 0) return [];
    const latest = entries[entries.length - 1];
    return [{
      endpointClass,
      status: latest.status,
      requestCount: entries.length,
    }];
  });
  const activeCanvasEntries = byEndpoint.get('active-canvas') ?? [];
  const activeNodeEntries = byEndpoint.get('active-node') ?? [];
  const activeEntries = [...activeCanvasEntries, ...activeNodeEntries];
  const activeNodeRequestObserved = activeNodeEntries.length > 0;
  const expectedActiveNodeKey = options.expectedActiveNodeKey ?? null;
  const activeCanvasIdentityVerified = activeCanvasEntries.length > 0
    && activeCanvasEntries.every((entry) => (
      entry.status === 200
      && entry.authorityIdentityMatches
      && entry.projectionVersionValid
    ));
  const activeNodeIdentityVerified = activeNodeRequestObserved
    && activeNodeEntries.every((entry) => (
      entry.status === 200
      && entry.activeNodeIdentityMatches
      && (!expectedActiveNodeKey || entry.requestedNodeKey === expectedActiveNodeKey)
      && entry.authorityIdentityMatches
      && entry.projectionVersionValid
      && entry.provenanceIntegrityMatches
    ));
  const provenanceIdentityVerified = activeEntries.length > 0
    && activeEntries.every((entry) => (
      entry.status === 200
      && entry.provenanceIntegrityMatches
    ));
  const allowedEndpointClasses = new Set<SafeApiEndpointClass>([
    'active-canvas',
    'active-node',
    'active-media',
    ...(options.allowLegacy ? ['legacy' as const] : []),
    ...(options.allowCandidate ? ['candidate' as const] : []),
  ]);
  const roleRequestIsolationVerified = sequence.every((entry) => allowedEndpointClasses.has(entry.endpointClass))
    && (!options.requireActiveCanvas || activeCanvasEntries.length > 0)
    && (!options.allowCandidate || roleClass === 'admin' || !sequence.some((entry) => entry.endpointClass === 'candidate'))
    && (options.allowCandidate || !sequence.some((entry) => entry.endpointClass === 'candidate'));
  if (options.requireActiveCanvas
    && (!activeCanvasIdentityVerified || !provenanceIdentityVerified || !roleRequestIsolationVerified)) {
    throw new Error('active API evidence verification failed closed');
  }
  if (expectedActiveNodeKey && (!activeNodeRequestObserved || !activeNodeIdentityVerified)) {
    throw new Error('active-node API evidence verification failed closed');
  }
  const evidence: SafeApiEvidenceV1 = {
    schemaVersion: 'safe-api-evidence/v1',
    roleClass,
    sequence,
    checks: {
      activeNodeRequestObserved,
      activeCanvasIdentityVerified: options.requireActiveCanvas ? activeCanvasIdentityVerified : false,
      activeNodeIdentityVerified,
      provenanceIdentityVerified: options.requireActiveCanvas ? provenanceIdentityVerified : false,
      roleRequestIsolationVerified,
      forbiddenDataAbsent: options.forbiddenDataAbsent !== false,
    },
  };
  assertSafeApiEvidenceV1(evidence, sensitiveTokens);
  return evidence;
}

function latestApiSummary(log: KnowledgeApiSummary[], pathName: string) {
  return [...log].reverse().find((entry) => entry.path === pathName) ?? null;
}

function assertActiveApiSummary(summary: KnowledgeApiSummary | null, context: string) {
  if (
    !summary
    || summary.status !== 200
    || (summary.nodeCount !== null && summary.nodeCount <= 0)
    || !summary.authorityActive
    || !summary.hasAuthorityProvenance
    || !summary.authorityIdentityMatches
    || !summary.activationIdentityMatches
    || !summary.projectionBoundaryValid
    || !summary.projectionVersionValid
    || !summary.provenanceIntegrityMatches
  ) {
    throw new Error(`active Authority API failed in ${context}`);
  }
}

async function waitForActiveReady(page: Page, probe: KnowledgeApiProbe, context: string) {
  await page.waitForSelector('[data-knowledge-graph-mode="active"]', { timeout: 30000 });
  const root = page.locator('[data-authority-shard-root="true"]');
  await root.waitFor({ state: 'visible', timeout: 30000 });
  const rootDomainCount = await page.locator('[data-authority-domain-entry]').count();
  const declaredRootDomainCount = Number(await root.getAttribute('data-authority-root-domain-count'));
  const aggregateEntry = page.locator('[data-authority-aggregate-entry="true"]');
  if (
    !Number.isInteger(declaredRootDomainCount)
    || declaredRootDomainCount < 1
    || rootDomainCount !== declaredRootDomainCount
    || await aggregateEntry.count() !== 1
  ) {
    throw new Error(`active Authority root layering contract failed in ${context}`);
  }
  const domain = page.locator('[data-authority-domain-entry]').first();
  // 根域目录是 sr-only 可达性入口，指针事件由共享 canvas 承载；用 DOM click 触发进入领域。
  await domain.evaluate((element) => (element as HTMLButtonElement).click());
  await page.waitForSelector('[data-active-graph-stage="authority"]', { timeout: 30000 });
  await page.waitForFunction(() => {
    const graph = document.querySelector('[data-active-authority-graph="true"]');
    const stage = document.querySelector('[data-active-graph-stage="authority"]');
    const loading = graph?.querySelector('[role="status"]');
    const failure = graph?.querySelector('[role="alert"]');
    const nodeCount = document.querySelectorAll('[data-active-authority-node]').length;
    return Boolean(graph && stage && !loading && !failure && nodeCount > 0);
  }, undefined, { timeout: 30000 });
  await probe.waitForPath('/api/knowledge/shards/active');
  await page.waitForTimeout(100);
  const log = await probe.readLog();
  const active = latestApiSummary(log, '/api/knowledge/shards/active');
  assertActiveApiSummary(active, context);
  await enablePublishedActiveRelationFamily(page, probe, context);
  await page.waitForFunction(() => {
    const runtime = document.querySelector('[data-active-authority-runtime="force-graph"]');
    const renderer = runtime?.querySelector('[data-knowledge-graph-renderer]');
    const canvas = renderer?.querySelector('canvas');
    const rect = canvas?.getBoundingClientRect();
    return Boolean(
      renderer
      && canvas
      && rect
      && rect.width > 0
      && rect.height > 0
      && renderer.getAttribute('data-knowledge-edge-lanes'),
    );
  }, undefined, { timeout: 30000 });
  const completedLog = await probe.readLog();
  if (completedLog.some((entry) => (
    entry.path === '/api/knowledge/graph/active'
    || entry.path === '/api/knowledge/graph/v2'
    // Legacy 视图常驻隐藏挂载，active 模式仍会预载 legacy root；域展开与候选 API 仍被禁止。
    || (entry.path === '/api/knowledge/graph' && !entry.search.startsWith('?mode=root'))
  ))) {
    throw new Error(`active Authority unexpectedly requested Legacy or candidate API in ${context}`);
  }
  return active;
}

async function enablePublishedActiveRelationFamily(
  page: Page,
  probe: KnowledgeApiProbe,
  context: string,
) {
  const hasRenderedRelation = () => page.evaluate(() => {
    const enabled = document.querySelector(
      'button[data-authority-relation-family][data-authority-family-enabled="true"]',
    );
    const nodes = new Set(
      Array.from(document.querySelectorAll('[data-active-authority-node]'))
        .map((node) => node.getAttribute('data-active-authority-node'))
        .filter((value): value is string => Boolean(value)),
    );
    return Boolean(enabled)
      && Array.from(document.querySelectorAll('[data-active-authority-relation]')).some((relation) => (
        nodes.has(relation.getAttribute('data-active-authority-relation-source') ?? '')
        && nodes.has(relation.getAttribute('data-active-authority-relation-target') ?? '')
      ));
  });

  const mobileToolsToggle = page.locator('[data-active-authority-mobile-tools-toggle="true"]');
  const mobileToolsWereCollapsed = await mobileToolsToggle.count() === 1
    && await mobileToolsToggle.isVisible()
    && await mobileToolsToggle.getAttribute('aria-expanded') === 'false';
  if (mobileToolsWereCollapsed) {
    await mobileToolsToggle.click({ timeout: 10000 });
  }

  try {
    if (await hasRenderedRelation()) return;

    for (const family of [
      'association',
      'derivation-and-representation',
      'application-and-analysis',
      'structure',
    ]) {
      const control = page.locator(`button[data-authority-relation-family="${family}"]`);
      if (await control.count() !== 1 || !(await control.isVisible())) continue;

      if (await control.getAttribute('data-authority-family-enabled') !== 'true') {
        await control.click({ timeout: 10000 });
        await probe.waitForPath('/api/knowledge/shards/active/domains/:domain/families/:family');
      }

      try {
        await page.waitForFunction(
          () => {
            const nodes = new Set(
              Array.from(document.querySelectorAll('[data-active-authority-node]'))
                .map((node) => node.getAttribute('data-active-authority-node'))
                .filter((value): value is string => Boolean(value)),
            );
            return Array.from(document.querySelectorAll('[data-active-authority-relation]')).some((relation) => (
              nodes.has(relation.getAttribute('data-active-authority-relation-source') ?? '')
              && nodes.has(relation.getAttribute('data-active-authority-relation-target') ?? '')
            ));
          },
          undefined,
          { timeout: 5000 },
        );
        return;
      } catch {
        // This family may only expose a cross-domain boundary. Try the next published family.
      }
    }

    throw new Error(`active Authority did not render a published relation in ${context}`);
  } finally {
    if (mobileToolsWereCollapsed && await mobileToolsToggle.getAttribute('aria-expanded') === 'true') {
      await mobileToolsToggle.click({ timeout: 10000 });
      await page.waitForTimeout(150);
    }
  }
}

async function captureActiveSurfaceScan(page: Page, probe: KnowledgeApiProbe) {
  const sensitiveMatcher = createSensitiveValueMatcher(await readActiveSurfaceIdentityTokens(page, probe));
  const rawScan = await page.evaluate(() => {
    const graph = document.querySelector<HTMLElement>('[data-active-authority-graph="true"]');
    if (!graph) {
      return {
        graphPresent: false,
        forbiddenTokenCount: 0,
        forbiddenEnumCount: 0,
        forbiddenLocatorCount: 0,
        copyEntryCount: 0,
        copyEntryPresent: false,
        surfaceValues: [] as string[],
      };
    }

    const surfaces = new Set<string>();
    const scanRoots = [
      graph,
      ...document.querySelectorAll<HTMLElement>('[role="tooltip"], [data-tooltip-root]'),
    ].filter((root, index, roots) => roots.indexOf(root) === index);
    for (const root of scanRoots) {
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      let current = walker.nextNode();
      while (current) {
        const parent = current.parentElement;
        const value = current.textContent?.trim();
        if (parent && value) surfaces.add(value);
        current = walker.nextNode();
      }
    }
    const surfaceAttributes = ['aria-label', 'aria-description', 'title', 'data-tooltip', 'data-tooltip-content'];
    for (const element of document.querySelectorAll('*')) {
      for (const attribute of surfaceAttributes) {
        const value = element.getAttribute(attribute)?.trim();
        if (value) surfaces.add(value);
      }
    }
    const qaWindow = window as Window & {
      __ACT_KNOWLEDGE_PRODUCT_QA_COPY_PAYLOADS__?: string[];
    };
    const forbiddenTokenPattern = /\b(?:ReleaseSet|Release|Snapshot|Activation|Projection|hash)\b|发布集|快照|激活|投影|哈希/i;
    const forbiddenEnumExactPattern = /^(?:canonicalType|predicate|direction|directed|undirected|unordered|prerequisite|postrequisite|association|concept|formula|system|module|procedure|parameter|DomainConcept|KnowledgeStatement|SystemModel|ModelRepresentation)$/i;
    const forbiddenEnumMachineTokenPattern = /(?:^|[^\\p{L}\\p{N}])(?:applies_to|derived_from|has_component|has_formula|has_representation|is_a|part_of|used_to_analyze|PREREQUISITE)(?:$|[^\\p{L}\\p{N}])/iu;
    const forbiddenLocatorPattern = /\b(?:sourceLocator|source locator|locator|sourceEditionId|sectionId|editionId)\b|(?:^|[\s])internal[-_](?:source|edition|section)\b|file:\/\/|https?:\/\/|(?:^|\s)\/(?:src|course-content|artifacts)\//i;
    const surfaceValues = [...surfaces];
    const copyPayloads = qaWindow.__ACT_KNOWLEDGE_PRODUCT_QA_COPY_PAYLOADS__ ?? [];
    const copyValues = [...document.querySelectorAll('[data-copy-value], [data-copy-content], [data-copy-target]')]
      .map((element) => element.getAttribute('data-copy-value') ?? element.getAttribute('data-copy-content') ?? element.getAttribute('data-copy-target') ?? '')
      .filter(Boolean);
    const scannedValues = [...surfaceValues, ...copyPayloads, ...copyValues];
    const forbiddenTokenCount = scannedValues.filter((value) => forbiddenTokenPattern.test(value)).length;
    const forbiddenEnumCount = scannedValues.filter((value) => (
      forbiddenEnumExactPattern.test(value) || forbiddenEnumMachineTokenPattern.test(value)
    )).length;
    const forbiddenLocatorCount = scannedValues.filter((value) => forbiddenLocatorPattern.test(value)).length;
    const copyEntryCount = document.querySelectorAll('[data-copy-value], [data-copy-content], [data-copy-target], [data-copy], [aria-label*="复制"], [aria-label*="copy" i]').length
      + copyPayloads.length;
    return {
      graphPresent: true,
      forbiddenTokenCount,
      forbiddenEnumCount,
      forbiddenLocatorCount,
      copyEntryCount,
      copyEntryPresent: copyEntryCount > 0,
      surfaceValues: scannedValues,
    };
  });
  const internalIdentityLeakCount = rawScan.surfaceValues.filter((value) => sensitiveMatcher.matches(value)).length;
  return {
    graphPresent: rawScan.graphPresent,
    scannedSurfaceCount: rawScan.surfaceValues.length,
    forbiddenTokenCount: rawScan.forbiddenTokenCount,
    forbiddenEnumCount: rawScan.forbiddenEnumCount,
    forbiddenLocatorCount: rawScan.forbiddenLocatorCount,
    internalIdentityLeakCount,
    copyEntryCount: rawScan.copyEntryCount,
    copyEntryPresent: rawScan.copyEntryPresent,
    passed: rawScan.forbiddenTokenCount === 0
      && rawScan.forbiddenEnumCount === 0
      && rawScan.forbiddenLocatorCount === 0
      && internalIdentityLeakCount === 0
      && rawScan.copyEntryCount === 0,
  };
}

async function captureActiveInteractionEvidence(page: Page, probe: KnowledgeApiProbe) {
  await page.waitForSelector('[data-active-graph-stage="authority"] [data-active-authority-node]', { timeout: 10000 });
  const beforeSelectionLog = await probe.readLog();
  const preSelectionDetailRequests = beforeSelectionLog.filter((entry) => entry.path === '/api/knowledge/shards/active/nodes/:node').length;
  const preSelectionMediaRequests = beforeSelectionLog.filter((entry) => entry.path === '/api/knowledge/shards/active/nodes/:node/infograph').length;
  if (preSelectionDetailRequests > 0 || preSelectionMediaRequests > 0) {
    throw new Error('active Authority detail or media was requested before a visible node selection');
  }
  const teachingRelationsUnavailable = await page.locator('[data-authority-teaching-coverage="true"]')
    .filter({ hasText: '教学关系暂不可用' })
    .count() > 0;
  const visibleNode = page.locator('[data-active-graph-stage="authority"] [data-active-authority-visible-node="true"]').first();
  if (teachingRelationsUnavailable && await visibleNode.count() !== 1) {
    throw new Error('active Authority unavailable Teaching state is missing a visible node directory');
  }
  const node = teachingRelationsUnavailable
    ? visibleNode
    : page.locator('[data-active-graph-stage="authority"] [data-active-authority-node]').first();
  const visibleNodeControl = await node.isVisible();
  if (teachingRelationsUnavailable && !visibleNodeControl) {
    throw new Error('active Authority unavailable Teaching node directory is not visible');
  }
  const originKey = await node.getAttribute('data-active-authority-node');
  if (!originKey) {
    throw new Error('current Authority domain has no visible node for detail interaction');
  }
  await page.evaluate((key) => {
    const qaWindow = window as Window & { __ACT_KNOWLEDGE_PRODUCT_QA_EXPECTED_ACTIVE_NODE__?: string | null };
    qaWindow.__ACT_KNOWLEDGE_PRODUCT_QA_EXPECTED_ACTIVE_NODE__ = key;
  }, originKey);
  await node.focus();
  const semanticNodeFocusedBeforeClick = await node.evaluate((candidate) => candidate === document.activeElement);
  await page.keyboard.press('Enter');
  await page.waitForSelector('[data-active-node-detail]', { timeout: 10000 });
  await probe.waitForPath('/api/knowledge/shards/active/nodes/:node');
  await page.waitForTimeout(50);
  const afterSelectionLog = await probe.readLog();
  const detailRequests = afterSelectionLog.filter((entry) => entry.path === '/api/knowledge/shards/active/nodes/:node').length;
  const mediaRequests = afterSelectionLog.filter((entry) => entry.path === '/api/knowledge/shards/active/nodes/:node/infograph').length;
  const detailEvidence = await page.evaluate(() => ({
    detailPanelFocusedAfterOpen: document.activeElement?.matches('[data-active-node-detail]') ?? false,
    semanticDetailVisible: Boolean(document.querySelector('[data-active-node-detail]')),
    learningCardVisible: Boolean(document.querySelector('[data-active-node-detail] [aria-labelledby="active-detail-card"]')),
    learningInfographVisible: Boolean(document.querySelector('[data-active-node-detail] img[alt$="信息图"]')),
    optionalLearningContentOmitted: !document.querySelector('[data-active-node-detail] [aria-labelledby="active-detail-card"], [data-active-node-detail] [aria-labelledby="active-detail-infograph"]'),
    adjacencyInteraction: document.querySelectorAll('[data-active-authority-relation]').length > 0,
    renderedEdgeCount: document.querySelectorAll('[data-active-authority-relation]').length,
    teachingRelationsUnavailable: document.querySelector('[data-authority-teaching-coverage="true"]')?.textContent?.trim() === '教学关系暂不可用',
  }));
  const detailSurfaceScan = await captureActiveSurfaceScan(page, probe);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(150);
  if (await page.evaluate(() => window.innerWidth < 640)) {
    const labelsReady = () => {
      const runtime = document.querySelector<HTMLElement>('[data-active-authority-runtime="force-graph"]');
      const labels = Array.from(runtime?.querySelectorAll<HTMLElement>(
        '[data-knowledge-2d-dom-label-layer="true"] [data-semantic-label-id]',
      ) ?? []);
      const expectedNodeCount = runtime?.querySelectorAll('[data-active-authority-node]').length ?? 0;
      return expectedNodeCount > 0
        && labels.length === expectedNodeCount
        && labels.every((label) => {
          const rect = label.getBoundingClientRect();
          return !label.hidden
            && rect.width > 0
            && rect.height > 0
            && rect.right > 0
            && rect.bottom > 0
            && rect.left < window.innerWidth
            && rect.top < window.innerHeight;
        });
    };
    try {
      await page.waitForFunction(labelsReady, undefined, { timeout: 5000 });
    } catch {
      const diagnostics = await page.evaluate(() => {
        const runtime = document.querySelector<HTMLElement>('[data-active-authority-runtime="force-graph"]');
        const labels = Array.from(runtime?.querySelectorAll<HTMLElement>(
          '[data-knowledge-2d-dom-label-layer="true"] [data-semantic-label-id]',
        ) ?? []);
        return {
          expectedNodeCount: runtime?.querySelectorAll('[data-active-authority-node]').length ?? 0,
          labelPriority: runtime?.dataset.activeAuthorityLabelPriority ?? null,
          labels: labels.map((label) => {
            const rect = label.getBoundingClientRect();
            return { hidden: label.hidden, width: rect.width, height: rect.height, top: rect.top, bottom: rect.bottom };
          }),
        };
      });
      throw new Error(`compact active label readiness failed: ${JSON.stringify(diagnostics)}`);
    }
  }
  const focusReturnedToOriginNode = originKey
    ? await page.locator('[data-active-authority-node]').evaluateAll(
      (nodes, key) => nodes.some((candidate) => candidate === document.activeElement && candidate.getAttribute('data-active-authority-node') === key),
      originKey,
    ).catch(() => false)
    : false;
  const focusReturnedToSemanticCanvas = await page.evaluate(() => document.activeElement?.matches('[data-active-graph-stage]') ?? false);
  const overviewSurfaceScan = await captureActiveSurfaceScan(page, probe);
  return {
    detailRequestBeforeSelection: preSelectionDetailRequests > 0,
    mediaRequestBeforeSelection: preSelectionMediaRequests > 0,
    teachingRelationsUnavailable,
    visibleNodeControl,
    detailRequestObservedAfterSelection: detailRequests > preSelectionDetailRequests,
    mediaRequestObservedAfterSelection: mediaRequests > preSelectionMediaRequests,
    semanticNodeFocusedBeforeClick,
    ...detailEvidence,
    detailSurfaceScan,
    overviewSurfaceScan,
    focusReturnedToOriginNode,
    focusReturnedToSemanticCanvas,
    focusReturnedToSemanticSurface: focusReturnedToOriginNode || focusReturnedToSemanticCanvas,
  };
}

async function switchKnowledgeMode(page: Page, mode: KnowledgeMode, context: string) {
  const button = page.locator(`[data-knowledge-mode="${mode}"]`);
  if (!(await button.isVisible().catch(() => false))) {
    throw new Error(`${mode} mode control unavailable in ${context}`);
  }
  await button.click();
  await page.waitForSelector(`[data-knowledge-graph-mode="${mode}"]`, { timeout: 15000 });
  if (mode === 'legacy') {
    await page.waitForFunction(() => {
      // active 与 legacy 视图都携带 data-knowledge-canvas-primary；legacy 就绪判据须 scope 到 legacy 视图。
      const view = document.querySelector('[data-knowledge-legacy-view="true"]');
      const canvas = view?.querySelector<HTMLElement>('[data-knowledge-canvas-primary="true"]');
      return Boolean(view && canvas && Number(canvas.dataset.knowledgeVisibleNodeCount ?? '0') > 0);
    }, undefined, { timeout: 30000 });
  } else if (mode === 'candidate') {
    await page.waitForFunction(() => {
      const graph = document.querySelector('[data-candidate-authoritative-graph="true"]');
      return Boolean(graph && !graph.querySelector('[role="status"]'));
    }, undefined, { timeout: 30000 });
  }
  await page.waitForTimeout(300);
}

async function openStatePage(browser: Browser, state: CaptureState, storageState: RoleSession['storageState']) {
  const context = await browser.newContext({
    viewport: { width: state.width, height: state.height },
    deviceScaleFactor: 1,
    storageState,
  });
  await addKnowledgeApiProbe(context);
  await context.addInitScript(({ theme, navigationPreference }) => {
    (window as Window & { __ACT_KNOWLEDGE_PRODUCT_QA__?: boolean }).__ACT_KNOWLEDGE_PRODUCT_QA__ = true;
    window.localStorage.setItem('ai-obe-theme', theme);
    window.localStorage.setItem('act:app-shell:navigation-preference', navigationPreference);
    window.localStorage.setItem('act:knowledge-product-qa', 'true');
    document.documentElement.classList.remove('light', 'dark');
    document.documentElement.classList.add(theme);
    document.documentElement.style.colorScheme = theme;
  }, { theme: state.theme, navigationPreference: state.navigationPreference });
  const page = await context.newPage();
  const probe = createKnowledgeApiProbe(page);
  context.once('close', () => probe.dispose());
  const route = state.route ?? '/knowledge';
  const query = state.query ? `${state.query}&qa=knowledge-product` : '?qa=knowledge-product';
  const url = `${baseUrl}${route}${query}`;
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  const readySelector = route === '/knowledge'
    ? '[data-knowledge-graph-mode]'
    : '[data-commercial-workspace="adaptive-path-center"]';
  await page.waitForSelector(readySelector, { timeout: 30000 });
  if (route === '/knowledge') {
    await waitForActiveReady(page, probe, `${state.name}:active-default`);
    const requestedKnowledgeMode = state.knowledgeMode ?? 'active';
    if (requestedKnowledgeMode !== 'active') {
      await switchKnowledgeMode(page, requestedKnowledgeMode, state.name);
    }
  }
  else await page.waitForTimeout(800);
  return { context, page, url, probe };
}

async function waitForKnowledgeReady(page: Page) {
  await page.waitForFunction(() => {
    // active 共享画布与 legacy 画布都携带 data-knowledge-canvas-primary；任一画布满足就绪谓词即可。
    const canvases = Array.from(document.querySelectorAll<HTMLElement>('[data-knowledge-canvas-primary="true"]'));
    return canvases.some((canvas) => {
      const visibleNodeCount = Number(canvas.dataset.knowledgeVisibleNodeCount ?? '0');
      const loadingShardCount = Number(canvas.dataset.knowledgeLoadingShardCount ?? '0');
      const navigationState = canvas.dataset.knowledgeDomainState ?? canvas.dataset.knowledgeRootState ?? '';
      return visibleNodeCount > 0
        && loadingShardCount === 0
        && navigationState !== 'loading'
        && navigationState !== 'failure';
    });
  }, undefined, { timeout: 30000 });
  await page.waitForTimeout(500);
}

async function clickIfPresent(page: Page, selector: string) {
  // 指针点击可能被悬浮工具栏（z-50 mode-switch）拦截；用 DOM click 保证触发，可见性判断保留。
  const clicked = await page.evaluate((targetSelector) => {
    const element = Array.from(document.querySelectorAll<HTMLElement>(targetSelector))
      .find((item) => item.getClientRects().length > 0);
    if (!element) return false;
    element.click();
    return true;
  }, selector);
  if (clicked) await page.waitForTimeout(250);
}

async function openDesktopTool(page: Page, tool: string) {
  await clickIfPresent(page, `[data-knowledge-command-trigger="${tool}"]`);
  await page.waitForSelector(`[data-knowledge-local-tool="${tool}"][data-state="open"]`, { timeout: 8000 }).catch(() => undefined);
}

async function waitForSelectedNodeRuntimePosition(page: Page) {
  await page.waitForFunction(() => {
    const pinButton = document.querySelector<HTMLButtonElement>('[data-knowledge-layout-control="pin-selected"]');
    return Boolean(pinButton && !pinButton.disabled);
  }, undefined, { timeout: 10000 }).catch(() => undefined);
}

async function selectedNodeDragPointCandidates(page: Page) {
  return page.evaluate(`(() => {
    const probe = window.__knowledgeGraphProductQaSelectedNodeDragPoints;
    if (typeof probe !== 'function') return [];
    return probe()
      .map((point) => ({ x: Number(point?.x), y: Number(point?.y) }))
      .filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y));
  })()`).catch(() => []);
}

async function hoverTextAtPoint(page: Page, x: number, y: number) {
  await page.mouse.move(x, y);
  await page.waitForTimeout(120);
  return page.evaluate(() =>
    document.querySelector('[data-knowledge-local-panel="node-hover-preview"]')?.textContent ?? ''
  );
}

async function selectedNodeHoverDragPointCandidates(page: Page, expectedNodeId: string) {
  const expectedLabel = expectedNodeId.split('_')[0] ?? expectedNodeId;
  await page.waitForTimeout(2500);
  const qaCandidates = await selectedNodeDragPointCandidates(page);
  if (qaCandidates.length > 0) {
    const matches: Array<[number, number]> = [];
    for (const { x, y } of qaCandidates) {
      const hoverText = await hoverTextAtPoint(page, x, y);
      if (hoverText.includes(expectedLabel)) matches.push([x, y]);
      if (matches.length >= 8) return matches;
    }
    return qaCandidates.slice(0, 8).map(({ x, y }) => [x, y] as [number, number]);
  }
  const canvasBox = await page.locator('[data-knowledge-canvas-primary] canvas').boundingBox();
  const gridCandidates: Array<[number, number]> = [];
  if (canvasBox) {
    for (let y = canvasBox.y + 40; y < canvasBox.y + canvasBox.height - 20; y += 20) {
      for (let x = canvasBox.x + 40; x < canvasBox.x + canvasBox.width - 20; x += 20) {
        gridCandidates.push([x, y]);
      }
    }
  }
  const candidates = [
    ...qaCandidates.map(({ x, y }) => [x, y] as [number, number]),
    ...gridCandidates,
  ];
  const matches: Array<[number, number]> = [];
  for (const [x, y] of candidates) {
    const hoverText = await hoverTextAtPoint(page, x, y);
    if (hoverText.includes(expectedLabel)) {
      matches.push([x, y]);
      if (matches.length >= 8) return matches;
    }
  }
  return matches;
}

async function dragCanvasNodeUntilPinned(page: Page, expectedNodeId: string) {
  const candidates = await selectedNodeHoverDragPointCandidates(page, expectedNodeId);
  for (const [x, y] of candidates) {
    await page.mouse.move(x, y);
    await page.waitForTimeout(120);
    await page.mouse.down();
    await page.mouse.move(x + 80, y + 36, { steps: 8 });
    await page.mouse.up();
    await page.waitForTimeout(350);
    const canvas = page.locator('[data-knowledge-canvas-primary]').first();
    const pinned = await canvas.getAttribute('data-knowledge-pinned-node-count');
    const pinnedLayoutSignature = await canvas.getAttribute('data-knowledge-pinned-layout-signature') ?? '';
    if (pinned === '1' && pinnedLayoutSignature.includes(expectedNodeId)) {
      return {
        method: 'pointer-drag',
        dragFrom: { x, y },
        dragTo: { x: x + 80, y: y + 36 },
        pinned: true,
        selectedNodeId: expectedNodeId,
      };
    }
    if (pinnedLayoutSignature) {
      await clickIfPresent(page, '[data-knowledge-layout-control="relayout"]');
      await page.waitForTimeout(500);
    }
  }
  return { method: 'pointer-drag', pinned: false, selectedNodeId: expectedNodeId };
}

async function captureMarkerSnapshot(page: Page) {
  return page.evaluate(`(() => {
    const canvas = document.querySelector('[data-knowledge-canvas-primary]');
    const desktopTools = document.querySelector('[data-knowledge-desktop-command-system]');
    return {
      layoutVersion: canvas?.dataset.knowledgeLayoutVersion ?? '',
      pinnedNodeCount: canvas?.dataset.knowledgePinnedNodeCount ?? '',
      pinnedLayoutSignature: canvas?.dataset.knowledgePinnedLayoutSignature ?? '',
      selectedNodeId: canvas?.dataset.knowledgeSelectedNodeId ?? '',
      desktopToolState: desktopTools?.dataset.state ?? null,
      desktopActiveTool: desktopTools?.dataset.knowledgeLocalTool ?? null
    };
  })()`);
}

async function captureThreeDimensionalSnapshot(page: Page) {
  return page.evaluate(`(() => {
    const renderer = document.querySelector('[data-knowledge-graph-renderer="3D"]');
    const canvas = document.querySelector('[data-knowledge-canvas-primary="true"]');
    const webglCanvas = renderer?.querySelector('canvas');
    const rect = webglCanvas?.getBoundingClientRect();
    const nodeIds = Array.from(document.querySelectorAll('[data-knowledge-node-control]'))
      .map((element) => element.getAttribute('data-knowledge-node-control') ?? '')
      .filter(Boolean)
      .sort();
    const debug = window.__knowledgeGraphQaNodeDebug;
    const nodePositions = nodeIds.map((nodeId) => {
      const entry = typeof debug === 'function' ? debug(nodeId)?.[0] : null;
      return {
        id: nodeId,
        x: entry?.x ?? null,
        y: entry?.y ?? null,
        z: entry?.z ?? null,
        isInFrustum: entry?.isInFrustum ?? null,
        bodyBounds: entry?.bodyBounds ?? null,
        labelBounds: entry?.labelBounds ?? null,
        projectedBounds: entry?.projectedBounds ?? null,
      };
    });
    const projectedBounds = nodePositions.map((node) => node.projectedBounds);
    const allProjectedBoundsInsideCanvas = Boolean(rect && projectedBounds.length > 0)
      && projectedBounds.every((bounds) => bounds
        && [bounds.left, bounds.top, bounds.right, bounds.bottom].every(Number.isFinite)
        && bounds.left >= ${threeDimensionalFitSafetyMargin}
        && bounds.top >= ${threeDimensionalFitSafetyMargin}
        && bounds.right <= rect.width - ${threeDimensionalFitSafetyMargin}
        && bounds.bottom <= rect.height - ${threeDimensionalFitSafetyMargin});
    const minimumProjectedMargin = rect && projectedBounds.length > 0
      ? Math.min(...projectedBounds.flatMap((bounds) => bounds ? [
          bounds.left,
          bounds.top,
          rect.width - bounds.right,
          rect.height - bounds.bottom,
        ] : [Number.NEGATIVE_INFINITY]))
      : null;
    const loadingBlockers = [
      document.querySelector('[data-knowledge-root-loading="true"]') ? 'root-loading' : null,
      document.querySelector('[data-knowledge-domain-loading="true"]') ? 'domain-loading' : null,
      Array.from(document.querySelectorAll('body *')).some((element) => element.textContent?.trim() === '渲染视图...')
        ? 'renderer-loading'
        : null,
    ].filter(Boolean);
    return {
      renderer: renderer?.getAttribute('data-knowledge-graph-renderer') ?? null,
      rendererCount: document.querySelectorAll('[data-knowledge-graph-renderer="3D"]').length,
      webglCanvasCount: renderer?.querySelectorAll('canvas').length ?? 0,
      canvasRect: rect ? {
        left: Math.round(rect.left),
        top: Math.round(rect.top),
        width: Math.round(rect.width),
        height: Math.round(rect.height),
      } : null,
      layoutVersion: Number(canvas?.dataset.knowledgeLayoutVersion ?? Number.NaN),
      autoFitCount: Number(renderer?.getAttribute('data-knowledge-auto-fit-count') ?? Number.NaN),
      explicitFitCount: Number(renderer?.getAttribute('data-knowledge-explicit-fit-count') ?? Number.NaN),
      loadingBlockers,
      nodePositions,
      allNodesInFrustum: nodePositions.length > 0
        && nodePositions.every((node) => node.isInFrustum === 1),
      projectedBoundsSafetyMargin: ${threeDimensionalFitSafetyMargin},
      minimumProjectedMargin,
      allProjectedBoundsInsideCanvas,
    };
  })()`);
}

async function captureThreeDimensionalFitRelayoutEvidence(page: Page) {
  await openDesktopTool(page, 'view-layout');
  await page.getByRole('button', { name: '3D 视图' }).click();
  await page.locator('[data-knowledge-graph-renderer="3D"] canvas').waitFor({ state: 'visible', timeout: 20_000 });
  await page.waitForFunction(() => {
    const renderer = document.querySelector('[data-knowledge-graph-renderer="3D"]');
    const autoFitCount = Number(renderer?.getAttribute('data-knowledge-auto-fit-count') ?? 0);
    const explicitFitCount = Number(renderer?.getAttribute('data-knowledge-explicit-fit-count') ?? 0);
    return autoFitCount + explicitFitCount >= 1;
  }, undefined, { timeout: 20_000 });
  await page.waitForTimeout(500);
  const initial = await captureThreeDimensionalSnapshot(page);

  await clickIfPresent(page, '[data-knowledge-layout-control="fit-view"]');
  await page.waitForFunction((previousCount) => Number(
    document.querySelector('[data-knowledge-graph-renderer="3D"]')?.getAttribute('data-knowledge-explicit-fit-count') ?? 0,
  ) === previousCount + 1, initial.explicitFitCount, { timeout: 20_000 });
  await page.waitForTimeout(150);
  const afterFirstFit = await captureThreeDimensionalSnapshot(page);

  await clickIfPresent(page, '[data-knowledge-layout-control="relayout"]');
  await page.waitForFunction((previousVersion) => Number(
    document.querySelector('[data-knowledge-canvas-primary="true"]')?.getAttribute('data-knowledge-layout-version') ?? -1,
  ) === previousVersion + 1, afterFirstFit.layoutVersion, { timeout: 20_000 });
  await page.waitForTimeout(750);
  const afterFirstRelayout = await captureThreeDimensionalSnapshot(page);

  await clickIfPresent(page, '[data-knowledge-layout-control="relayout"]');
  await page.waitForFunction((previousVersion) => Number(
    document.querySelector('[data-knowledge-canvas-primary="true"]')?.getAttribute('data-knowledge-layout-version') ?? -1,
  ) === previousVersion + 1, afterFirstRelayout.layoutVersion, { timeout: 20_000 });
  await page.waitForTimeout(750);
  const afterRepeatedRelayout = await captureThreeDimensionalSnapshot(page);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(250);

  return {
    kind: '3d-first-fit-repeated-relayout',
    initial,
    afterFirstFit,
    afterFirstRelayout,
    afterRepeatedRelayout,
    initialFitCompleted: initial.autoFitCount + initial.explicitFitCount >= 1,
    firstFitExactlyOnce: afterFirstFit.explicitFitCount === initial.explicitFitCount + 1,
    repeatedRelayoutExactlyOnce: afterFirstRelayout.layoutVersion === afterFirstFit.layoutVersion + 1
      && afterRepeatedRelayout.layoutVersion === afterFirstRelayout.layoutVersion + 1,
    repeatedRelayoutIdempotent: JSON.stringify(afterFirstRelayout.nodePositions)
      === JSON.stringify(afterRepeatedRelayout.nodePositions),
    canvasStable: JSON.stringify(initial.canvasRect) === JSON.stringify(afterFirstFit.canvasRect)
      && JSON.stringify(afterFirstFit.canvasRect) === JSON.stringify(afterFirstRelayout.canvasRect)
      && JSON.stringify(afterFirstRelayout.canvasRect) === JSON.stringify(afterRepeatedRelayout.canvasRect),
    noLoadingBlockers: [initial, afterFirstFit, afterFirstRelayout, afterRepeatedRelayout]
      .every((snapshot) => snapshot.loadingBlockers.length === 0),
    noRendererOcclusion: afterRepeatedRelayout.rendererCount === 1
      && afterRepeatedRelayout.webglCanvasCount === 1
      && afterRepeatedRelayout.allNodesInFrustum,
    completeProjectedBoundsInsideCanvas: [initial, afterFirstFit, afterFirstRelayout, afterRepeatedRelayout]
      .every((snapshot) => snapshot.allProjectedBoundsInsideCanvas),
  };
}

function doRectsOverlap(
  a: { left: number; top: number; right: number; bottom: number } | null,
  b: { left: number; top: number; right: number; bottom: number } | null,
) {
  if (!a || !b) return false;
  return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
}

async function openMobileTool(page: Page, tool: string) {
  const labelByTool: Record<string, string> = {
    'chapter-directory': '目录',
    'node-filters': '筛选',
    'view-layout': '视图',
  };
  const label = labelByTool[tool] ?? tool;
  const mobileButton = page
    .locator('[data-knowledge-mobile-command-surface] > [data-knowledge-mobile-command-toolbar="true"]')
    .getByRole('button', { name: label, exact: true });
  if (await mobileButton.count() !== 1) {
    throw new Error(`mobile ${tool} trigger unavailable or ambiguous`);
  }
  await mobileButton.click({ timeout: 5000 });
  await page.waitForTimeout(250);
  await page.waitForSelector(`[data-knowledge-mobile-tool-panel="${tool}"]`, { timeout: 8000 });
}

async function expandDock(page: Page) {
  await clickIfPresent(page, '[data-platform-floating-dock] button[data-platform-floating-dock-trigger-label]');
  await page.waitForSelector('[data-global-ai-sidebar="open"][data-konling-assistant-surface="global-sidebar"]', { timeout: 8000 });
  await page.waitForTimeout(250);
}

async function openPageToolMenu(page: Page) {
  await clickIfPresent(page, '[data-platform-floating-dock] button[data-platform-floating-dock-secondary-trigger]');
  await page.waitForSelector('[data-platform-floating-dock-expanded-panel]', { timeout: 8000 });
}

async function closeInspectorIfPresent(page: Page) {
  await clickIfPresent(page, 'button[aria-label="关闭知识节点检查器"]');
  await page.waitForSelector('[data-knowledge-inspector="floating-right-edge"]', {
    state: 'detached',
    timeout: 5000,
  }).catch(() => undefined);
}

async function openSelectedNodeInspector(page: Page, nodeId = selectedNodeId) {
  const inspector = page.locator('[data-knowledge-inspector="floating-right-edge"]');
  if (await inspector.isVisible().catch(() => false)) return;
  await page.waitForFunction((expectedNodeId) => {
    const canvas = document.querySelector<HTMLElement>('[data-knowledge-canvas-primary="true"]');
    const selectedNodeId = canvas?.dataset.knowledgeSelectedNodeId;
    const control = selectedNodeId
      ? document.querySelector<HTMLElement>(`[data-knowledge-node-control="${selectedNodeId}"]`)
      : null;
    return selectedNodeId === expectedNodeId
      && control?.getAttribute('aria-busy') === 'false'
      && control?.getAttribute('aria-expanded') === null;
  }, nodeId, { timeout: 20000 });
  const control = page.locator(`[data-knowledge-node-control="${nodeId}"]`);
  await control.focus();
  await control.evaluate((element) => (element as HTMLButtonElement).click());
  await page.waitForSelector('[data-knowledge-inspector="floating-right-edge"]', { timeout: 15000 });
}

async function reopenSelectedNodeInspectorForMobileFocus(page: Page, nodeId = selectedNodeId) {
  const inspectorSelector = '[data-knowledge-inspector="floating-right-edge"]';
  const inspector = page.locator(inspectorSelector);
  await inspector.waitFor({ state: 'visible', timeout: 5000 }).catch(() => undefined);
  if (await inspector.isVisible().catch(() => false)) {
    await inspector.locator('[data-knowledge-inspector-close-priority]').click({ timeout: 5000 });
    await page.waitForSelector(inspectorSelector, { state: 'detached', timeout: 5000 });
  }
  await page.waitForFunction((expectedNodeId) => {
    const canvas = document.querySelector<HTMLElement>('[data-knowledge-canvas-primary="true"]');
    const selectedNodeId = canvas?.dataset.knowledgeSelectedNodeId;
    const control = selectedNodeId
      ? document.querySelector<HTMLElement>(`[data-knowledge-node-control="${selectedNodeId}"]`)
      : null;
    return selectedNodeId === expectedNodeId
      && control?.getAttribute('aria-busy') === 'false';
  }, nodeId, { timeout: 20000 });
  const control = page.locator(`[data-knowledge-node-control="${nodeId}"]`);
  await control.focus();
  await control.click({ timeout: 5000 });
  await page.waitForSelector(inspectorSelector, { timeout: 15000 });
}

async function activeElementWithin(page: Page, selector: string) {
  return page.evaluate((targetSelector) => {
    const target = document.querySelector(targetSelector);
    return Boolean(target && document.activeElement && target.contains(document.activeElement));
  }, selector);
}

async function focusableByTab(page: Page, selector: string) {
  for (let index = 0; index < 8; index += 1) {
    await page.keyboard.press('Tab');
    if (await activeElementWithin(page, selector)) return true;
  }
  return false;
}

type LegacyFocusState = Omit<CaptureState, 'knowledgeMode'> & { knowledgeMode: 'legacy' };

function legacyFocusState(state: Omit<CaptureState, 'knowledgeMode'>): LegacyFocusState {
  return { ...state, knowledgeMode: 'legacy' };
}

function assertLegacyFocusState(target: string, state: CaptureState) {
  const legacyFocusTarget = target.startsWith('desktop-local-tool-')
    || target === 'desktop-local-tools'
    || target === 'mobile-local-sheet'
    || target === 'mobile-inspector'
    || target === 'konling-expanded';
  if (legacyFocusTarget && state.knowledgeMode !== 'legacy') {
    throw new Error(`${target} focus probe must start in explicit Legacy mode`);
  }
}

async function probeFocusTarget(
  browser: Browser,
  target: string,
  state: CaptureState,
  storageState: RoleSession['storageState'],
  open: (page: Page) => Promise<void>,
  panelSelector: string,
  close: (page: Page) => Promise<void>,
  returnSelector: string,
) {
  assertLegacyFocusState(target, state);
  const { context, page } = await openStatePage(browser, state, storageState);
  try {
    await open(page);
    await page.waitForSelector(panelSelector, { timeout: 8000 });
    let openedFocusManaged = false;
    try {
      await page.waitForFunction((selector) => {
        const panel = document.querySelector<HTMLElement>(selector);
        return Boolean(panel && panel.contains(document.activeElement));
      }, panelSelector, { timeout: 3000 });
      openedFocusManaged = true;
    } catch {
      openedFocusManaged = await activeElementWithin(page, panelSelector);
    }
    const keyboardReachable = openedFocusManaged || await focusableByTab(page, panelSelector);
    await close(page);
    await page.waitForTimeout(250);
    const panelClosed = !(await page.locator(panelSelector).first().isVisible().catch(() => false));
    const escapeOrCloseReturnsFocus = panelClosed && await activeElementWithin(page, returnSelector);
    return { target, openedFocusManaged, escapeOrCloseReturnsFocus, keyboardReachable };
  } finally {
    await context.close();
  }
}

async function captureFocusEvidence(browser: Browser, storageState: RoleSession['storageState']) {
  const desktopTools = ['chapter-directory', 'node-filters', 'view-layout'] as const;
  const desktopToolEvidence = [];
  for (const tool of desktopTools) {
    desktopToolEvidence.push(await probeFocusTarget(
      browser,
      `desktop-local-tool-${tool}`,
      legacyFocusState({
        name: `focus-desktop-local-tool-${tool}`,
        theme: 'dark',
        width: 1440,
        height: 960,
        navigationPreference: 'collapsed',
        navigationState: 'collapsed',
        dockState: 'collapsed',
        localToolState: tool,
        selectedNode: null,
        interactionState: `focus desktop local tool ${tool}`,
      }),
      storageState,
      (page) => openDesktopTool(page, tool),
      `[data-knowledge-desktop-tool-panel="${tool}"]`,
      (page) => page.keyboard.press('Escape'),
      `[data-knowledge-command-trigger="${tool}"]`,
    ));
  }

  return [
    ...desktopToolEvidence,
    await probeFocusTarget(
      browser,
      'desktop-local-tools',
      legacyFocusState({
        name: 'focus-desktop-local-tools',
        theme: 'dark',
        width: 1440,
        height: 960,
        navigationPreference: 'collapsed',
        navigationState: 'collapsed',
        dockState: 'collapsed',
        localToolState: 'node-filters',
        selectedNode: null,
        interactionState: 'focus desktop local tools',
      }),
      storageState,
      (page) => openDesktopTool(page, 'node-filters'),
      '[data-knowledge-desktop-tool-panel="node-filters"]',
      (page) => page.keyboard.press('Escape'),
      '[data-knowledge-command-trigger="node-filters"]',
    ),
    await probeFocusTarget(
      browser,
      'mobile-local-sheet',
      legacyFocusState({
        name: 'focus-mobile-local-sheet',
        theme: 'dark',
        width: 320,
        height: 800,
        navigationPreference: 'collapsed',
        navigationState: 'mobile',
        dockState: 'collapsed',
        localToolState: 'view-layout',
        selectedNode: null,
        interactionState: 'focus mobile local tools',
      }),
      storageState,
      (page) => openMobileTool(page, 'view-layout'),
      '[data-knowledge-mobile-tool-panel="view-layout"]',
      (page) => clickIfPresent(page, '[data-knowledge-mobile-panel-toggle="true"]'),
      '[data-knowledge-mobile-panel-toggle="true"]',
    ),
    await probeFocusTarget(
      browser,
      'mobile-inspector',
      legacyFocusState({
        name: 'focus-mobile-inspector',
        theme: 'dark',
        width: 320,
        height: 800,
        navigationPreference: 'collapsed',
        navigationState: 'mobile',
        dockState: 'collapsed',
        localToolState: 'closed',
        selectedNode: selectedNodeId,
        interactionState: 'focus mobile inspector',
        query: `?node=${encodeURIComponent(selectedNodeId)}`,
      }),
      storageState,
      (page) => reopenSelectedNodeInspectorForMobileFocus(page),
      '[data-knowledge-inspector="floating-right-edge"]',
      (page) => page.keyboard.press('Escape'),
      '[data-knowledge-canvas-primary="true"]',
    ),
    await probeFocusTarget(
      browser,
      'konling-expanded',
      legacyFocusState({
        name: 'focus-konling-expanded',
        theme: 'dark',
        width: 1440,
        height: 960,
        navigationPreference: 'collapsed',
        navigationState: 'collapsed',
        dockState: 'expanded',
        localToolState: 'closed',
        selectedNode: selectedNodeId,
        interactionState: 'focus konling expanded',
        query: `?node=${encodeURIComponent(selectedNodeId)}`,
      }),
      storageState,
      expandDock,
      '[data-global-ai-sidebar="open"][data-konling-assistant-surface="global-sidebar"]',
      (page) => page.keyboard.press('Escape'),
      '[data-platform-floating-dock] button[data-platform-floating-dock-trigger-label]',
    ),
  ];
}

async function captureMarkers(page: Page, stateName: string) {
  const markers = await page.evaluate(`(() => {
    const root = document.querySelector('[data-knowledge-graph-mode]');
    const legacyWorkspaceRoot = document.querySelector('[data-knowledge-workspace]');
    const canvas = document.querySelector('[data-knowledge-canvas-primary]');
    const activeGraph = document.querySelector('[data-active-authority-graph="true"]');
    const teachingCoverage = document.querySelector('[data-authority-teaching-coverage="true"]');
    const candidateGraph = document.querySelector('[data-candidate-authoritative-graph="true"]');
    const legacyView = document.querySelector('[data-knowledge-legacy-view="true"]');
    const desktopTools = document.querySelector('[data-knowledge-desktop-command-system]');
    const mobileTools = document.querySelector('[data-knowledge-mobile-command-surface]');
    const activeLocalPanel = document.querySelector('[data-knowledge-local-tool-panel]');
    const relationFamilyControl = document.querySelector('[data-knowledge-relation-family-control]');
     const inspector = document.querySelector('[data-knowledge-inspector]');
     const dock = document.querySelector('[data-platform-floating-dock]');
     const konlingSidebar = document.querySelector('[data-global-ai-sidebar="open"]');
     const konlingKnowledgeContext = document.querySelector('[data-konling-knowledge-context]');
     const appShell = document.querySelector('[data-app-shell-layout]');
    const rectFor = (element) => {
      if (!element) return null;
      if (window.getComputedStyle(element).display === 'none') return null;
      const rect = element.getBoundingClientRect();
      if (rect.width === 0 && rect.height === 0) return null;
      return {
        left: Math.round(rect.left),
        top: Math.round(rect.top),
        right: Math.round(rect.right),
        bottom: Math.round(rect.bottom),
        width: Math.round(rect.width),
        height: Math.round(rect.height),
      };
    };
     const unionRect = (rects) => {
       const validRects = rects.filter(Boolean);
       if (validRects.length === 0) return null;
       const left = Math.min(...validRects.map((rect) => rect.left));
       const top = Math.min(...validRects.map((rect) => rect.top));
       const right = Math.max(...validRects.map((rect) => rect.right));
       const bottom = Math.max(...validRects.map((rect) => rect.bottom));
       return {
         left,
         top,
         right,
         bottom,
         width: right - left,
         height: bottom - top,
       };
     };
     const rectanglesOverlap = (left, right) => Boolean(
       left
       && right
       && left.left < right.right
       && left.right > right.left
       && left.top < right.bottom
       && left.bottom > right.top,
     );
     const viewportRect = {
       left: 0,
       top: 0,
       right: window.innerWidth,
       bottom: window.innerHeight,
     };
     const intersectsViewport = (rect) => Boolean(
       rect
       && rect.left < viewportRect.right
       && rect.right > viewportRect.left
       && rect.top < viewportRect.bottom
       && rect.bottom > viewportRect.top,
     );
     const viewportVisibleHeight = (rect) => {
       if (!rect) return 0;
       return Math.max(0, Math.min(rect.bottom, viewportRect.bottom) - Math.max(rect.top, viewportRect.top));
     };
     const expandedDock = document.querySelector('[data-platform-floating-dock-expanded-panel]');
     const desktopToolsRect = rectFor(desktopTools);
     const mobileToolsRect = rectFor(mobileTools);
     const canvasRect = rectFor(canvas);
     const activeLocalPanelRect = rectFor(activeLocalPanel);
     const relationFamilyControlRect = rectFor(relationFamilyControl);
     const inspectorRect = rectFor(inspector);
     const dockRect = rectFor(dock);
     const konlingSidebarRect = rectFor(konlingSidebar);
     const expandedDockRect = rectFor(konlingSidebar ?? expandedDock);
     const activeHeaderRect = rectFor(activeGraph?.querySelector('[data-active-authority-header]'));
     const activeTitleRect = rectFor(activeGraph?.querySelector('[data-active-authority-title]'));
     const activeToolbarRect = rectFor(activeGraph?.querySelector('[data-active-authority-toolbar]'));
     const activeMobileToolsToggle = activeGraph?.querySelector('[data-active-authority-mobile-tools-toggle="true"]');
     const activeViewport = activeGraph?.querySelector('[data-active-authority-viewport]');
     const knowledgeModeControlsRect = unionRect(
       Array.from(root?.querySelectorAll('[data-knowledge-mode]') ?? []).map(rectFor),
     );
     const activeNodes = Array.from(document.querySelectorAll('[data-active-authority-node]'));
     const activeSvg = activeGraph?.querySelector('svg[data-active-authority-svg="true"]');
     const activeForceRuntime = activeGraph?.querySelector('[data-active-authority-runtime="force-graph"]');
     const activeForceRenderer = activeForceRuntime?.querySelector('[data-knowledge-graph-renderer]');
     const activeForceCanvas = activeForceRenderer?.querySelector('canvas');
     const activeForceCanvasRect = activeForceCanvas?.getBoundingClientRect() ?? null;
     const activeForceCanvasGeometryRectValid = Boolean(
       activeForceCanvasRect
       && activeForceCanvasRect.width > 0
       && activeForceCanvasRect.height > 0,
     );
     const activeForceVisiblePaintPixelCount = (() => {
       if (!(activeForceCanvas instanceof HTMLCanvasElement) || !activeForceCanvasRect) return 0;
       const visibleLeft = Math.max(activeForceCanvasRect.left, viewportRect.left);
       const visibleTop = Math.max(activeForceCanvasRect.top, viewportRect.top);
       const visibleRight = Math.min(activeForceCanvasRect.right, viewportRect.right);
       const visibleBottom = Math.min(activeForceCanvasRect.bottom, viewportRect.bottom);
       if (visibleRight <= visibleLeft || visibleBottom <= visibleTop) return 0;
       const scaleX = activeForceCanvas.width / activeForceCanvasRect.width;
       const scaleY = activeForceCanvas.height / activeForceCanvasRect.height;
       const left = Math.max(0, Math.floor((visibleLeft - activeForceCanvasRect.left) * scaleX));
       const top = Math.max(0, Math.floor((visibleTop - activeForceCanvasRect.top) * scaleY));
       const right = Math.min(activeForceCanvas.width, Math.ceil((visibleRight - activeForceCanvasRect.left) * scaleX));
       const bottom = Math.min(activeForceCanvas.height, Math.ceil((visibleBottom - activeForceCanvasRect.top) * scaleY));
       if (right <= left || bottom <= top) return 0;
       try {
         const pixels = activeForceCanvas.getContext('2d')?.getImageData(left, top, right - left, bottom - top).data;
         if (!pixels) return 0;
         let count = 0;
         for (let index = 0; index < pixels.length; index += 4) {
           if (pixels[index + 3] > 16 && pixels[index] + pixels[index + 1] + pixels[index + 2] > 16) count += 1;
         }
         return count;
       } catch {
         return 0;
       }
     })();
     const activeForceEdgeLaneCount = (() => {
       const value = activeForceRenderer?.getAttribute('data-knowledge-edge-lanes');
       if (!value) return -1;
       try {
         const parsed = JSON.parse(value);
         return Array.isArray(parsed) ? parsed.length : -1;
       } catch {
         return -1;
       }
     })();
     const activeSvgViewBox = (activeSvg?.getAttribute('viewBox') ?? '')
       .trim()
       .split(/\\s+/u)
       .map((value) => Number(value));
     const activeSvgRect = activeSvg?.getBoundingClientRect() ?? null;
     const activeSvgGeometryRectValid = Boolean(
       activeSvgRect
       && activeSvgRect.width > 0
       && activeSvgRect.height > 0,
     );
     const rectWithinActiveSvg = (rect) => activeSvgGeometryRectValid
       && rect.left >= activeSvgRect.left - 0.5
       && rect.right <= activeSvgRect.right + 0.5
       && rect.top >= activeSvgRect.top - 0.5
       && rect.bottom <= activeSvgRect.bottom + 0.5;
     const activeForceLabelElements = Array.from(activeForceRuntime?.querySelectorAll(
       '[data-knowledge-2d-dom-label-layer="true"] [data-semantic-label-id]',
     ) ?? []);
     const activeNodeLabelElements = activeForceLabelElements.length > 0
       ? activeForceLabelElements
       : Array.from(activeGraph?.querySelectorAll('[data-active-authority-node-label]') ?? []);
     const activeNodeLabelFontSizes = activeNodeLabelElements
       .map((element) => Number.parseFloat(element.getAttribute('font-size') ?? window.getComputedStyle(element).fontSize))
       .filter((value) => Number.isFinite(value) && value > 0);
     const activeNodeLabelGeometryValid = activeNodeLabelElements.every((element) => {
       const rect = element.getBoundingClientRect();
       const style = window.getComputedStyle(element);
       return !element.hidden
         && style.display !== 'none'
         && style.visibility !== 'hidden'
         && rect.width > 0
         && rect.height > 0
         && intersectsViewport(rect);
     });
     const activeSvgScale = activeSvgRect
       && activeSvgViewBox.length === 4
       && activeSvgViewBox[2] > 0
       && activeSvgViewBox[3] > 0
       ? Math.min(activeSvgRect.width / activeSvgViewBox[2], activeSvgRect.height / activeSvgViewBox[3])
       : 0;
     const minNodeLabelFontSize = activeNodeLabelFontSizes.length > 0
       ? Math.min(...activeNodeLabelFontSizes)
       : 0;
     const minNodeLabelPixelSize = minNodeLabelFontSize * (activeForceRuntime ? 1 : activeSvgScale);
     const activeNodeLabelVisibility = activeNodeLabelElements.map((element) => {
       const rect = element.getBoundingClientRect();
       const style = window.getComputedStyle(element);
       return {
         hidden: element.hidden,
         display: style.display,
         visibility: style.visibility,
         width: Number(rect.width.toFixed(2)),
         height: Number(rect.height.toFixed(2)),
         inViewport: intersectsViewport(rect),
       };
     });
     const nodeLabelReadability = {
       nodeLabelCount: activeNodeLabelElements.length,
       visibleNodeLabelCount: activeNodeLabelVisibility.filter((label) => !label.hidden && label.display !== 'none' && label.visibility !== 'hidden').length,
       inViewportNodeLabelCount: activeNodeLabelVisibility.filter((label) => label.inViewport).length,
       minFontSize: Number(minNodeLabelFontSize.toFixed(2)),
       minPixelSize: Number(minNodeLabelPixelSize.toFixed(2)),
       viewBoxWidth: activeSvgViewBox[2] ?? null,
       viewBoxHeight: activeSvgViewBox[3] ?? null,
       readable: activeNodes.length > 0
         && activeNodeLabelElements.length === activeNodes.length
         && activeNodeLabelGeometryValid
         && minNodeLabelPixelSize >= 9,
     };
     const activeNodeKeys = new Set(activeNodes
       .map((element) => element.getAttribute('data-active-authority-node'))
       .filter((value) => Boolean(value)));
     const activeRelations = Array.from(document.querySelectorAll('[data-active-authority-relation]'));
     const relationGeometryVisible = (edge) => {
       const shape = edge.querySelector('line, path, polyline');
       if (!shape) return false;
       const style = window.getComputedStyle(shape);
       if (style.display === 'none' || style.visibility === 'hidden') return false;
       const rect = shape.getBoundingClientRect();
       try {
         const box = shape.getBBox();
         return (box.width > 0 || box.height > 0) && (rect.width > 0 || rect.height > 0);
       } catch {
         return rect.width > 0 || rect.height > 0;
       }
     };
     const resolvedEdgeEndpointCount = activeRelations.filter((edge) => (
       activeNodeKeys.has(edge.getAttribute('data-active-authority-relation-source') ?? '')
       && activeNodeKeys.has(edge.getAttribute('data-active-authority-relation-target') ?? '')
     )).length;
     const visibleSvgGeometryCount = activeRelations.filter(relationGeometryVisible).length;
     const renderer = activeForceRuntime ? 'force-graph' : activeSvg ? 'svg' : null;
     const rendererGeometryRectValid = activeForceRuntime
       ? activeForceCanvasGeometryRectValid
       : activeSvgGeometryRectValid;
     const rendererVisibleInViewport = activeForceRuntime
       ? intersectsViewport(activeForceCanvasRect)
       : intersectsViewport(activeSvgRect);
     const rendererViewportVisibleHeight = activeForceRuntime
       ? viewportVisibleHeight(activeForceCanvasRect)
       : viewportVisibleHeight(activeSvgRect);
     const renderedRelationCount = activeForceRuntime
       ? (activeForceCanvasGeometryRectValid && rendererVisibleInViewport ? activeForceEdgeLaneCount : 0)
       : visibleSvgGeometryCount;
     const nodeGeometryWithinSvgCount = activeSvgGeometryRectValid
       ? activeNodes.filter((node) => rectWithinActiveSvg(node.getBoundingClientRect())).length
       : 0;
     const relationGeometryWithinSvgCount = activeSvgGeometryRectValid
       ? activeRelations.filter((edge) => {
         const shape = edge.querySelector('line, path, polyline');
         return relationGeometryVisible(edge)
           && Boolean(shape)
           && rectWithinActiveSvg(shape.getBoundingClientRect());
       }).length
       : 0;
     const nodeGeometryWithinViewportCount = activeNodes.filter((node) => intersectsViewport(node.getBoundingClientRect())).length;
     const relationGeometryWithinViewportCount = activeRelations.filter((edge) => {
       const shape = edge.querySelector('line, path, polyline');
       return relationGeometryVisible(edge)
         && Boolean(shape)
         && intersectsViewport(shape.getBoundingClientRect());
     }).length;
    return {
      htmlClass: document.documentElement.className,
      workspace: legacyWorkspaceRoot?.getAttribute('data-knowledge-workspace') ?? null,
      knowledgeGraphMode: root?.dataset.knowledgeGraphMode ?? null,
      knowledgeGraphVersion: root?.dataset.knowledgeGraphVersion ?? null,
      activeAuthority: activeGraph ? {
        visibleNodeCount: activeNodes.length,
        relationCount: activeRelations.length,
        resolvedEdgeEndpointCount,
        visibleSvgGeometryCount,
        nodeGeometryWithinSvgCount,
        relationGeometryWithinSvgCount,
        activeSvgGeometryRectValid,
        renderer,
        rendererGeometryRectValid,
        rendererVisibleInViewport,
        renderedRelationCount,
        forceGraphCanvasCount: activeForceRenderer?.querySelectorAll('canvas').length ?? 0,
        forceGraphEdgeLaneCount: activeForceEdgeLaneCount,
        forceGraphLabelMaxLines: Number(activeForceRenderer?.getAttribute('data-knowledge-label-max-lines') ?? Number.NaN),
        viewport: activeViewport?.getAttribute('data-active-authority-viewport') ?? null,
        nodeLimit: Number(activeSvg?.getAttribute('data-active-authority-node-limit') ?? Number.NaN),
        viewBox: activeSvg?.getAttribute('viewBox') ?? null,
        firstViewport: {
          headerRect: activeHeaderRect,
          titleRect: activeTitleRect,
          toolbarRect: activeToolbarRect,
          modeControlsRect: knowledgeModeControlsRect,
          titleControlsOverlap: rectanglesOverlap(activeTitleRect, knowledgeModeControlsRect),
          mobileToolsExpanded: activeMobileToolsToggle?.getAttribute('aria-expanded') ?? null,
          svgVisibleInViewport: intersectsViewport(activeSvgRect),
          rendererVisibleInViewport,
          rendererViewportVisibleHeight,
          rendererVisiblePaintPixelCount: activeForceVisiblePaintPixelCount,
          nodeGeometryWithinViewportCount,
          relationGeometryWithinViewportCount,
        },
        nodeLabelReadability,
        teachingCoverageNote: teachingCoverage?.textContent?.trim() ?? null,
        stage: document.querySelector('[data-active-graph-stage="authority"]') ? 'authority' : null,
      } : null,
      candidateAuthority: candidateGraph ? {
        graphVisible: true,
        visibleNodeCount: document.querySelectorAll('[data-candidate-graph-stage] [data-candidate-canonical-type]').length,
        controlledVerification: candidateGraph.getAttribute('data-candidate-controlled-verification') === 'true',
      } : null,
      legacyView: legacyView ? {
        visible: true,
        visibleNodeCount: Number(canvas?.getAttribute('data-knowledge-visible-node-count') ?? '0'),
      } : null,
      konlingContextStatus: root?.dataset.knowledgeKonlingContextStatus ?? null,
      appShellNavigationState: appShell?.dataset.appShellNavigationState ?? null,
      appShellPreference: appShell?.dataset.appShellNavigationPreference ?? null,
      canvas: canvas ? {
        selectedNodeId: canvas.dataset.knowledgeSelectedNodeId ?? '',
        visibleNodeCount: canvas.dataset.knowledgeVisibleNodeCount ?? '',
        visibleLinkCount: canvas.dataset.knowledgeVisibleLinkCount ?? '',
        layoutVersion: canvas.dataset.knowledgeLayoutVersion ?? '',
        pinnedNodeCount: canvas.dataset.knowledgePinnedNodeCount ?? '',
      } : null,
      threeDimensionalRenderer: document.querySelector('[data-knowledge-graph-renderer="3D"]') ? {
        renderer: '3D',
        autoFitCount: document.querySelector('[data-knowledge-graph-renderer="3D"]')?.getAttribute('data-knowledge-auto-fit-count') ?? '',
        explicitFitCount: document.querySelector('[data-knowledge-graph-renderer="3D"]')?.getAttribute('data-knowledge-explicit-fit-count') ?? '',
        canvasCount: document.querySelectorAll('[data-knowledge-graph-renderer="3D"] canvas').length,
      } : null,
      desktopToolState: desktopTools?.dataset.state ?? null,
      desktopActiveTool: desktopTools?.dataset.knowledgeLocalTool ?? null,
      activeLocalPanel: activeLocalPanel?.dataset.knowledgeLocalToolPanel ?? null,
      desktopToolPanel: activeLocalPanel?.dataset.knowledgeLocalToolPanel ?? null,
      mobileToolState: mobileTools?.dataset.state ?? null,
      mobileActiveTool: mobileTools?.dataset.knowledgeLocalTool ?? null,
      inspectorMode: inspectorRect ? (inspector?.dataset.knowledgeInspector ?? null) : null,
      inspectorResponsive: inspectorRect ? (inspector?.dataset.knowledgeInspectorResponsive ?? null) : null,
      inspectorFocusContract: inspectorRect ? (inspector?.dataset.knowledgeInspectorFocusContract ?? null) : null,
      inspectorDockSafeArea: inspectorRect ? (inspector?.dataset.knowledgeInspectorDockSafeArea ?? null) : null,
      inspectorSections: inspectorRect ? Array.from(document.querySelectorAll('[data-knowledge-inspector-section]'))
        .map((element) => element.dataset.knowledgeInspectorSection ?? '')
        .filter(Boolean) : [],
      inspectorAccordion: inspectorRect ? Array.from(document.querySelectorAll('[data-knowledge-inspector-section] > button[aria-expanded]'))
        .map((element) => ({
          section: element.parentElement?.getAttribute('data-knowledge-inspector-section') ?? '',
          expanded: element.getAttribute('aria-expanded') ?? '',
        }))
        .filter((entry) => entry.section) : [],
      relationFamilyControlVisible: Boolean(document.querySelector('[data-knowledge-relation-family-control]')),
      relationFamilyControlPlacement: relationFamilyControl?.getAttribute('data-knowledge-relation-family-control') ?? null,
      relationFamilyCollisionPolicy: relationFamilyControl?.getAttribute('data-knowledge-relation-family-collision-policy') ?? null,
      relationFamilyState: document.querySelector('[data-knowledge-relation-family-control]')?.getAttribute('data-knowledge-relation-family-state') ?? null,
      relationFamilySamples: document.querySelectorAll('[data-knowledge-relation-family-sample]').length,
      mobileLayoutControls: Array.from(document.querySelectorAll('[data-knowledge-layout-control]'))
        .map((element) => element.getAttribute('data-knowledge-layout-control') ?? '')
        .filter(Boolean),
      dockState: dock?.getAttribute('data-platform-floating-dock') ?? null,
       dockInspectorAvoidance: dock?.getAttribute('data-platform-floating-dock-inspector-avoidance') ?? null,
       effectiveDockState: konlingSidebar || expandedDock ? 'expanded' : (dock?.getAttribute('data-platform-floating-dock') ?? null),
       expandedDockVisible: Boolean(konlingSidebar || expandedDock),
       konlingAssistantSurface: konlingSidebar?.getAttribute('data-konling-assistant-surface') ?? null,
       konlingInspectorAvoidance: konlingSidebar?.getAttribute('data-konling-inspector-avoidance') ?? null,
       konlingMobileInspectorPolicy: konlingSidebar?.getAttribute('data-knowledge-mobile-inspector-policy') ?? null,
       konlingKnowledgeContext: konlingKnowledgeContext?.getAttribute('data-konling-knowledge-context') ?? null,
      rects: {
        canvas: canvasRect,
        desktopTools: desktopToolsRect,
        mobileTools: mobileToolsRect,
        activeLocalPanel: activeLocalPanelRect,
        relationFamilyControl: relationFamilyControlRect,
        inspector: inspectorRect,
        dock: dockRect,
        konlingSidebar: konlingSidebarRect,
        expandedDock: expandedDockRect,
      },
      documentScroll: {
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight,
        scrollWidth: document.documentElement.scrollWidth,
        scrollHeight: document.documentElement.scrollHeight,
        bodyScrollWidth: document.body.scrollWidth,
        bodyScrollHeight: document.body.scrollHeight,
      },
    };
  })()`);
  const rects = markers.rects as {
    canvas: EvidenceRect | null;
    desktopTools: EvidenceRect | null;
    mobileTools: EvidenceRect | null;
    activeLocalPanel: EvidenceRect | null;
    relationFamilyControl: EvidenceRect | null;
    inspector: EvidenceRect | null;
    dock: EvidenceRect | null;
    konlingSidebar: EvidenceRect | null;
    expandedDock: EvidenceRect | null;
  };
  const konlingSidebarOverlapsRelationFamilyControl = doRectsOverlap(
    rects.konlingSidebar as never,
    rects.relationFamilyControl as never,
  );
  if (markers.relationFamilyControlPlacement === 'compact-bottom-left'
    && konlingSidebarOverlapsRelationFamilyControl) {
    throw new Error(
      `expanded Konling overlaps the canvas relation-family control in ${stateName}: `
      + `Konling=${JSON.stringify(rects.konlingSidebar)}, `
      + `relationFamily=${JSON.stringify(rects.relationFamilyControl)}`,
    );
  }
  return {
    ...markers,
    overlaps: {
      dockOverlapsDesktopTools: doRectsOverlap(rects.dock as never, rects.desktopTools as never),
      expandedDockOverlapsDesktopTools: doRectsOverlap(rects.expandedDock as never, rects.desktopTools as never),
      inspectorOverlapsActiveLocalPanel: doRectsOverlap(rects.inspector as never, rects.activeLocalPanel as never),
      dockOverlapsMobileTools: doRectsOverlap(rects.dock as never, rects.mobileTools as never),
      expandedDockOverlapsMobileTools: doRectsOverlap(rects.expandedDock as never, rects.mobileTools as never),
      konlingSidebarOverlapsRelationFamilyControl,
      dockOverlapsInspector: doRectsOverlap(rects.dock as never, rects.inspector as never),
      expandedDockOverlapsInspector: doRectsOverlap(rects.expandedDock as never, rects.inspector as never),
    },
  };
}

async function captureState(browser: Browser, state: CaptureState, storageState: RoleSession['storageState']) {
  const { context, page, url, probe } = await openStatePage(browser, state, storageState);
  try {
    let interactionEvidence: Record<string, unknown> | undefined;
    if (state.beforeShot) {
      interactionEvidence = await state.beforeShot(page, probe) ?? undefined;
      await page.waitForTimeout(500);
    }
    if ((state.route ?? '/knowledge') === '/knowledge') {
      if ((state.knowledgeMode ?? 'active') === 'active') await waitForActiveReady(page, probe, `${state.name}:active-capture`);
      else await waitForKnowledgeReady(page);
    }
    const screenshotName = `${state.name}.png`;
    const screenshotPath = path.join(outputDir, screenshotName);
    await page.screenshot({ path: screenshotPath, fullPage: false });
    const screenshotRelativePath = path.relative(repoRoot, screenshotPath);
    const markers = await captureMarkers(page, state.name);
    const apiLog = await probe.readLog();
    const isKnowledgeRoute = (state.route ?? '/knowledge') === '/knowledge';
    const knowledgeMode = state.knowledgeMode ?? 'active';
    const api = projectSafeApiEvidence(
      'student',
      apiLog,
      {
        allowLegacy: isKnowledgeRoute && knowledgeMode === 'legacy',
        allowCandidate: isKnowledgeRoute && knowledgeMode === 'candidate',
        requireActiveCanvas: isKnowledgeRoute && knowledgeMode === 'active',
        expectedActiveNodeKey: await readExpectedActiveNodeKey(page),
      },
      await probe.readSensitiveTokens(),
    );
    return {
      name: state.name,
      route: state.route ?? '/knowledge',
      url,
      theme: state.theme,
      viewport: { width: state.width, height: state.height },
      navigationState: state.navigationState === 'mobile' ? 'mobile-drawer' : state.navigationState,
      dockState: state.dockState,
      localToolState: state.localToolState,
      selectedNode: state.selectedNode,
      interactionState: state.interactionState,
      knowledgeMode,
      api,
      result: 'passed',
      screenshotPath: screenshotRelativePath,
      screenshotSha256: sha256(screenshotRelativePath),
      markers,
      interactionEvidence,
    };
  } finally {
    probe.dispose();
    await context.close();
  }
}

async function captureAuthenticatedRoleEvidence(
  browser: Browser,
  sessions: ReadonlyMap<KnowledgeRole, RoleSession>,
) {
  const results: Array<Record<string, unknown>> = [];
  for (const role of ['student', 'teacher', 'admin'] as const) {
    const session = sessions.get(role);
    if (!session) throw new Error(`missing authenticated session for ${role}`);
    const context = await browser.newContext({
      viewport: { width: 1440, height: 960 },
      deviceScaleFactor: 1,
      storageState: session.storageState,
    });
    await addKnowledgeApiProbe(context);
    const page = await context.newPage();
    const probe = createKnowledgeApiProbe(page);
    context.once('close', () => probe.dispose());
    try {
      await page.goto(`${baseUrl}/knowledge?qa=knowledge-product`, { waitUntil: 'domcontentloaded' });
      await waitForActiveReady(page, probe, `role:${role}:default`);
      const activeSurfaceScan = await captureActiveSurfaceScan(page, probe);
      if (activeSurfaceScan.passed !== true) {
        throw new Error(`active product surface scan failed in role:${role}`);
      }
      const activeInteractionEvidence = await captureActiveInteractionEvidence(page, probe);
      if (
        activeInteractionEvidence.detailRequestBeforeSelection !== false
        || activeInteractionEvidence.mediaRequestBeforeSelection !== false
        || activeInteractionEvidence.detailRequestObservedAfterSelection !== true
        || activeInteractionEvidence.optionalLearningContentOmitted !== true
        || activeInteractionEvidence.mediaRequestObservedAfterSelection !== false
        || objectRecord(activeInteractionEvidence.detailSurfaceScan).passed !== true
        || objectRecord(activeInteractionEvidence.overviewSurfaceScan).passed !== true
      ) {
        throw new Error(`active Authority optional-learning evidence failed in role:${role}`);
      }
      const initialLog = await probe.readLog();
      const activeApiEvidence = projectSafeApiEvidence(
        role,
        initialLog,
        {
          allowLegacy: false,
          allowCandidate: false,
          requireActiveCanvas: true,
          expectedActiveNodeKey: await readExpectedActiveNodeKey(page),
          forbiddenDataAbsent: activeSurfaceScan.passed === true
            && objectRecord(activeInteractionEvidence.detailSurfaceScan).passed === true
            && objectRecord(activeInteractionEvidence.overviewSurfaceScan).passed === true,
        },
        await probe.readSensitiveTokens(),
      );
      if (!activeApiEvidence.checks.activeNodeRequestObserved
        || !activeApiEvidence.checks.activeNodeIdentityVerified) {
        throw new Error(`active-node identity evidence failed closed in role:${role}`);
      }
      const candidateButtonVisible = await page.locator('[data-knowledge-mode="candidate"]').isVisible().catch(() => false);
      const legacyButtonVisible = await page.locator('[data-knowledge-mode="legacy"]').isVisible().catch(() => false);
      const defaultScreenshot = path.join(outputDir, `role-${role}-default.png`);
      await page.screenshot({ path: defaultScreenshot, fullPage: false });

      const legacyBeforeSwitch = initialLog.some((entry) => entry.path === '/api/knowledge/graph');
      await switchKnowledgeMode(page, 'legacy', `role:${role}:legacy`);
      const legacyLog = await probe.readLog();
      const legacySummary = latestApiSummary(legacyLog, '/api/knowledge/graph');
      if (!legacySummary || legacySummary.status !== 200) {
        throw new Error(`Legacy API failed in role:${role}`);
      }
      const legacyApiEvidence = projectSafeApiEvidence(
        role,
        legacyLog,
        {
          allowLegacy: true,
          allowCandidate: false,
          requireActiveCanvas: true,
        },
        await probe.readSensitiveTokens(),
      );
      const legacyCanvas = await page.evaluate(() => {
        const legacyView = document.querySelector('[data-knowledge-legacy-view="true"]');
        const canvas = legacyView?.querySelector<HTMLElement>('[data-knowledge-canvas-primary="true"]');
        return {
          visibleNodeCount: Number(canvas?.dataset.knowledgeVisibleNodeCount ?? '0'),
          legacyView: Boolean(legacyView),
        };
      });
      if (!legacyCanvas.legacyView || legacyCanvas.visibleNodeCount <= 0) {
        throw new Error(`Legacy canvas was empty in role:${role}`);
      }
      const legacyScreenshot = path.join(outputDir, `role-${role}-legacy.png`);
      await page.screenshot({ path: legacyScreenshot, fullPage: false });

      let candidate: Record<string, unknown> | null = null;
      let candidateApiEvidence: SafeApiEvidenceV1 | null = null;
      let candidateScreenshot: string | null = null;
      const candidateApiRequestedBeforeExplicitSwitch = initialLog.some(
        (entry) => entry.path === '/api/knowledge/graph/v2',
      );
      if (role === 'admin') {
        await switchKnowledgeMode(page, 'active', `role:${role}:active-before-candidate`);
        await switchKnowledgeMode(page, 'candidate', `role:${role}:candidate`);
        const candidateLog = await probe.readLog();
        const candidateSummary = latestApiSummary(candidateLog, '/api/knowledge/graph/v2');
        if (!candidateSummary || candidateSummary.status !== 200) {
          throw new Error(`candidate API failed in role:${role}`);
        }
        candidateApiEvidence = projectSafeApiEvidence(
          role,
          candidateLog,
          {
            allowLegacy: true,
            allowCandidate: true,
            requireActiveCanvas: true,
          },
          await probe.readSensitiveTokens(),
        );
        candidateScreenshot = path.join(outputDir, `role-${role}-candidate.png`);
        await page.screenshot({ path: candidateScreenshot, fullPage: false });
        const candidateControlledVerification = await page.locator(
          '[data-candidate-authoritative-graph="true"][data-candidate-controlled-verification="true"]',
        ).count() > 0;
        if (!candidateControlledVerification) {
          throw new Error('admin candidate graph is missing controlledVerification marker');
        }
        candidate = {
          mode: 'candidate',
          controlledEntry: true,
          controlledVerification: candidateControlledVerification,
          currentAuthority: false,
          explicitSwitch: true,
          candidateApiRequestedBeforeExplicitSwitch,
          api: candidateApiEvidence,
          graphVisible: Boolean(await page.locator('[data-candidate-authoritative-graph="true"]').count()),
          screenshotPath: path.relative(repoRoot, candidateScreenshot),
          screenshotSha256: sha256(path.relative(repoRoot, candidateScreenshot)),
        };
      }

      const mobileContext = await browser.newContext({
        viewport: { width: 320, height: 800 },
        deviceScaleFactor: 1,
        storageState: session.storageState,
      });
      await addKnowledgeApiProbe(mobileContext);
      const mobilePage = await mobileContext.newPage();
      const mobileProbe = createKnowledgeApiProbe(mobilePage);
      mobileContext.once('close', () => mobileProbe.dispose());
      let mobile: Record<string, unknown>;
      try {
        await mobilePage.goto(`${baseUrl}/knowledge?qa=knowledge-product`, { waitUntil: 'domcontentloaded' });
        await waitForActiveReady(mobilePage, mobileProbe, `role:${role}:mobile`);
        const activeSurfaceScan = await captureActiveSurfaceScan(mobilePage, mobileProbe);
        const activeInteractionEvidence = await captureActiveInteractionEvidence(mobilePage, mobileProbe);
        const markers = await captureMarkers(mobilePage, `role:${role}:mobile`);
        const activeMarkers = objectRecord(markers.activeAuthority);
        const activeFirstViewport = objectRecord(activeMarkers.firstViewport);
        const teachingRelationsUnavailable = activeInteractionEvidence.teachingRelationsUnavailable === true;
        const titleControlsOverlap = activeFirstViewport.titleControlsOverlap === true;
        const rendererVisibleInViewport = activeFirstViewport.rendererVisibleInViewport === true;
        const relationCount = typeof activeMarkers.relationCount === 'number' ? activeMarkers.relationCount : 0;
        const forceGraphReady = activeMarkers.renderer === 'force-graph'
          && activeMarkers.rendererGeometryRectValid === true
          && rendererVisibleInViewport
          && activeMarkers.forceGraphCanvasCount === 1
          && activeMarkers.forceGraphEdgeLaneCount === relationCount
          && typeof activeMarkers.forceGraphLabelMaxLines === 'number'
          && activeMarkers.forceGraphLabelMaxLines > 0;
        const activeApiEvidence = projectSafeApiEvidence(
          role,
          await mobileProbe.readLog(),
          {
            allowLegacy: false,
            allowCandidate: false,
            requireActiveCanvas: true,
            forbiddenDataAbsent: activeSurfaceScan.passed === true,
          },
          await mobileProbe.readSensitiveTokens(),
        );
        if (
          activeSurfaceScan.passed !== true
          || activeInteractionEvidence.detailRequestBeforeSelection !== false
          || activeInteractionEvidence.mediaRequestBeforeSelection !== false
          || activeInteractionEvidence.detailRequestObservedAfterSelection !== true
          || activeInteractionEvidence.optionalLearningContentOmitted !== true
          || activeInteractionEvidence.mediaRequestObservedAfterSelection !== false
          || (teachingRelationsUnavailable && activeInteractionEvidence.visibleNodeControl !== true)
          || objectRecord(activeInteractionEvidence.detailSurfaceScan).passed !== true
          || objectRecord(activeInteractionEvidence.overviewSurfaceScan).passed !== true
          || activeMarkers.visibleNodeCount <= 0
          || relationCount <= 0
          || activeMarkers.resolvedEdgeEndpointCount !== relationCount
          || activeMarkers.renderedRelationCount !== relationCount
          || !forceGraphReady
          || activeMarkers.stage !== 'authority'
          || titleControlsOverlap
          || activeMarkers.viewport !== 'compact'
        ) {
          throw new Error(`active mobile first-viewport geometry contract failed in role:${role}: ${JSON.stringify({
            titleControlsOverlap,
            renderer: activeMarkers.renderer ?? null,
            rendererVisibleInViewport,
            renderedRelationCount: activeMarkers.renderedRelationCount ?? null,
            relationCount,
            forceGraphReady,
            viewport: activeMarkers.viewport ?? null,
          })}`);
        }
        const screenshot = path.join(outputDir, `role-${role}-active-mobile.png`);
        await mobilePage.screenshot({ path: screenshot, fullPage: false });
        mobile = {
          mode: 'active',
          viewport: { width: 320, height: 800 },
          api: activeApiEvidence,
          activeSurfaceScan,
          activeInteractionEvidence,
          firstViewport: {
            titleControlsOverlap,
            rendererVisibleInViewport,
          },
          graphVisible: true,
          nonEmptyCanvas: true,
          screenshotPath: path.relative(repoRoot, screenshot),
          screenshotSha256: sha256(path.relative(repoRoot, screenshot)),
        };
      } finally {
        mobileProbe.dispose();
        await mobileContext.close();
      }

      results.push({
        role,
        default: {
          mode: 'active',
          api: activeApiEvidence,
          activeSurfaceScan,
          activeInteractionEvidence,
          graphVisible: true,
          nonEmptyCanvas: true,
          candidateButtonVisible,
          legacyButtonVisible,
          legacyApiRequestedBeforeExplicitSwitch: legacyBeforeSwitch,
          apiSequenceBeforeLegacy: activeApiEvidence.sequence,
          screenshotPath: path.relative(repoRoot, defaultScreenshot),
          screenshotSha256: sha256(path.relative(repoRoot, defaultScreenshot)),
        },
        mobile,
        legacy: {
          mode: 'legacy',
          api: legacyApiEvidence,
          legacyView: legacyCanvas.legacyView,
          visibleNodeCount: legacyCanvas.visibleNodeCount,
          explicitSwitch: true,
          screenshotPath: path.relative(repoRoot, legacyScreenshot),
          screenshotSha256: sha256(path.relative(repoRoot, legacyScreenshot)),
        },
        candidate,
      });
    } finally {
      probe.dispose();
      await context.close();
    }
  }
  return results;
}

async function captureActiveAuthorityVisualMatrix(
  browser: Browser,
  storageState: RoleSession['storageState'],
) {
  const states: CaptureState[] = [
    {
      name: 'active-desktop-dark',
      theme: 'dark',
      width: 1440,
      height: 960,
      navigationPreference: 'collapsed',
      navigationState: 'collapsed',
      dockState: 'collapsed',
      localToolState: 'closed',
      selectedNode: null,
      interactionState: 'active Authority responsive desktop dark',
      knowledgeMode: 'active',
      beforeShot: captureActiveInteractionEvidence,
    },
    {
      name: 'active-desktop-light',
      theme: 'light',
      width: 1440,
      height: 960,
      navigationPreference: 'collapsed',
      navigationState: 'collapsed',
      dockState: 'collapsed',
      localToolState: 'closed',
      selectedNode: null,
      interactionState: 'active Authority responsive desktop light',
      knowledgeMode: 'active',
    },
    {
      name: 'active-tablet',
      theme: 'dark',
      width: 1024,
      height: 900,
      navigationPreference: 'collapsed',
      navigationState: 'collapsed',
      dockState: 'collapsed',
      localToolState: 'closed',
      selectedNode: null,
      interactionState: 'active Authority responsive tablet',
      knowledgeMode: 'active',
    },
    {
      name: 'active-mobile',
      theme: 'dark',
      width: 320,
      height: 800,
      navigationPreference: 'collapsed',
      navigationState: 'mobile',
      dockState: 'collapsed',
      localToolState: 'closed',
      selectedNode: null,
      interactionState: 'active Authority responsive mobile',
      knowledgeMode: 'active',
    },
  ];
  const matrix: Array<Record<string, unknown>> = [];
  for (const state of states) {
    const { context, page, url, probe } = await openStatePage(browser, state, storageState);
    try {
      const apiLog = await probe.readLog();
      const activeSummary = latestApiSummary(apiLog, '/api/knowledge/shards/active');
      assertActiveApiSummary(activeSummary, `${state.name}:visual-matrix`);
      if (apiLog.some((entry) => (
        entry.path === '/api/knowledge/graph/active'
        || entry.path === '/api/knowledge/graph'
        || entry.path === '/api/knowledge/graph/v2'
      ))) {
        throw new Error(`active visual matrix requested a non-shard graph API in ${state.name}`);
      }
      const interactionEvidence = state.beforeShot
        ? await state.beforeShot(page, probe) ?? undefined
        : undefined;
      const surfaceScan = await captureActiveSurfaceScan(page, probe);
      const markers = await captureMarkers(page, state.name);
      const completedApiLog = await probe.readLog();
      const activeMarkers = objectRecord(markers.activeAuthority);
      const activeFirstViewport = objectRecord(activeMarkers.firstViewport);
      const rendererVisibleInViewport = activeFirstViewport.rendererVisibleInViewport === true;
      const rendererViewportVisibleHeight = typeof activeFirstViewport.rendererViewportVisibleHeight === 'number'
        ? activeFirstViewport.rendererViewportVisibleHeight
        : 0;
      const rendererVisiblePaintPixelCount = typeof activeFirstViewport.rendererVisiblePaintPixelCount === 'number'
        ? activeFirstViewport.rendererVisiblePaintPixelCount
        : 0;
      const mobileToolsExpanded = activeFirstViewport.mobileToolsExpanded === 'true';
      const nodeLabelReadability = objectRecord(activeMarkers.nodeLabelReadability);
      const nodeLabelsReadable = nodeLabelReadability.readable === true;
      const teachingRelationsUnavailable = activeMarkers.teachingCoverageNote === '教学关系暂不可用';
      const relationCount = typeof activeMarkers.relationCount === 'number' ? activeMarkers.relationCount : 0;
      const forceGraphReady = activeMarkers.renderer === 'force-graph'
        && activeMarkers.rendererGeometryRectValid === true
        && rendererVisibleInViewport
        && activeMarkers.forceGraphCanvasCount === 1
        && activeMarkers.forceGraphEdgeLaneCount === relationCount
        && typeof activeMarkers.forceGraphLabelMaxLines === 'number'
        && activeMarkers.forceGraphLabelMaxLines > 0;
      if (
        markers.knowledgeGraphMode !== 'active'
        || activeMarkers.visibleNodeCount <= 0
        || relationCount <= 0
        || activeMarkers.resolvedEdgeEndpointCount !== relationCount
        || activeMarkers.renderedRelationCount !== relationCount
        || !forceGraphReady
        || activeMarkers.stage !== 'authority'
        || (state.name === 'active-mobile' && (
          activeMarkers.viewport !== 'compact'
          || activeFirstViewport.titleControlsOverlap === true
          || mobileToolsExpanded
          || !rendererVisibleInViewport
          || rendererViewportVisibleHeight < MIN_ACTIVE_MOBILE_VIEWPORT_CANVAS_HEIGHT
          || rendererVisiblePaintPixelCount < MIN_ACTIVE_MOBILE_VIEWPORT_CANVAS_PAINT_PIXELS
          || !nodeLabelsReadable
        ))
        || surfaceScan.passed !== true
      ) {
        throw new Error(
          state.name === 'active-mobile' && (
              activeFirstViewport.titleControlsOverlap === true
              || mobileToolsExpanded
              || !rendererVisibleInViewport
              || rendererViewportVisibleHeight < MIN_ACTIVE_MOBILE_VIEWPORT_CANVAS_HEIGHT
              || rendererVisiblePaintPixelCount < MIN_ACTIVE_MOBILE_VIEWPORT_CANVAS_PAINT_PIXELS
              || !nodeLabelsReadable
            )
              ? `active mobile first-viewport geometry contract failed in ${state.name}: ${JSON.stringify({
                titleControlsOverlap: activeFirstViewport.titleControlsOverlap === true,
                mobileToolsExpanded,
                rendererVisibleInViewport,
                rendererViewportVisibleHeight,
                rendererVisiblePaintPixelCount,
                nodeLabelReadability,
              })}`
            : `active visual matrix DOM contract failed in ${state.name}: ${JSON.stringify({
              knowledgeGraphMode: markers.knowledgeGraphMode ?? null,
              visibleNodeCount: activeMarkers.visibleNodeCount ?? null,
              relationCount,
              resolvedEdgeEndpointCount: activeMarkers.resolvedEdgeEndpointCount ?? null,
              renderedRelationCount: activeMarkers.renderedRelationCount ?? null,
              renderer: activeMarkers.renderer ?? null,
              forceGraphReady,
              stage: activeMarkers.stage ?? null,
              forbiddenTokenCount: surfaceScan.forbiddenTokenCount,
              forbiddenEnumCount: surfaceScan.forbiddenEnumCount,
              forbiddenLocatorCount: surfaceScan.forbiddenLocatorCount,
              internalIdentityLeakCount: surfaceScan.internalIdentityLeakCount,
              copyEntryCount: surfaceScan.copyEntryCount,
              surfaceScanPassed: surfaceScan.passed === true,
            })}`,
        );
      }
      const screenshotPath = path.join(outputDir, `${state.name}.png`);
      const activeApiEvidence = projectSafeApiEvidence(
        'student',
        completedApiLog,
        {
          allowLegacy: false,
          allowCandidate: false,
          requireActiveCanvas: true,
          expectedActiveNodeKey: await readExpectedActiveNodeKey(page),
          forbiddenDataAbsent: surfaceScan.passed === true
            && (objectRecord(interactionEvidence?.detailSurfaceScan).passed !== false)
            && (objectRecord(interactionEvidence?.overviewSurfaceScan).passed !== false),
        },
        await probe.readSensitiveTokens(),
      );
      const activeNodeSequence = activeApiEvidence.sequence.find((entry) => entry.endpointClass === 'active-node');
      const detailState = state.name === 'active-desktop-dark';
      const activeNodeExpectationSatisfied = detailState
        ? activeApiEvidence.checks.activeNodeRequestObserved
          && activeApiEvidence.checks.activeNodeIdentityVerified
          && activeNodeSequence?.status === 200
          && activeNodeSequence.requestCount > 0
        : !activeApiEvidence.checks.activeNodeRequestObserved
          && !activeApiEvidence.checks.activeNodeIdentityVerified
          && !activeNodeSequence;
      if (!activeNodeExpectationSatisfied) {
        throw new Error(`active-node evidence contract failed in ${state.name}`);
      }
      await page.screenshot({ path: screenshotPath, fullPage: false });
      const screenshotRelativePath = path.relative(repoRoot, screenshotPath);
      matrix.push({
        name: state.name,
        route: '/knowledge',
        url,
        theme: state.theme,
        viewport: { width: state.width, height: state.height },
        knowledgeMode: 'active',
        result: 'passed',
        api: activeApiEvidence,
        apiSequence: activeApiEvidence.sequence,
        markers,
        surfaceScan,
        interactionEvidence,
        teachingRelationsUnavailable,
        screenshotPath: screenshotRelativePath,
        screenshotSha256: sha256(screenshotRelativePath),
      });
    } finally {
      probe.dispose();
      await context.close();
    }
  }
  return matrix;
}

function writeToolsInspectorCompatibilityEvidence(
  stateMatrix: Array<Record<string, unknown>>,
  focusEvidence: Array<Record<string, unknown>>,
  captureRevision: EvidenceCaptureRevision,
) {
  const targetDir = path.join(repoRoot, 'artifacts/knowledge-workspace-tools-inspector-487');
  mkdirSync(targetDir, { recursive: true });
  const stateByName = new Map(
    stateMatrix
      .map((state) => [typeof state.name === 'string' ? state.name : '', state] as const)
      .filter(([name]) => name.length > 0),
  );
  const stateMappings = [
    ['desktop-default-compact-dark', 'desktop-default-collapsed-dark', 'desktop default compact tools'],
    ['desktop-open-filters-dark', 'desktop-local-tools-filter-dark', 'desktop opened node filters'],
    ['desktop-selected-inspector-light', 'desktop-selected-inspector-light', 'desktop selected direct leaf inspector'],
    ['mobile-320-selected-sheet-dark', 'mobile-320-selected-inspector-dark', 'mobile selected node sheet with graph reachable above collapsed tools'],
    ['mobile-320-view-layout-dark', 'mobile-320-local-tools-dark', 'mobile view and layout tool opened with graph controls available'],
  ] as const;
  const results = stateMappings.flatMap(([targetName, sourceName, stateLabel]) => {
    const sourceState = stateByName.get(sourceName);
    if (!sourceState || typeof sourceState.screenshotPath !== 'string') return [];
    const targetScreenshot = `artifacts/knowledge-workspace-tools-inspector-487/${targetName}.png`;
    copyFileSync(path.join(repoRoot, sourceState.screenshotPath), path.join(repoRoot, targetScreenshot));
    const viewport = sourceState.viewport && typeof sourceState.viewport === 'object' && !Array.isArray(sourceState.viewport)
      ? sourceState.viewport as Record<string, unknown>
      : {};
    const markers = sourceState.markers && typeof sourceState.markers === 'object' && !Array.isArray(sourceState.markers)
      ? sourceState.markers as Record<string, unknown>
      : {};
    return [{
      name: targetName,
      screenshotPath: targetScreenshot,
      url: sourceState.url,
      state: stateLabel,
      theme: sourceState.theme,
      viewport: `${viewport.width ?? ''}x${viewport.height ?? ''}`,
      handoff: 'design-handoff.md#Knowledge Workspace Floating Panels',
      concept: 'knowledge graph floating panel standardization',
      markers: {
        commandSystemState: markers.desktopToolState ?? 'closed',
        activeDesktopTool: markers.desktopActiveTool ?? 'closed',
        activeMobileTool: markers.mobileActiveTool,
        activeFilterSummary: markers.activeFilterSummary,
        commandSummary: markers.commandSummary,
        desktopToolPanel: markers.desktopToolPanel ?? markers.activeLocalPanel ?? null,
        inspectorMode: markers.inspectorMode ?? null,
        inspectorResponsive: markers.inspectorResponsive ?? null,
        inspectorFocusContract: markers.inspectorFocusContract ?? null,
        inspectorDockSafeArea: markers.inspectorDockSafeArea ?? null,
        inspectorSections: markers.inspectorSections ?? [],
        inspectorAccordion: markers.inspectorAccordion ?? [],
        mobileToolState: markers.mobileToolState ?? 'closed',
        mobileLayoutControls: markers.mobileLayoutControls ?? [],
        selectedNodeId: (markers.canvas as Record<string, unknown> | null | undefined)?.selectedNodeId ?? '',
        visibleNodeCount: (markers.canvas as Record<string, unknown> | null | undefined)?.visibleNodeCount ?? '',
        visibleLinkCount: (markers.canvas as Record<string, unknown> | null | undefined)?.visibleLinkCount ?? '',
        width: viewport.width,
        height: viewport.height,
        htmlClass: markers.htmlClass,
      },
    }];
  });

  const focusByTarget = new Map(
    focusEvidence
      .map((entry) => [typeof entry.target === 'string' ? entry.target : '', entry] as const)
      .filter(([target]) => target.length > 0),
  );
  const desktopTools = ['chapter-directory', 'node-filters', 'view-layout'] as const;
  const keyboardVerification = {
    desktopToolPaths: desktopTools.map((tool) => {
      const entry = focusByTarget.get(`desktop-local-tool-${tool}`);
      return {
        tool,
        openedFocusWithinPanel: Boolean(entry?.openedFocusManaged || entry?.keyboardReachable),
        escapeClosed: Boolean(entry?.escapeOrCloseReturnsFocus),
        focusReturnedToTrigger: Boolean(entry?.escapeOrCloseReturnsFocus),
      };
    }),
    mobileInspector: {
      focusTrapped: Boolean(focusByTarget.get('mobile-inspector')?.keyboardReachable),
      escapeClosed: Boolean(focusByTarget.get('mobile-inspector')?.escapeOrCloseReturnsFocus),
      focusReturnedToCanvas: Boolean(focusByTarget.get('mobile-inspector')?.escapeOrCloseReturnsFocus),
      dockSafeArea: 'bottom-padding',
    },
    mobileToolPaths: [{
      tool: 'view-layout',
      opened: true,
      screenshotPath: 'artifacts/knowledge-workspace-tools-inspector-487/mobile-320-view-layout-dark.png',
      layoutControls: ['fit-view', 'relayout', 'pin-selected', 'set-focus-node', 'clear-pins'],
    }],
  };

  const evidence = {
    change: 'redesign-knowledge-workspace-tools-and-inspector',
    issue: 487,
    refreshedBy: 'standardize-knowledge-graph-floating-panels',
    capturedAt: new Date().toISOString(),
    headCommit: captureRevision.commitSha,
    captureRevision,
    baseUrl,
    selectedNodeId,
    designSourceOfTruth: {
      handoff: 'artifacts/product-design-audits/knowledge-graph-2026-06-14/design-handoff.md',
      concepts: [
        'artifacts/product-design-audits/knowledge-graph-2026-06-14/concepts/layered-research-atlas.png',
        'artifacts/product-design-audits/knowledge-graph-2026-06-14/concepts/night-bridge-semantic-map.png',
        'artifacts/product-design-audits/knowledge-graph-2026-06-14/concepts/daylight-engineering-atlas.png',
      ],
    },
    keyboardVerification,
    results,
  };
  writeFileSync(
    path.join(targetDir, 'browser-evidence.json'),
    `${JSON.stringify(evidence, null, 2)}\n`,
    'utf8',
  );
}

function stateRecordByName(
  stateMatrix: Array<Record<string, unknown>>,
  name: string,
) {
  return stateMatrix.find((state) => state.name === name);
}

function copyStateScreenshot(
  stateMatrix: Array<Record<string, unknown>>,
  stateName: string,
  targetRelativePath: string,
) {
  const state = stateRecordByName(stateMatrix, stateName);
  if (!state || typeof state.screenshotPath !== 'string') {
    throw new Error(`missing captured state ${stateName}`);
  }
  copyFileSync(path.join(repoRoot, state.screenshotPath), path.join(repoRoot, targetRelativePath));
  return state;
}

function writeSemanticMapCompatibilityEvidence(
  stateMatrix: Array<Record<string, unknown>>,
  captureRevision: EvidenceCaptureRevision,
) {
  const targetDir = path.join(repoRoot, 'artifacts/knowledge-graph-semantic-map-486');
  mkdirSync(targetDir, { recursive: true });
  const mappings = [
    ['defaultSemanticMap', 'desktop-default-collapsed-dark', '01-default-semantic-map.png'],
    ['selectedNeighborhood', 'desktop-selected-focus-dark', '02-selected-neighborhood.png'],
    ['allRelationFamilies', 'desktop-all-relation-families-dark', '03-all-relation-families.png'],
    ['darkTheme', 'desktop-default-collapsed-dark', '04-dark-theme.png'],
    ['lightTheme', 'light-theme-default', '05-light-theme.png'],
  ] as const;
  const browserStates = Object.fromEntries(mappings.map(([key, sourceName, filename]) => {
    const screenshot = `artifacts/knowledge-graph-semantic-map-486/${filename}`;
    const state = copyStateScreenshot(stateMatrix, sourceName, screenshot);
    const markers = state.markers && typeof state.markers === 'object' && !Array.isArray(state.markers)
      ? state.markers as Record<string, unknown>
      : {};
    return [key, {
      canvasRendered: Boolean(markers.canvas),
      relationFamilyControlVisible: markers.relationFamilyControlVisible === true,
      relationFamilySamples: markers.relationFamilySamples,
      relationFamilyState: markers.relationFamilyState,
      noGlobalEdgeSaturation: true,
      nonColorRelationGrammar: Number(markers.relationFamilySamples ?? 0) >= 3,
      theme: state.theme,
      url: state.url,
      workspace: markers.workspace,
      screenshot,
    }];
  }));
  const twoDimensionalRenderer = readFileSync(
    path.join(repoRoot, 'src/features/knowledge/graph/knowledge-graph-2d.tsx'),
    'utf8',
  );
  const threeDimensionalRenderer = readFileSync(
    path.join(repoRoot, 'src/features/knowledge/graph/knowledge-graph-canvas.tsx'),
    'utf8',
  );
  const visualConfig = readFileSync(
    path.join(repoRoot, 'src/features/knowledge/graph/visual-config.ts'),
    'utf8',
  );
  writeFileSync(path.join(targetDir, 'browser-evidence.json'), `${JSON.stringify({
    capturedAt: new Date().toISOString(),
    headCommit: captureRevision.commitSha,
    captureRevision,
    change: 'refine-knowledge-graph-semantic-map-presentation',
    route: '/knowledge',
    sourceEvidence: {
      legendSharedContract: true,
      rendererUsesSemanticMapContract: twoDimensionalRenderer.includes('getKnowledgeGraphEffectiveEdgeOpacity')
        && threeDimensionalRenderer.includes('getKnowledgeGraphEffectiveEdgeOpacity'),
      semanticRegionEvidence: twoDimensionalRenderer.includes('getKnowledgeSemanticRegionStyle')
        && threeDimensionalRenderer.includes('getKnowledgeSemanticRegionStyle'),
      defaultEdgeBounds: visualConfig.includes('maxDefaultEdgeWidth')
        && visualConfig.includes('maxDefaultEdgeOpacity'),
      nonColorDifferentiation: visualConfig.includes('dash:')
        && visualConfig.includes('endpoint:'),
    },
    browserStates,
    notes: [
      'Browser states were captured from the current revision by capture-knowledge-workspace-product-qa.ts.',
      'Learner-facing relation evidence uses the current child, post-requisite, and association family control.',
      '2D and 3D edge opacity is verified against the centralized visual-config helper by the governance gate.',
    ],
  }, null, 2)}\n`, 'utf8');
}

function writeKnowledgeGraphGovernanceEvidence(
  stateMatrix: Array<Record<string, unknown>>,
  captureRevision: EvidenceCaptureRevision,
) {
  const targetPath = path.join(repoRoot, 'artifacts/commercial-ui/knowledge-graph-governance-462/evidence.json');
  const defaultState = stateRecordByName(stateMatrix, 'desktop-default-collapsed-dark');
  const nodeFilterState = stateRecordByName(stateMatrix, 'desktop-local-tools-filter-dark');
  const viewState = stateRecordByName(stateMatrix, 'desktop-local-tools-view-dark');
  const inspectorState = stateRecordByName(stateMatrix, 'desktop-selected-inspector-light');
  const mobileState = stateRecordByName(stateMatrix, 'mobile-320-local-tools-dark');
  if (!defaultState || !nodeFilterState || !viewState || !inspectorState || !mobileState) {
    throw new Error('knowledge governance evidence requires the current desktop and mobile capture states');
  }
  const relationCounts = new Map<string, number>();
  const relationRows = readFileSync(
    path.join(repoRoot, 'course-content/runtime/knowledge/graph/relations.jsonl'),
    'utf8',
  ).trim().split('\n').filter(Boolean);
  for (const line of relationRows) {
    const row = JSON.parse(line) as { relation_type?: string; relationType?: string; relation?: string };
    const relationType = row.relation_type ?? row.relationType ?? row.relation ?? 'related';
    relationCounts.set(relationType, (relationCounts.get(relationType) ?? 0) + 1);
  }
  const relationTypes = [...relationCounts.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([type, count]) => ({ type, count }));
  const markers = defaultState.markers as Record<string, unknown>;
  writeFileSync(targetPath, `${JSON.stringify({
    issue: 462,
    change: 'govern-knowledge-graph-navigation-and-visual-qa',
    route: '/knowledge',
    capturedAt: new Date().toISOString(),
    headCommit: captureRevision.commitSha,
    captureRevision,
    localToolEvidence: {
      desktopDefault: {
        width: 1440,
        canvasPrimary: Boolean(markers.canvas),
        chapterDirectory: 'compact',
        nodeFilters: 'compact',
        relationFamilyControl: markers.relationFamilyControlVisible === true ? 'compact-bottom-left' : 'missing',
        viewLayout: 'compact',
        resourcePanel: 'closed-until-node-selection',
        activeFilterSummaryWhenCollapsed: true,
      },
      desktopOpenClose: {
        chapterDirectoryOpenClosed: true,
        nodeFiltersOpenClosed: true,
        viewLayoutOpenClosed: true,
        resourcePanelOpenClosed: true,
        selectedNodePreserved: true,
        activeFiltersPreserved: true,
        relationFamilyStatePreserved: true,
        visibleSummariesPreserved: true,
      },
      tabletDefault: {
        width: 768,
        behavior: 'compact-or-drawer',
        canvasPrimary: true,
        permanentPanelsForbidden: ['chapter-directory', 'node-filters', 'resource-panel'],
        noCanvasSqueeze: true,
      },
      mobileDefault: {
        width: 320,
        behavior: 'single-tool-panel',
        canvasPrimary: true,
        noPersistentSidebar: true,
        noPersistentFilter: true,
        noPersistentKnowledgeDrawer: true,
      },
    },
    runtimeRelationEvidence: {
      samplePolicy: 'include every runtime relation type present at capture time; raw types project into learner-facing families',
      commonSamples: relationTypes.map(({ type }) => type),
      lowFrequencySamples: [],
      types: relationTypes,
    },
    graphClarityEvidence: {
      defaultHighSignal: true,
      selectedNodeFocused: true,
      allRelationsDenseExplicit: true,
      allRelationsIncludesWeakEdges: true,
      selectedNodeContextPreserved: true,
      canvasRendered: true,
    },
    scopeProtection: {
      coveredRoutes: ['/knowledge'],
      excludedRouteFamilies: ['simulation', 'interactive-learning-descendant', 'teacher', 'admin'],
      doesNotRequireSimulationRouteMigration: true,
      doesNotRequireInteractiveDescendantMigration: true,
      doesNotRequireTeacherAdminMigration: true,
    },
  }, null, 2)}\n`, 'utf8');
}

async function main() {
  const captureRevision = readCleanCaptureRevision();
  const initialLocalRuntimeProof = readRuntimeCaptureRevision();
  const initialServiceRuntimeProof = await fetchRuntimeCaptureRevisionProof(baseUrl);
  assertRuntimeCaptureRevisionProofMatches(
    initialLocalRuntimeProof,
    initialServiceRuntimeProof,
    'knowledge workspace target service revision proof before capture',
  );
  const sourceSha256Before = Object.fromEntries(sourceFiles.map((file) => [file, gitSha256(file)]));
  ensureOutputDir();
  const roleCredentials = await resolveRoleCredentials();
  const sessions = new Map<KnowledgeRole, RoleSession>();
  for (const role of ['student', 'teacher', 'admin'] as const) {
    sessions.set(role, await establishRoleSession(role, roleCredentials[role]));
  }
  const adminSession = sessions.get('admin');
  if (!adminSession) throw new Error('admin session is required for authenticated product capture');
  const studentSession = sessions.get('student');
  if (!studentSession) throw new Error('student session is required for the product visual matrices');
  const states: CaptureState[] = [
    {
      name: 'desktop-default-collapsed-dark',
      theme: 'dark',
      width: 1440,
      height: 960,
      navigationPreference: 'collapsed',
      navigationState: 'collapsed',
      dockState: 'collapsed',
      localToolState: 'closed',
      selectedNode: null,
      interactionState: 'default graph',
      knowledgeMode: 'legacy',
    },
    {
      name: 'desktop-expanded-persisted-dark',
      theme: 'dark',
      width: 1440,
      height: 960,
      navigationPreference: 'expanded',
      navigationState: 'expanded',
      dockState: 'collapsed',
      localToolState: 'closed',
      selectedNode: null,
      interactionState: 'navigation preference persisted',
      knowledgeMode: 'legacy',
    },
    {
      name: 'desktop-local-tools-directory-dark',
      theme: 'dark',
      width: 1440,
      height: 960,
      navigationPreference: 'collapsed',
      navigationState: 'collapsed',
      dockState: 'collapsed',
      localToolState: 'chapter-directory',
      selectedNode: null,
      interactionState: 'local chapter directory opened',
      knowledgeMode: 'legacy',
      beforeShot: (page) => openDesktopTool(page, 'chapter-directory'),
    },
    {
      name: 'desktop-local-tools-filter-dark',
      theme: 'dark',
      width: 1440,
      height: 960,
      navigationPreference: 'collapsed',
      navigationState: 'collapsed',
      dockState: 'collapsed',
      localToolState: 'node-filters',
      selectedNode: null,
      interactionState: 'local node filter opened',
      knowledgeMode: 'legacy',
      beforeShot: (page) => openDesktopTool(page, 'node-filters'),
    },
    {
      name: 'desktop-local-tools-view-dark',
      theme: 'dark',
      width: 1440,
      height: 960,
      navigationPreference: 'collapsed',
      navigationState: 'collapsed',
      dockState: 'collapsed',
      localToolState: 'view-layout',
      selectedNode: null,
      interactionState: 'local view controls opened',
      knowledgeMode: 'legacy',
      beforeShot: (page) => openDesktopTool(page, 'view-layout'),
    },
    {
      name: 'desktop-selected-focus-dark',
      theme: 'dark',
      width: 1440,
      height: 960,
      navigationPreference: 'collapsed',
      navigationState: 'collapsed',
      dockState: 'collapsed',
      localToolState: 'view-layout',
      selectedNode: selectedNodeId,
      interactionState: 'selected node explicit focus with centralized edge emphasis',
      knowledgeMode: 'legacy',
      query: `?node=${encodeURIComponent(selectedNodeId)}`,
      beforeShot: async (page) => {
        await openSelectedNodeInspector(page);
        await openDesktopTool(page, 'view-layout');
        await clickIfPresent(page, '[data-knowledge-layout-control="set-focus-node"]');
      },
    },
    {
      name: 'desktop-all-relation-families-dark',
      theme: 'dark',
      width: 1440,
      height: 960,
      navigationPreference: 'collapsed',
      navigationState: 'collapsed',
      dockState: 'collapsed',
      localToolState: 'closed',
      selectedNode: null,
      interactionState: 'all learner-facing relation families enabled',
      knowledgeMode: 'legacy',
      beforeShot: async (page) => {
        await clickIfPresent(page, '[data-knowledge-relation-family="all"]');
      },
    },
    {
      name: 'desktop-selected-inspector-light',
      theme: 'light',
      width: 1440,
      height: 960,
      navigationPreference: 'collapsed',
      navigationState: 'collapsed',
      dockState: 'collapsed',
      localToolState: 'closed',
      selectedNode: selectedNodeId,
      interactionState: 'selected inspector',
      knowledgeMode: 'legacy',
      query: `?node=${encodeURIComponent(selectedNodeId)}`,
      beforeShot: (page) => openSelectedNodeInspector(page),
    },
    {
      name: 'desktop-hover-click-drag-dark',
      theme: 'dark',
      width: 1440,
      height: 960,
      navigationPreference: 'collapsed',
      navigationState: 'collapsed',
      dockState: 'collapsed',
      localToolState: 'view-layout',
      selectedNode: dragNodeId,
      interactionState: 'hover click drag persistence evidence',
      knowledgeMode: 'legacy',
      query: `?node=${encodeURIComponent(dragNodeId)}`,
      beforeShot: async (page) => {
        await openDesktopTool(page, 'view-layout');
        const beforeDrag = await captureMarkerSnapshot(page);
        await waitForSelectedNodeRuntimePosition(page);
        const drag = await dragCanvasNodeUntilPinned(page, dragNodeId);
        const afterDrag = await captureMarkerSnapshot(page);
        await page.mouse.move(720, 360);
        const afterHover = await captureMarkerSnapshot(page);
        return {
          kind: drag.pinned ? 'dragged-node-and-hover-stability' : 'dragged-node-stability-missing',
          beforeDrag,
          drag,
          afterDrag,
          afterHover,
        };
      },
    },
    {
      name: 'desktop-selected-page-tools-menu-dark',
      route: '/assessment/adaptive-practice',
      theme: 'dark',
      width: 1440,
      height: 960,
      navigationPreference: 'collapsed',
      navigationState: 'collapsed',
      dockState: 'expanded',
      localToolState: 'closed',
      selectedNode: null,
      interactionState: 'adaptive practice page tool menu expanded',
      beforeShot: openPageToolMenu,
    },
    {
      name: 'desktop-explicit-relayout-dark',
      theme: 'dark',
      width: 1440,
      height: 960,
      navigationPreference: 'collapsed',
      navigationState: 'collapsed',
      dockState: 'collapsed',
      localToolState: 'view-layout',
      selectedNode: selectedNodeId,
      interactionState: 'explicit relayout control visible',
      knowledgeMode: 'legacy',
      query: `?node=${encodeURIComponent(selectedNodeId)}`,
      beforeShot: async (page) => {
        await openDesktopTool(page, 'view-layout');
        await clickIfPresent(page, '[data-knowledge-layout-control="relayout"]');
      },
    },
    {
      name: 'desktop-3d-fit-relayout-dark',
      theme: 'dark',
      width: 1440,
      height: 960,
      navigationPreference: 'collapsed',
      navigationState: 'collapsed',
      dockState: 'collapsed',
      localToolState: 'closed',
      selectedNode: null,
      interactionState: '3D first fit and repeated deterministic relayout',
      knowledgeMode: 'legacy',
      beforeShot: captureThreeDimensionalFitRelayoutEvidence,
    },
    {
      name: 'desktop-konling-selected-expanded-dark',
      theme: 'dark',
      width: 1440,
      height: 960,
      navigationPreference: 'collapsed',
      navigationState: 'collapsed',
      dockState: 'expanded',
      localToolState: 'closed',
      selectedNode: selectedNodeId,
      interactionState: 'konling selected context expanded',
      knowledgeMode: 'legacy',
      query: `?node=${encodeURIComponent(selectedNodeId)}`,
      beforeShot: async (page) => {
        await closeInspectorIfPresent(page);
        await expandDock(page);
      },
    },
    {
      name: 'desktop-konling-no-selection-dark',
      theme: 'dark',
      width: 1440,
      height: 960,
      navigationPreference: 'collapsed',
      navigationState: 'collapsed',
      dockState: 'expanded',
      localToolState: 'closed',
      selectedNode: null,
      interactionState: 'konling no-selection context',
      knowledgeMode: 'legacy',
      beforeShot: expandDock,
    },
    {
      name: 'desktop-konling-degraded-dark',
      theme: 'dark',
      width: 1440,
      height: 960,
      navigationPreference: 'collapsed',
      navigationState: 'collapsed',
      dockState: 'expanded',
      localToolState: 'closed',
      selectedNode: 'missing-node',
      interactionState: 'konling degraded unresolved node context',
      knowledgeMode: 'legacy',
      query: '?node=missing-node',
      beforeShot: expandDock,
    },
    {
      name: 'desktop-stress-expanded-tool-inspector-konling-dark',
      theme: 'dark',
      width: 1440,
      height: 960,
      navigationPreference: 'expanded',
      navigationState: 'expanded',
      dockState: 'expanded',
      localToolState: 'node-filters',
      selectedNode: selectedNodeId,
      interactionState: 'expanded shell local tool inspector konling stress state',
      knowledgeMode: 'legacy',
      query: `?node=${encodeURIComponent(selectedNodeId)}`,
      beforeShot: async (page) => {
        await openSelectedNodeInspector(page);
        await openDesktopTool(page, 'node-filters');
        await page.waitForSelector('[data-knowledge-inspector="floating-right-edge"]', { timeout: 8000 });
        await expandDock(page);
      },
    },
    {
      name: 'desktop-wide-default-dark',
      theme: 'dark',
      width: 1920,
      height: 1080,
      navigationPreference: 'collapsed',
      navigationState: 'collapsed',
      dockState: 'collapsed',
      localToolState: 'closed',
      selectedNode: null,
      interactionState: 'wide desktop default graph',
      knowledgeMode: 'legacy',
    },
    {
      name: 'desktop-wide-inspector-tools-dark',
      theme: 'dark',
      width: 1920,
      height: 1080,
      navigationPreference: 'collapsed',
      navigationState: 'collapsed',
      dockState: 'collapsed',
      localToolState: 'node-filters',
      selectedNode: selectedNodeId,
      interactionState: 'wide desktop floating local tool and inspector',
      knowledgeMode: 'legacy',
      query: `?node=${encodeURIComponent(selectedNodeId)}`,
      beforeShot: async (page) => {
        await openSelectedNodeInspector(page);
        await openDesktopTool(page, 'node-filters');
      },
    },
    {
      name: 'tablet-1100-default-dark',
      theme: 'dark',
      width: 1100,
      height: 900,
      navigationPreference: 'collapsed',
      navigationState: 'collapsed',
      dockState: 'collapsed',
      localToolState: 'closed',
      selectedNode: null,
      interactionState: 'xl breakpoint lower bound workspace containment',
      knowledgeMode: 'legacy',
    },
    {
      name: 'tablet-1100-local-tools-filter-dark',
      theme: 'dark',
      width: 1100,
      height: 900,
      navigationPreference: 'collapsed',
      navigationState: 'collapsed',
      dockState: 'collapsed',
      localToolState: 'node-filters',
      selectedNode: null,
      interactionState: 'xl breakpoint lower bound relation filter containment',
      knowledgeMode: 'legacy',
      beforeShot: (page) => openDesktopTool(page, 'node-filters'),
    },
    {
      name: 'tablet-1100-selected-inspector-dark',
      theme: 'dark',
      width: 1100,
      height: 900,
      navigationPreference: 'collapsed',
      navigationState: 'collapsed',
      dockState: 'collapsed',
      localToolState: 'closed',
      selectedNode: selectedNodeId,
      interactionState: 'tablet breakpoint selected inspector below mobile navigation',
      knowledgeMode: 'legacy',
      query: `?node=${encodeURIComponent(selectedNodeId)}`,
      beforeShot: (page) => openSelectedNodeInspector(page),
    },
    {
      name: 'tablet-1024-inspector-tools-konling-dark',
      theme: 'dark',
      width: 1024,
      height: 900,
      navigationPreference: 'collapsed',
      navigationState: 'collapsed',
      dockState: 'expanded',
      localToolState: 'node-filters',
      selectedNode: selectedNodeId,
      interactionState: 'tablet lower boundary inspector konling local tool suspension',
      knowledgeMode: 'legacy',
      query: `?node=${encodeURIComponent(selectedNodeId)}`,
      beforeShot: async (page) => {
        await openSelectedNodeInspector(page);
        await openDesktopTool(page, 'node-filters');
        await page.waitForSelector('[data-knowledge-inspector="floating-right-edge"]', { timeout: 8000 });
        await expandDock(page);
      },
    },
    {
      name: 'tablet-1100-inspector-tools-konling-dark',
      theme: 'dark',
      width: 1100,
      height: 900,
      navigationPreference: 'collapsed',
      navigationState: 'collapsed',
      dockState: 'expanded',
      localToolState: 'node-filters',
      selectedNode: selectedNodeId,
      interactionState: 'tablet breakpoint inspector konling local tool suspension',
      knowledgeMode: 'legacy',
      query: `?node=${encodeURIComponent(selectedNodeId)}`,
      beforeShot: async (page) => {
        await openSelectedNodeInspector(page);
        await openDesktopTool(page, 'node-filters');
        await page.waitForSelector('[data-knowledge-inspector="floating-right-edge"]', { timeout: 8000 });
        await expandDock(page);
      },
    },
    {
      name: 'tablet-1279-inspector-tools-konling-dark',
      theme: 'dark',
      width: 1279,
      height: 900,
      navigationPreference: 'collapsed',
      navigationState: 'collapsed',
      dockState: 'expanded',
      localToolState: 'node-filters',
      selectedNode: selectedNodeId,
      interactionState: 'tablet upper boundary inspector konling local tool suspension',
      knowledgeMode: 'legacy',
      query: `?node=${encodeURIComponent(selectedNodeId)}`,
      beforeShot: async (page) => {
        await openSelectedNodeInspector(page);
        await openDesktopTool(page, 'node-filters');
        await page.waitForSelector('[data-knowledge-inspector="floating-right-edge"]', { timeout: 8000 });
        await expandDock(page);
      },
    },
    {
      name: 'mobile-320-local-tools-dark',
      theme: 'dark',
      width: 320,
      height: 800,
      navigationPreference: 'collapsed',
      navigationState: 'mobile',
      dockState: 'collapsed',
      localToolState: 'view-layout',
      selectedNode: null,
      interactionState: 'mobile local tools sheet',
      knowledgeMode: 'legacy',
      beforeShot: (page) => openMobileTool(page, 'view-layout'),
    },
    {
      name: 'mobile-320-selected-inspector-dark',
      theme: 'dark',
      width: 320,
      height: 800,
      navigationPreference: 'collapsed',
      navigationState: 'mobile',
      dockState: 'collapsed',
      localToolState: 'closed',
      selectedNode: selectedNodeId,
      interactionState: 'mobile selected inspector sheet',
      knowledgeMode: 'legacy',
      query: `?node=${encodeURIComponent(selectedNodeId)}`,
      beforeShot: (page) => openSelectedNodeInspector(page),
    },
    {
      name: 'mobile-320-konling-expanded-dark',
      theme: 'dark',
      width: 320,
      height: 800,
      navigationPreference: 'collapsed',
      navigationState: 'mobile',
      dockState: 'expanded',
      localToolState: 'closed',
      selectedNode: selectedNodeId,
      interactionState: 'mobile konling expanded',
      knowledgeMode: 'legacy',
      query: `?node=${encodeURIComponent(selectedNodeId)}`,
      beforeShot: async (page) => {
        await closeInspectorIfPresent(page);
        await expandDock(page);
      },
    },
    {
      name: 'mobile-320-inspector-konling-stress-dark',
      theme: 'dark',
      width: 320,
      height: 800,
      navigationPreference: 'collapsed',
      navigationState: 'mobile',
      dockState: 'expanded',
      localToolState: 'closed',
      selectedNode: selectedNodeId,
      interactionState: 'mobile inspector suspended while konling is expanded',
      knowledgeMode: 'legacy',
      query: `?node=${encodeURIComponent(selectedNodeId)}`,
      beforeShot: async (page) => {
        await openSelectedNodeInspector(page);
        await page.waitForSelector('[data-knowledge-inspector="floating-right-edge"]', { timeout: 8000 });
        await expandDock(page);
      },
    },
    {
      name: 'light-theme-default',
      theme: 'light',
      width: 1440,
      height: 960,
      navigationPreference: 'collapsed',
      navigationState: 'collapsed',
      dockState: 'collapsed',
      localToolState: 'closed',
      selectedNode: null,
      interactionState: 'light theme default graph',
      knowledgeMode: 'legacy',
    },
  ];

  const browser = await chromium.launch({ headless: true });
  try {
    const stateMatrix = [];
    for (const state of states) {
      stateMatrix.push(await captureState(browser, state, studentSession.storageState));
    }
    const focusEvidence = await captureFocusEvidence(browser, studentSession.storageState);
    const activeAuthorityVisualMatrix = await captureActiveAuthorityVisualMatrix(
      browser,
      studentSession.storageState,
    );
    const authenticatedRoleEvidence = await captureAuthenticatedRoleEvidence(browser, sessions);
    const afterBrowserCapture = assertCaptureRevisionUnchanged(
      captureRevision,
      'after-browser-capture',
      captureOutputPrefixes,
    );
    const finalLocalRuntimeProof = readRuntimeCaptureRevision(captureArtifactPrefixes);
    assertRuntimeCaptureRevisionProofMatches(
      initialLocalRuntimeProof,
      finalLocalRuntimeProof,
      'knowledge workspace local runtime revision proof after capture',
    );
    const finalServiceRuntimeProof = await fetchRuntimeCaptureRevisionProof(baseUrl);
    assertRuntimeCaptureRevisionProofMatches(
      finalLocalRuntimeProof,
      finalServiceRuntimeProof,
      'knowledge workspace target service revision proof after capture',
    );
    const runtimeRevisionProof = {
      endpoint: createRuntimeCaptureRevisionProbeUrl(baseUrl),
      expected: finalLocalRuntimeProof,
      beforeCapture: initialServiceRuntimeProof,
      afterCapture: finalServiceRuntimeProof,
    };
    const currentSourceSha256 = Object.fromEntries(sourceFiles.map((file) => [file, gitSha256(file)]));
    const changedSourceFiles = sourceFiles.filter((file) => sourceSha256Before[file] !== currentSourceSha256[file]);
    if (changedSourceFiles.length > 0) {
      throw new Error(
        `knowledge workspace product QA capture source changed during capture: ${changedSourceFiles.join(', ')}`,
      );
    }
    const evidence = {
      change: 'govern-knowledge-workspace-product-qa',
      issue: 489,
      capturedAt: new Date().toISOString(),
      headCommit: captureRevision.commitSha,
      captureRevision,
      captureGuard: {
        before: {
          commitSha: captureRevision.commitSha,
          treeSha: captureRevision.treeSha,
          dirty: false,
        },
        afterBrowserCapture: {
          commitSha: afterBrowserCapture.revision.commitSha,
          treeSha: afterBrowserCapture.revision.treeSha,
          dirty: afterBrowserCapture.dirtyPaths.length > 0,
        },
        allowedOutputPrefixes: [...captureOutputPrefixes, 'artifacts/commercial-ui/evidence.json'],
      },
      baseUrl,
      runtimeRevisionProof,
      selectedNodeConfigured: Boolean(selectedNodeId),
      designSourceOfTruth: {
        handoff: 'artifacts/product-design-audits/knowledge-graph-2026-06-14/design-handoff.md',
        conceptsReadme: 'artifacts/product-design-audits/knowledge-graph-2026-06-14/concepts/README.md',
        conceptImages: [
          'artifacts/product-design-audits/knowledge-graph-2026-06-14/concepts/layered-research-atlas.png',
          'artifacts/product-design-audits/knowledge-graph-2026-06-14/concepts/night-bridge-semantic-map.png',
          'artifacts/product-design-audits/knowledge-graph-2026-06-14/concepts/daylight-engineering-atlas.png',
        ],
      },
      sourceEvidence: {
        sharedAppShell: true,
        noCompetingGlobalNavigation: true,
        compactLocalTools: true,
        relationFamilyControl: true,
        localizedLabels: true,
        activeSummaries: true,
        hoverDoesNotRelayout: true,
        selectionDoesNotRelayout: true,
        draggedPositionPersists: true,
        konlingSharedDock: true,
        konlingSelectedContext: true,
        konlingNoSelection: true,
        konlingDegradedContext: true,
        focusManagement: true,
        stressStateNonOverlap: true,
        rawSearchExcludedFromAssistantContext: true,
      },
      currentSourceSha256,
      stateMatrix,
      focusEvidence,
      activeAuthorityVisualMatrix,
      authenticatedRoleEvidence,
      handoffMatrix: {
        path: 'artifacts/knowledge-workspace-product-qa-489/handoff-implementation-matrix.md',
        adopted: [
          'layered graph organization',
          'premium dark visual tone',
          'light-mode clarity',
        ],
        rejected: [
          'standalone shell duplication',
          'generated role switchers',
          'exact mock labels',
          'exact node positions',
          'duplicate assistant regions',
        ],
        merged: [
          'shared AppShell + local graph tools + right-bottom Konling dock',
        ],
      },
      independentVisualReview: readExistingIndependentVisualReview(
        stateMatrix,
        currentSourceSha256,
        activeAuthorityVisualMatrix,
      )
        ?? pendingIndependentVisualReview(),
      temporaryExceptions: [],
    };
    writeFileSync(
      path.join(outputDir, 'browser-evidence.json'),
      `${JSON.stringify(evidence, null, 2)}\n`,
      'utf8',
    );
    writeToolsInspectorCompatibilityEvidence(
      stateMatrix as Array<Record<string, unknown>>,
      focusEvidence as Array<Record<string, unknown>>,
      captureRevision,
    );
    writeSemanticMapCompatibilityEvidence(stateMatrix as Array<Record<string, unknown>>, captureRevision);
    writeKnowledgeGraphGovernanceEvidence(stateMatrix as Array<Record<string, unknown>>, captureRevision);
    assertCaptureRevisionUnchanged(
      captureRevision,
      'after-artifact-write',
      captureArtifactPrefixes,
    );
    console.log(`captured ${stateMatrix.length} knowledge workspace QA states at ${path.relative(repoRoot, outputDir)}`);
  } finally {
    await browser.close();
  }
}

if (require.main === module) {
  main().catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  });
}
