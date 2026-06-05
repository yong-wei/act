import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  PLATFORM_BRAND_APPLICATION_EVIDENCE,
  PLATFORM_BRAND_ASSET_REFERENCES,
  PLATFORM_BRAND_FORBIDDEN_ACCENT_FAMILIES,
  PLATFORM_BRAND_LEGACY_NAMESPACE_MAPPINGS,
  PLATFORM_BRAND_NUMERIC_TYPOGRAPHY_CONTRACT,
  PLATFORM_DUAL_TEMPLATE_TOKEN_ROLES,
} from '@/lib/platform-brand-kit';

const rootDir = path.resolve(__dirname, '../../..');

function readSource(relativePath: string) {
  return readFileSync(path.join(rootDir, relativePath), 'utf8');
}

describe('platform brand kit contracts', () => {
  it('registers required brand assets with light and dark behavior', () => {
    expect(PLATFORM_BRAND_ASSET_REFERENCES.map((asset) => asset.kind)).toEqual([
      'app-mark',
      'horizontal-lockup',
      'compact-mark',
      'favicon',
      'route-badge',
      'arena-badge',
      'course-badge',
      'workbench-chrome',
      'data-snapshot',
      'governance-snapshot',
      'report-watermark',
    ]);

    for (const asset of PLATFORM_BRAND_ASSET_REFERENCES) {
      expect(asset.usage).not.toContain('decoration');
      expect(asset.lightBehavior).toMatch(/paper|daylight|matte|printed|stamp/i);
      expect(asset.darkBehavior).toMatch(/night|instrument|low-light|trace|watermark/i);
      expect(existsSync(path.join(rootDir, asset.sourcePath.split('#')[0]))).toBe(true);
    }
  });

  it('exposes complete dual-template token roles through CSS and Tailwind', () => {
    const globals = readSource('src/app/globals.css');
    const tailwindConfig = readSource('tailwind.config.ts');

    expect(PLATFORM_DUAL_TEMPLATE_TOKEN_ROLES.map((token) => token.role)).toEqual([
      'canvas',
      'surface-1',
      'surface-2',
      'elevated',
      'hairline',
      'trace-accent',
      'muted-accent',
      'danger',
      'success',
      'focus-ring',
      'evidence',
      'report-output',
    ]);

    for (const token of PLATFORM_DUAL_TEMPLATE_TOKEN_ROLES) {
      expect(globals).toContain(`--${token.cssVariable}:`);
      expect(tailwindConfig).toContain(`'${token.tailwindColor}'`);
      expect(tailwindConfig).toContain(`hsl(var(--${token.cssVariable}))`);
      expect(token.lightTemplateUse).not.toEqual(token.darkTemplateUse);
    }
  });

  it('maps legacy visual namespaces and blocks unmanaged accent families', () => {
    expect(PLATFORM_BRAND_LEGACY_NAMESPACE_MAPPINGS.map((mapping) => mapping.namespace)).toEqual([
      'interactive-course-hub-*',
      'admin-console-*',
      'premium-lesson-*',
      'surface-card',
    ]);
    for (const mapping of PLATFORM_BRAND_LEGACY_NAMESPACE_MAPPINGS) {
      expect(mapping.disposition).toMatch(/map|retire/);
      expect(mapping.tokenRoles.length).toBeGreaterThan(0);
      expect(mapping.acceptanceRule).toContain('silent coexistence');
    }

    expect(PLATFORM_BRAND_FORBIDDEN_ACCENT_FAMILIES).toEqual(
      expect.arrayContaining(['slate', 'cyan', 'amber', 'violet', 'fuchsia']),
    );
  });

  it('defines numeric typography and representative brand evidence', () => {
    expect(PLATFORM_BRAND_NUMERIC_TYPOGRAPHY_CONTRACT).toMatchObject({
      numericFontFeature: 'tnum',
      metricRule: expect.stringContaining('source'),
      statusLabelRule: expect.stringContaining('evidence'),
    });

    expect(PLATFORM_BRAND_APPLICATION_EVIDENCE.map((entry) => entry.surface)).toEqual([
      'navigation',
      'learner-record',
      'mission-workspace',
      'knowledge-data-map',
      'operations-console',
      'report-ledger',
    ]);
    for (const entry of PLATFORM_BRAND_APPLICATION_EVIDENCE) {
      expect(entry.lightEvidence).toBeTruthy();
      expect(entry.darkEvidence).toBeTruthy();
      expect(entry.requiredBrandRoles).toEqual(expect.arrayContaining(['route identity', 'evidence state']));
    }
  });

  it('captures a shareable brand-kit evidence manifest', () => {
    const manifestPath = 'artifacts/commercial-ui/brand-kit-evidence.json';
    const manifest = JSON.parse(readSource(manifestPath)) as {
      change: string;
      evidencePage: string;
      assetKit: string;
      routes: Array<{ surface: string; lightEvidence: string; darkEvidence: string }>;
    };

    expect(manifest.change).toBe('create-dual-theme-brand-tokens-and-assets');
    expect(existsSync(path.join(rootDir, manifest.evidencePage))).toBe(true);
    expect(existsSync(path.join(rootDir, manifest.assetKit))).toBe(true);

    const evidencePage = readSource(manifest.evidencePage);
    expect(evidencePage).toContain('horizontal-lockup.svg');
    expect(evidencePage).toContain('route-badge.svg');
    expect(evidencePage).toContain('data-snapshot.svg');
    expect(evidencePage).toContain('workbench-chrome.svg');
    expect(evidencePage).toContain('governance-snapshot.svg');
    expect(evidencePage).toContain('report-watermark.svg');
    for (const token of PLATFORM_DUAL_TEMPLATE_TOKEN_ROLES) {
      expect(evidencePage).toContain(`var(--${token.cssVariable})`);
    }

    expect(manifest.routes.map((route) => route.surface)).toEqual(
      PLATFORM_BRAND_APPLICATION_EVIDENCE.map((entry) => entry.surface),
    );
    for (const route of manifest.routes) {
      expect(existsSync(path.join(rootDir, route.lightEvidence))).toBe(true);
      expect(existsSync(path.join(rootDir, route.darkEvidence))).toBe(true);
    }
  });
});
