import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

const repoRoot = process.cwd();
const evidencePath = 'artifacts/knowledge-graph-progressive-loading-875/browser-evidence.json';

type JsonRecord = Record<string, unknown>;

function readText(relativePath: string) {
  return readFileSync(path.join(repoRoot, relativePath), 'utf8');
}

function sha256(relativePath: string) {
  return createHash('sha256').update(readText(relativePath)).digest('hex');
}

function objectRecord(value: unknown): JsonRecord {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as JsonRecord : {};
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === 'string') : [];
}

function numberArray(value: unknown): number[] {
  return Array.isArray(value) ? value.filter((entry): entry is number => typeof entry === 'number') : [];
}

function readEvidence() {
  assert.equal(existsSync(path.join(repoRoot, evidencePath)), true, `${evidencePath} is missing`);
  return JSON.parse(readText(evidencePath)) as JsonRecord;
}

function stateByName(evidence: JsonRecord) {
  const states = Array.isArray(evidence.stateMatrix)
    ? evidence.stateMatrix.map((entry) => objectRecord(entry))
    : [];
  return new Map(
    states
      .map((entry) => [typeof entry.name === 'string' ? entry.name : '', entry] as const)
      .filter(([name]) => name.length > 0),
  );
}

function markerFor(state: JsonRecord, key: 'progressive' | 'expansion') {
  return objectRecord(objectRecord(state.markers)[key]);
}

function networkModesFor(state: JsonRecord): string[] {
  return Array.isArray(state.networkEvents)
    ? state.networkEvents
        .map((entry) => objectRecord(entry).mode)
        .filter((mode): mode is string => typeof mode === 'string')
    : [];
}

function networkResponsesFor(state: JsonRecord): JsonRecord[] {
  return Array.isArray(state.networkResponses)
    ? state.networkResponses.map((entry) => objectRecord(entry))
    : [];
}

function rootResponseFor(state: JsonRecord) {
  return networkResponsesFor(state).find((entry) => entry.mode === 'root') ?? {};
}

function assertSourceContracts() {
  const graphSource = readText('src/features/knowledge/knowledge-graph-system.tsx');
  const payloadSource = readText('src/lib/knowledge-graph-source.ts');
  const routeSource = readText('src/app/api/knowledge/graph/route.ts');

  assert.equal(graphSource.includes("fetchProgressivePayload('root')"), true, 'client must fetch root payload first');
  assert.equal(graphSource.includes("fetch('/api/knowledge/graph'"), false, 'client first render must not fetch full graph endpoint');
  assert.equal(graphSource.includes("fetchProgressivePayload('active-filter')"), true, 'client must fetch active-filter shard');
  assert.equal(graphSource.includes("fetchProgressivePayload('remaining')"), true, 'client must fetch remaining shard');
  assert.equal(graphSource.includes('data-knowledge-progressive-loading="root-first"'), true, 'progressive root marker is missing');
  assert.equal(graphSource.includes('data-knowledge-full-graph-first-render="avoided"'), true, 'full graph avoidance marker is missing');
  assert.equal(graphSource.includes('data-knowledge-expansion-control'), true, 'expansion control marker is missing');
  assert.equal(graphSource.includes('aria-expanded={selectedNodeExpanded}'), true, 'expansion control must expose aria-expanded');
  assert.equal(graphSource.includes('aria-busy={selectedNodeLoadingExpansion}'), true, 'expansion control must expose aria-busy');
  assert.equal(graphSource.includes('expansionHasVisibleDescendant'), true, 'filtered-empty must be computed against active filters');

  for (const symbol of [
    'buildKnowledgeGraphRootPayload',
    'buildKnowledgeGraphExpansionPayload',
    'buildKnowledgeGraphActiveFilterPayload',
    'buildKnowledgeGraphRemainingPayload',
    'buildKnowledgeGraphManifestPayload',
  ]) {
    assert.equal(payloadSource.includes(symbol), true, `${symbol} is missing`);
  }
  for (const mode of ['manifest', 'root', 'expansion', 'active-filter', 'remaining']) {
    assert.equal(routeSource.includes(`mode === '${mode}'`), true, `route is missing ${mode} mode`);
  }
}

function assertEvidenceContracts(evidence: JsonRecord) {
  assert.equal(evidence.change, 'progressive-knowledge-graph-loading');
  assert.equal(evidence.issue, 875);
  assert.equal(evidence.route, '/knowledge');
  assert.equal(typeof evidence.rootNodeId, 'string');
  assert.equal(typeof evidence.noChildrenNodeId, 'string');
  const sourceHashes = objectRecord(evidence.currentSourceSha256);
  for (const file of [
    'src/features/knowledge/knowledge-graph-system.tsx',
    'src/features/knowledge/sidebar/knowledge-sidebar.tsx',
    'src/lib/knowledge-graph-source.ts',
    'src/app/api/knowledge/graph/route.ts',
    'scripts/tests/capture-knowledge-graph-progressive-loading.ts',
    'scripts/tests/test-knowledge-graph-progressive-loading-governance.ts',
  ]) {
    assert.equal(sourceHashes[file], sha256(file), `${file} source hash drifted after evidence capture`);
  }

  const covered = new Set(numberArray(evidence.requiredViewports));
  for (const width of [1440, 1279, 1100, 1024, 320]) {
    assert.equal(covered.has(width), true, `required viewport ${width} missing`);
  }
  const assertions = objectRecord(evidence.assertions);
  for (const key of [
    'rootFirstRender',
    'fullGraphFirstRenderAvoided',
    'expansionLoading',
    'expandedState',
    'collapsedState',
    'backgroundLoadingNonBlocking',
    'denseModeUsesRemainingShard',
    'filteredEmptyOrNoChildren',
    'collapsedRootFilterRetained',
    'localToolNonOverlap',
    'selectedNodeInspectorRetained',
    'konlingContextRetained',
    'focusReturn',
    'dockAvoidance',
  ]) {
    assert.equal(assertions[key], true, `assertion ${key} must be true`);
  }
}

function assertStateContracts(evidence: JsonRecord) {
  const states = stateByName(evidence);
  for (const name of [
    'root-first-1440',
    'root-first-1279',
    'root-first-1100',
    'root-first-1024',
    'root-first-320',
    'expansion-loading-1440',
    'expanded-1440',
    'collapsed-1440',
    'cache-reuse-1440',
    'filtered-empty-1440',
    'root-filtered-match-1440',
    'dense-all-1440',
    'local-tool-1440',
    'selected-inspector-1440',
    'konling-expanded-1440',
  ]) {
    const state = states.get(name);
    assert.ok(state, `state ${name} is missing`);
    const screenshotPath = typeof state.screenshotPath === 'string' ? state.screenshotPath : '';
    assert.equal(existsSync(path.join(repoRoot, screenshotPath)), true, `state ${name} screenshot is missing`);
    const progressive = markerFor(state, 'progressive');
    assert.equal(progressive.loadingMode, 'root-first', `${name} missing root-first marker`);
    assert.equal(progressive.graphVersionPresent, true, `${name} missing graph version marker`);
    assert.equal(typeof progressive.graphVersion, 'string', `${name} missing graph version value`);
    assert.ok(String(progressive.graphVersion).length > 0, `${name} graph version value is empty`);
    assert.equal(progressive.fullGraphFirstRender, 'avoided', `${name} missing full graph avoidance marker`);
    const canvasPixelEvidence = objectRecord(objectRecord(state.markers).canvasPixelEvidence);
    assert.equal(canvasPixelEvidence.available, true, `${name} canvas pixel evidence unavailable`);
    assert.ok(Number(canvasPixelEvidence.nodeColorPixels ?? 0) > 0, `${name} does not show visible graph nodes`);
    const modes = networkModesFor(state);
    assert.equal(modes.includes('full'), false, `${name} requested full graph endpoint`);
    assert.ok(modes.indexOf('root') >= 0, `${name} did not request root graph payload`);
    const rootResponse = rootResponseFor(state);
    assert.equal(rootResponse.status, 200, `${name} root response did not return 200`);
    assert.equal(rootResponse.payloadMode, 'root', `${name} root response payload mode mismatch`);
    assert.equal(rootResponse.graphVersion, progressive.graphVersion, `${name} root response graph version does not match DOM marker`);
    assert.ok(String(rootResponse.shardKey ?? '').includes(':shard:root:chapters'), `${name} root response shard key is not the root shard`);
    assert.ok(Number(rootResponse.nodeCount ?? 0) > 0, `${name} root response node count is missing`);
    assert.equal(rootResponse.nodeCount, rootResponse.rootSummaryCount, `${name} root count does not match root summaries`);
    const activeIndex = modes.indexOf('active-filter');
    const remainingIndex = modes.indexOf('remaining');
    if (activeIndex >= 0) assert.ok(modes.indexOf('root') < activeIndex, `${name} requested active-filter before root`);
    if (remainingIndex >= 0) assert.ok(activeIndex >= 0 && activeIndex < remainingIndex, `${name} requested remaining before active-filter`);
  }

  assert.equal(markerFor(states.get('expansion-loading-1440')!, 'expansion').state, 'loading');
  assert.equal(markerFor(states.get('expansion-loading-1440')!, 'expansion').loadingMessage, true);
  assert.equal(markerFor(states.get('expanded-1440')!, 'expansion').state, 'expanded');
  assert.equal(markerFor(states.get('collapsed-1440')!, 'expansion').state, 'collapsed');
  assert.equal(markerFor(states.get('cache-reuse-1440')!, 'expansion').state, 'expanded');
  assert.equal(networkModesFor(states.get('cache-reuse-1440')!).filter((mode) => mode === 'expansion').length, 1);
  assert.equal(markerFor(states.get('filtered-empty-1440')!, 'expansion').filteredEmpty, 'true');
  assert.equal(markerFor(states.get('filtered-empty-1440')!, 'expansion').emptyMessage, true);
  const filteredRootMarkers = objectRecord(states.get('root-filtered-match-1440')!.markers);
  const filteredRootProgressive = objectRecord(filteredRootMarkers.progressive);
  assert.equal(
    Number(filteredRootProgressive.visibleNodeCount ?? 0),
    Number(evidence.expectedFilteredRootCount ?? 0),
    'collapsed root filtering did not match the expected child-hit chapter count'
  );
  assert.equal(
    String(filteredRootProgressive.activeFilterSummary ?? '').includes(String(evidence.noChildrenNodeName ?? '')),
    true,
    'collapsed root filter evidence did not use the selected child search text'
  );
  const expectedRootNames = stringArray(evidence.expectedFilteredRootNames);
  assert.equal(expectedRootNames.length, Number(evidence.expectedFilteredRootCount ?? 0), 'expected filtered root name count mismatch');
  for (const chapterName of expectedRootNames) {
    assert.equal(
      String(filteredRootMarkers.chapterDirectoryText ?? '').includes(chapterName),
      true,
      `chapter directory omitted matched root ${chapterName}`
    );
  }
  assert.equal(networkModesFor(states.get('root-filtered-match-1440')!).includes('full'), false);
  const denseAllMarkers = objectRecord(states.get('dense-all-1440')!.markers);
  assert.equal(objectRecord(denseAllMarkers.progressive).densityMode, 'all');
  assert.equal(denseAllMarkers.openLocalTool, 'relation-filters');
  assert.equal(objectRecord(states.get('dense-all-1440')!.interactionEvidence).selectedDensityMode, 'true');
  assert.equal(networkModesFor(states.get('dense-all-1440')!).includes('remaining'), true);
  assert.equal(networkModesFor(states.get('dense-all-1440')!).includes('full'), false);

  const localToolMarkers = objectRecord(states.get('local-tool-1440')!.markers);
  assert.equal(localToolMarkers.localTool, 'open');
  const inspectorMarkers = objectRecord(states.get('selected-inspector-1440')!.markers);
  assert.equal(inspectorMarkers.inspectorVisible, true);
  const konlingReference = objectRecord(evidence.konlingEvidenceReference);
  const konlingReferencePath = typeof konlingReference.path === 'string' ? konlingReference.path : '';
  assert.equal(existsSync(path.join(repoRoot, konlingReferencePath)), true, 'Konling expanded evidence reference is missing');
  const referencedKonlingEvidence = JSON.parse(readText(konlingReferencePath)) as JsonRecord;
  const referencedStates = stateByName(referencedKonlingEvidence);
  assert.ok(referencedStates.has('desktop-konling-selected-expanded-dark'), 'Konling expanded evidence state is missing');

  const overlapStates = ['expanded-1440', 'cache-reuse-1440', 'filtered-empty-1440', 'root-filtered-match-1440', 'dense-all-1440', 'local-tool-1440', 'konling-expanded-1440'];
  for (const name of overlapStates) {
    const overlaps = objectRecord(objectRecord(states.get(name)!.markers).overlaps);
    assert.equal(overlaps.dockOverlapsExpansion, false, `${name} dock overlaps expansion panel`);
    assert.equal(overlaps.localToolOverlapsExpansion, false, `${name} local tool overlaps expansion panel`);
  }
}

const evidence = readEvidence();
assertSourceContracts();
assertEvidenceContracts(evidence);
assertStateContracts(evidence);

console.log('knowledge graph progressive loading governance test passed');
