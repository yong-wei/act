import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

const repoRoot = process.cwd();
const evidencePath = 'artifacts/knowledge-graph-node-expansion-894/browser-evidence.json';

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

function readEvidence() {
  assert.equal(existsSync(path.join(repoRoot, evidencePath)), true, `${evidencePath} is missing`);
  return JSON.parse(readText(evidencePath)) as JsonRecord;
}

function stateByName(evidence: JsonRecord) {
  const states = Array.isArray(evidence.states)
    ? evidence.states.map((entry) => objectRecord(entry))
    : [];
  return new Map(
    states
      .map((entry) => [typeof entry.name === 'string' ? entry.name : '', entry] as const)
      .filter(([name]) => name.length > 0),
  );
}

function assertSourceContracts(evidence: JsonRecord) {
  const sourceHashes = objectRecord(evidence.sourceSha256);
  const sourceFiles = [
    'src/features/knowledge/knowledge-graph-system.tsx',
    'src/features/knowledge/resource-panel/resource-panel.tsx',
    'src/features/knowledge/graph/knowledge-graph-2d.tsx',
    'src/features/knowledge/graph/knowledge-graph-canvas.tsx',
    'src/features/knowledge/graph/motion.ts',
    'src/features/knowledge/graph/camera-transition.ts',
    'src/features/knowledge/graph/layout-engine.ts',
    'src/features/knowledge/graph/layout-state.ts',
    'src/features/knowledge/graph/node-activation.ts',
    'src/features/knowledge/progressive-graph-cache.ts',
    'scripts/tests/capture-knowledge-graph-node-expansion-894.ts',
  ];
  for (const file of sourceFiles) {
    assert.equal(sourceHashes[file], sha256(file), `${file} source hash drifted after evidence capture`);
  }

  const systemSource = readText('src/features/knowledge/knowledge-graph-system.tsx');
  assert.equal(systemSource.includes('resolveKnowledgeNodeActivation'), true, 'direct activation resolver is missing');
  assert.equal(systemSource.includes('setIsPanelOpen(false)'), true, 'inspector dismissal contract is missing');

  for (const file of [
    'src/features/knowledge/graph/knowledge-graph-2d.tsx',
    'src/features/knowledge/graph/knowledge-graph-canvas.tsx',
  ]) {
    const source = readText(file);
    assert.equal(source.includes('createKnowledgeGraphRevealPlan'), true, `${file} reveal plan is missing`);
    assert.equal(source.includes('KnowledgeGraphTransitionGate'), true, `${file} stale-transition gate is missing`);
    assert.equal(source.includes('onPointerDownCapture={handleCanvasPointerDown}'), true, `${file} conditional pointer dismissal is missing`);
    assert.equal(source.includes('onBackgroundClick={onManipulationStart}'), true, `${file} blank activation dismissal is missing`);
    assert.equal(source.includes('onNodeDrag={handleNodeDrag}'), true, `${file} drag dismissal is missing`);
    assert.equal(source.includes('onWheel={onManipulationStart}'), false, `${file} wheel must not dismiss inspector`);
    assert.equal(source.includes('onZoom={onManipulationStart}'), false, `${file} programmatic zoom must not dismiss inspector`);
    assert.equal(source.includes('elapsedMs'), true, `${file} presentation progress is missing`);
    assert.equal(source.includes('getKnowledgeGraphPresentationNodeScale'), true, `${file} node scale presentation is missing`);
    assert.equal(source.includes('getKnowledgeGraphPresentationLinkProgress'), true, `${file} relation progress presentation is missing`);
    assert.equal(source.includes('new KnowledgeGraphCameraTransition()'), true, `${file} cancellable camera transition is missing`);
    assert.equal(source.includes('cameraTransitionRef.current.cancel()'), true, `${file} camera cancellation is missing`);
    assert.equal(source.includes('cameraTransitionRef.current.start('), true, `${file} camera transition scheduler is missing`);
    assert.equal(source.includes('data-knowledge-graph-presentation-phase'), true, `${file} presentation phase evidence marker is missing`);
    assert.equal(source.includes('data-knowledge-graph-animated-node-count'), true, `${file} animated node evidence marker is missing`);
    assert.equal(source.includes('data-knowledge-graph-animated-relation-count'), true, `${file} animated relation evidence marker is missing`);
  }

  const motionSource = readText('src/features/knowledge/graph/motion.ts');
  assert.equal(motionSource.includes('requestAnimationFrame'), false, 'motion model must remain timer/render driven');
  assert.equal(motionSource.includes('interpolate'), true, 'motion model must interpolate presentation opacity');
  assert.equal(motionSource.includes('prefersReducedKnowledgeGraphMotion'), true, 'reduced-motion contract is missing');
  assert.equal(readText('src/features/knowledge/graph/knowledge-graph-canvas.tsx').includes('linkPositionUpdate={updatePresentationLinkObject}'), true, '3D link growth is missing');

  const panelSource = readText('src/features/knowledge/resource-panel/resource-panel.tsx');
  const knowledgeCardIndex = panelSource.indexOf('data-knowledge-inspector-section="evidence-sources"');
  const relatedIndex = panelSource.indexOf('data-knowledge-inspector-section="relation-overview"');
  const learningActionsIndex = panelSource.indexOf('data-knowledge-inspector-section="learning-actions"');
  assert.ok(knowledgeCardIndex >= 0, 'Knowledge Card section is missing');
  assert.ok(relatedIndex >= 0, 'Related Knowledge Points section is missing');
  assert.ok(knowledgeCardIndex < relatedIndex, 'Knowledge Card must precede Related Knowledge Points');
  assert.ok(learningActionsIndex > relatedIndex, 'learning-path actions must follow Related Knowledge Points');
}

function assertStateContracts(evidence: JsonRecord) {
  assert.equal(evidence.change, 'redesign-knowledge-graph-direct-manipulation');
  const states = stateByName(evidence);
  assert.deepEqual([...states.keys()].sort(), ['2d-motion', '2d-reduced', '3d-motion']);
  const requiredInspectorSections = ['header', 'semantic-metadata', 'summary', 'evidence-sources', 'learning-actions'];

  for (const name of states.keys()) {
    const state = states.get(name)!;
    const screenshotPath = typeof state.screenshotPath === 'string' ? state.screenshotPath : '';
    assert.equal(existsSync(path.join(repoRoot, screenshotPath)), true, `${name} screenshot is missing`);
    const transitionScreenshotPath = typeof state.transitionScreenshotPath === 'string' ? state.transitionScreenshotPath : '';
    assert.equal(existsSync(path.join(repoRoot, transitionScreenshotPath)), true, `${name} transition screenshot is missing`);
    assert.ok(Number(objectRecord(state.transitionPixelEvidence).nodeColorPixels ?? 0) > 0, `${name} transition graph pixels are missing`);
    assert.ok(Number(objectRecord(state.canvasPixelEvidence).nodeColorPixels ?? 0) > 0, `${name} final graph pixels are missing`);

    const expanded = objectRecord(state.expanded);
    const expandedControl = objectRecord(expanded.directControl);
    assert.equal(expandedControl.expanded, 'true', `${name} expandable node did not expand`);
    assert.equal(expandedControl.busy, 'false', `${name} expandable node remained busy`);
    assert.equal(expanded.inspectorVisible, false, `${name} expandable activation opened the inspector`);
    const presentation = objectRecord(expanded.presentation);
    const transitionPresentation = objectRecord(state.transitionPresentation);
    if (name === '2d-reduced') {
      assert.equal(presentation.phase, 'idle', `${name} reduced motion did not settle immediately`);
      assert.equal(Number(presentation.animatedNodeCount ?? 0), 0, `${name} reduced motion staged nodes unexpectedly`);
      assert.equal(Number(presentation.animatedRelationCount ?? 0), 0, `${name} reduced motion staged relations unexpectedly`);
    } else {
      assert.equal(transitionPresentation.phase, 'revealing', `${name} did not expose an active reveal phase`);
      assert.ok(Number(transitionPresentation.animatedNodeCount ?? 0) > 0, `${name} reveal has no animated nodes`);
      assert.ok(Number(transitionPresentation.animatedRelationCount ?? 0) > 0, `${name} reveal has no animated relations`);
    }

    const inspected = objectRecord(state.inspected);
    const inspectedControl = objectRecord(inspected.directControl);
    assert.equal(inspectedControl.expanded, null, `${name} leaf activation changed expansion state`);
    assert.equal(inspectedControl.busy, 'false', `${name} leaf activation remained busy`);
    assert.equal(inspected.inspectorVisible, true, `${name} leaf inspector did not open`);
    for (const section of requiredInspectorSections) {
      assert.equal(stringArray(inspected.inspectorSections).includes(section), true, `${name} inspector lacks ${section}`);
    }

    const realCanvas = objectRecord(state.realCanvas);
    for (const key of ['parentCanvasPoint', 'leafCanvasPoint', 'repeatedLeafCanvasPoint']) {
      const point = objectRecord(realCanvas[key]);
      assert.equal(Number.isFinite(Number(point.x)) && Number.isFinite(Number(point.y)), true, `${name} ${key} is missing`);
    }
    assert.equal(realCanvas.leafClickStable, true, `${name} real leaf click refetched or reset the inspector`);

    const dismissal = objectRecord(state.dismissal);
    assert.equal(dismissal.trigger, 'canvas-blank-pointerdown', `${name} dismissal was not a blank canvas pointer action`);
    assert.equal(dismissal.inspectorClosed, true, `${name} canvas pointer did not close inspector`);
    assert.equal(objectRecord(state.dismissed).inspectorVisible, false, `${name} inspector remained visible after dismissal`);
    assert.equal(objectRecord(state.inspected).reducedMotion, name === '2d-reduced');
  }
}

const evidence = readEvidence();
assertSourceContracts(evidence);
assertStateContracts(evidence);

console.log('knowledge graph direct manipulation governance test passed');
