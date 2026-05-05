import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

import { describe, expect, it } from 'vitest';

const repoRoot = process.cwd();
const productionRoots = ['src/features/interactive', 'src/resources'];
const sharedMarkerPath = 'src/features/interactive/shared/interactive-svg-markers.tsx';
const reviewMarkerPath = 'src/app/review/unit-5-2-arrow-markers/page.tsx';
const privateMarkerAllowList = new Set([sharedMarkerPath]);
const openWideAllowList = new Set([sharedMarkerPath, reviewMarkerPath]);

function listSourceFiles(root: string): string[] {
  const absoluteRoot = join(repoRoot, root);
  return readdirSync(absoluteRoot).flatMap((entry) => {
    const absolutePath = join(absoluteRoot, entry);
    const relativePath = relative(repoRoot, absolutePath);
    const stats = statSync(absolutePath);
    if (stats.isDirectory()) {
      if (entry === '__tests__') return [];
      return listSourceFiles(relativePath);
    }
    return /\.(tsx?|jsx?)$/.test(entry) ? [relativePath] : [];
  });
}

function source(relativePath: string) {
  return readFileSync(join(repoRoot, relativePath), 'utf8');
}

describe('interactive SVG marker governance', () => {
  it('keeps production SVG marker definitions centralized in the shared registry', () => {
    const offenders = productionRoots
      .flatMap(listSourceFiles)
      .filter((relativePath) => source(relativePath).includes('<marker'))
      .filter((relativePath) => !privateMarkerAllowList.has(relativePath));

    expect(offenders).toEqual([]);
  });

  it('keeps the wide open arrow limited to shared/review code and production arrows on the slim marker', () => {
    const scannedFiles = [
      ...productionRoots.flatMap(listSourceFiles),
      reviewMarkerPath,
    ];
    const offenders = scannedFiles
      .filter((relativePath) => source(relativePath).includes('arrow-open-wide-concave'))
      .filter((relativePath) => !openWideAllowList.has(relativePath));

    expect(offenders).toEqual([]);
    expect(source(sharedMarkerPath)).toContain("INTERACTIVE_SVG_PRODUCTION_ARROW_KIND = 'arrow-slim-concave'");
  });

  it('keeps migrated control point markers on the shared SVG point helpers', () => {
    const controlPanels = source('src/resources/control-system/charts/control-analysis-panels.tsx');
    const bodeOptions = source('src/resources/control-system/charts/control-bode-options.ts');
    const unit52Panels = source('src/features/interactive/unit-5-2-nonlinear-analysis-entry/step-panels.tsx');

    expect(controlPanels).toContain("getInteractiveSvgEChartsPointMarker('pole-cross'");
    expect(controlPanels).toContain("getInteractiveSvgEChartsPointMarker('dot-hollow'");
    expect(controlPanels).toContain('<InteractiveSvgPointMarker');
    expect(controlPanels).not.toContain('ROOT_LOCUS_POLE_SYMBOL');
    expect(controlPanels).not.toContain('absolute left-1/2 top-1/2');
    expect(bodeOptions).toContain("getInteractiveSvgEChartsPointMarker('diamond-filled'");
    expect(unit52Panels).toContain('<InteractiveSvgPointMarker');
  });
});
