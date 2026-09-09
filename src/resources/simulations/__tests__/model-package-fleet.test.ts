import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { resolveVersionedDefault } from '@/lib/browser-delivery/client';
import type { SimulationModelId } from '@/lib/browser-delivery/types';
import { validateReceivedModelPackage, type ModelPackageFileIo } from '../model-packages/model-package-validation';
import {
  ADORA_MAGIC_CITY_V010,
  DREDGER_TIANJING_V101,
  FLEET_ACTIVE_PACKAGES,
  HYSY_981_V1,
  HYSY_981_V102,
  LNG_CHANGHENG_V1,
  MSC_TESSA_V1,
  XUE_LONG_2_V011,
  matchActivatedFleetPackage,
} from '../model-packages/fleet-packages';
import { TYPE055_NANCHANG_101_V2 } from '../model-packages/type055-nanchang-101-v2';
import { shipLodUrlForQualityTier, type VersionedModelPackageDescriptor } from '../model-packages/types';

const FLEET: Array<{
  logicalId: SimulationModelId;
  descriptor: VersionedModelPackageDescriptor;
  receiptRel: string;
  packageRel: string;
}> = [
  {
    logicalId: 'lng-carrier',
    descriptor: LNG_CHANGHENG_V1,
    receiptRel: 'artifacts/model-releases/lng-changheng-v1.0.0/receipt.json',
    packageRel: 'public/assets/model-releases/lng-changheng/v1.0.0',
  },
  {
    logicalId: 'container',
    descriptor: MSC_TESSA_V1,
    receiptRel: 'artifacts/model-releases/msc-tessa-v1.0.0/receipt.json',
    packageRel: 'public/assets/model-releases/msc-tessa/v1.0.0',
  },
  {
    logicalId: 'icebreaker',
    descriptor: XUE_LONG_2_V011,
    receiptRel: 'artifacts/model-releases/xue-long-2-v0.1.1/receipt.json',
    packageRel: 'public/assets/model-releases/xue-long-2/v0.1.1',
  },
  {
    logicalId: 'luxury-liner',
    descriptor: ADORA_MAGIC_CITY_V010,
    receiptRel: 'artifacts/model-releases/adora-magic-city-v0.1.0/receipt.json',
    packageRel: 'public/assets/model-releases/adora-magic-city/v0.1.0',
  },
  {
    logicalId: 'drilling-rig',
    descriptor: HYSY_981_V102,
    receiptRel: 'artifacts/model-releases/hysy-981-v1.0.2/receipt.json',
    packageRel: 'public/assets/model-releases/hysy-981/v1.0.2',
  },
  {
    logicalId: 'dredger',
    descriptor: DREDGER_TIANJING_V101,
    receiptRel: 'artifacts/model-releases/dredger-tianjing-v1.0.1/receipt.json',
    packageRel: 'public/assets/model-releases/dredger-tianjing/v1.0.1',
  },
];

function packageIo(packageDir: string): ModelPackageFileIo {
  return {
    listFiles: () => readdirSync(packageDir),
    sizeOf: (file) => statSync(path.join(packageDir, file)).size,
    sha256: (file) => createHash('sha256').update(readFileSync(path.join(packageDir, file))).digest('hex'),
  };
}

describe('fleet versioned model packages', () => {
  it('activates all seven ships including Tianjing v1.0.1', () => {
    expect(matchActivatedFleetPackage('destroyer', resolveVersionedDefault('destroyer'))).toEqual(TYPE055_NANCHANG_101_V2);
    expect(FLEET_ACTIVE_PACKAGES.destroyer).toEqual(TYPE055_NANCHANG_101_V2);
    for (const entry of FLEET) {
      expect(matchActivatedFleetPackage(entry.logicalId, resolveVersionedDefault(entry.logicalId))).toEqual(entry.descriptor);
    }
  });

  it('keeps merchant packages on a three-LOD denominator without weapon roles', () => {
    for (const entry of FLEET) {
      const roles = entry.descriptor.roles;
      expect(roles).toBeDefined();
      expect(Object.keys(roles ?? {}).sort()).toEqual(['ship-lod0', 'ship-lod1', 'ship-lod2']);
      expect(roles?.demo).toBeUndefined();
      expect(roles?.payload).toBeUndefined();
      expect(shipLodUrlForQualityTier(entry.descriptor, 'high')).toBe(roles?.['ship-lod0'].url);
      expect(shipLodUrlForQualityTier(entry.descriptor, 'low')).toBe(roles?.['ship-lod2'].url);
    }
  });

  it('uses +X basis yaw for 雪龙 2 / 爱达 and act-forward 0 for LNG / Tessa / 981 / Tianjing', () => {
    expect(XUE_LONG_2_V011.basisYawRad).toBeCloseTo(-Math.PI / 2);
    expect(ADORA_MAGIC_CITY_V010.basisYawRad).toBeCloseTo(-Math.PI / 2);
    expect(LNG_CHANGHENG_V1.basisYawRad).toBe(0);
    expect(MSC_TESSA_V1.basisYawRad).toBe(0);
    expect(HYSY_981_V102.basisYawRad).toBe(0);
    expect(DREDGER_TIANJING_V101.basisYawRad).toBe(0);
    expect(DREDGER_TIANJING_V101.modelVersion).toBe('1.0.1');
    expect(DREDGER_TIANJING_V101.modelLengthMeters).toBe(120);
    expect(HYSY_981_V102.modelVersion).toBe('1.0.2');
    expect(HYSY_981_V1.modelVersion).toBe('1.0.0');
  });

  it('verifies received receipts and on-disk hashes for the six merchant packages', () => {
    for (const entry of FLEET) {
      const packageDir = path.join(process.cwd(), entry.packageRel);
      const receiptPath = path.join(process.cwd(), entry.receiptRel);
      expect(existsSync(packageDir), entry.packageRel).toBe(true);
      expect(existsSync(receiptPath), entry.receiptRel).toBe(true);
      const receiptRaw = readFileSync(receiptPath, 'utf8');
      expect(receiptRaw).not.toContain('/Users/');
      const receipt = JSON.parse(receiptRaw) as {
        schema: string;
        packageId: string;
        modelVersion: string;
        manifestSha256: string;
        sourceBlendSha256: string;
      };
      expect(receipt.schema).toBe('act-model-release-receipt/1');
      expect(receipt.packageId).toBe(entry.descriptor.packageId);
      expect(receipt.modelVersion).toBe(entry.descriptor.modelVersion);
      expect(receipt.manifestSha256).toBe(entry.descriptor.releaseManifestSha256);
      expect(receipt.sourceBlendSha256).toBe(entry.descriptor.sourceBlendSha256);
      const validated = validateReceivedModelPackage(entry.descriptor, packageIo(packageDir));
      expect(validated.packageId).toBe(entry.descriptor.packageId);
      expect(validated.manifestSha256).toBe(entry.descriptor.releaseManifestSha256);
    }
  });

  it('keeps the immutable v1.0.0 981 package beside the activated v1.0.2', () => {
    expect(existsSync(path.join(process.cwd(), 'public/assets/model-releases/hysy-981/v1.0.0'))).toBe(true);
    expect(existsSync(path.join(process.cwd(), 'artifacts/model-releases/hysy-981-v1.0.0/receipt.json'))).toBe(true);
    expect(FLEET_ACTIVE_PACKAGES['drilling-rig']).toEqual(HYSY_981_V102);
    expect(resolveVersionedDefault('drilling-rig')).toEqual({
      packageId: 'hysy-981',
      modelVersion: '1.0.2',
      baseUrl: '/assets/model-releases/hysy-981/v1.0.2',
    });
  });
});

describe('homepage preview uses activated low LOD', () => {
  it('points ship cards at activated low LOD', () => {
    const source = readFileSync(path.join(process.cwd(), 'src/app/page.tsx'), 'utf8');
    expect(source).toContain('shipLodUrlForQualityTier');
    expect(source).not.toContain('isProceduralFleetPackage');
    expect(source).toContain("homePreviewModelPath('dredger')");
    expect(source).toContain("logicalId === 'dredger' ? 'medium' : 'low'");
    expect(source).toContain("homePreviewModelPath('destroyer')");
    expect(source).not.toContain("resolveRegisteredSimulationModel('destroyer').originalUrl");
    expect(source).toContain('getShipModelPosterPath(homePreviewModelPath(logicalId))');
  });
});

describe('shared fleet mount disables frustum culling', () => {
  it('keeps the meshopt culling workaround on VersionedFleetShip', () => {
    const source = readFileSync(
      path.join(process.cwd(), 'src/resources/simulations/components/versioned-fleet-ship.tsx'),
      'utf8',
    );
    expect(source).toContain('frustumCulled = false');
    expect(source).toContain('matchActivatedFleetPackage');
    expect(source).not.toContain('createDredgerModel');
    expect(source).not.toContain('isProceduralFleetPackage');
    expect(source).toContain('-headingRad + outerYawOffsetRad');
    expect(source).toContain('Math.PI / 2');
  });
});

describe('homepage posters follow the activated package', () => {
  it('maps every activated package prefix including Tianjing v1.0.1', async () => {
    const { getShipModelPosterPath } = await import('../ship-model-assets');
    expect(getShipModelPosterPath('/assets/model-releases/type055-nanchang-101/v2.1.3/type055-nanchang-101-ship-lod2.glb')).toBe(
      '/assets/destroyer.png',
    );
    expect(getShipModelPosterPath('/assets/model-releases/lng-changheng/v1.0.0/lng-changheng-ship-lod2.glb')).toBe(
      '/assets/Lng-carrier.png',
    );
    expect(getShipModelPosterPath('/assets/model-releases/msc-tessa/v1.0.0/msc-tessa-ship-lod2.glb')).toBe(
      '/assets/container.png',
    );
    expect(getShipModelPosterPath('/assets/model-releases/xue-long-2/v0.1.1/xue-long-2-ship-lod2.glb')).toBe(
      '/assets/icebreaker.png',
    );
    expect(getShipModelPosterPath('/assets/model-releases/adora-magic-city/v0.1.0/adora-magic-city-ship-lod2.glb')).toBe(
      '/assets/luxury-liner.png',
    );
    expect(getShipModelPosterPath('/assets/model-releases/hysy-981/v1.0.2/hysy-981-ship-lod2.glb')).toBe(
      '/assets/drilling-rig.png',
    );
    expect(getShipModelPosterPath('/assets/model-releases/dredger-tianjing/v1.0.1/dredger-tianjing-ship-lod2.glb')).toBe(
      '/assets/dredger-tianjing.png',
    );
    expect(getShipModelPosterPath('/assets/dredger.glb')).toBe('/assets/dredger-tianjing.png');
    const preview = readFileSync(path.join(process.cwd(), 'src/resources/simulations/ship-model-preview.tsx'), 'utf8');
    expect(preview).toContain('useGLTF(modelPath, true, true)');
    expect(preview).toContain('useGLTF.preload(modelPath, true, true)');
    expect(preview).toContain('resolvePreviewForward');
    expect(preview).toContain('/assets/model-releases/dredger-tianjing/');
  });

  it('does not preload the legacy single-file GLB on versioned fleet scenes', () => {
    const files = [
      'drilling-simulation.tsx',
      'lng-simulation.tsx',
      'container-simulation.tsx',
      'icebreaker-simulation.tsx',
      'cruise-simulation.tsx',
      'dredger-simulation.tsx',
    ];
    for (const file of files) {
      const source = readFileSync(
        path.join(process.cwd(), 'src/resources/simulations/simulations', file),
        'utf8',
      );
      expect(source, file).not.toContain('useGLTF.preload(MODEL.primary)');
    }
  });
});
