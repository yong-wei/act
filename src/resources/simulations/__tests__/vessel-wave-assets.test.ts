import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { loadVesselWaveAssets, validateVesselWaveAsset } from '@/lib/control-engine/wasm-browser';

const configuration = { vessel: 'semisub-981', parameterVersion: 'research-nominal-v5' };

describe('981冻结波浪数据加载', () => {
  it('无关船型无需下载，关闭差频只读一阶，开启后复用一阶并读取完整差频', async () => {
    const read = vi.fn(async (asset: { path: string }) => new Uint8Array(await readFile(path.join(process.cwd(), 'public/assets', asset.path))));
    expect(await loadVesselWaveAssets({ vessel: 'cruise-adora' }, read)).toBeUndefined();
    expect(read).not.toHaveBeenCalled();
    const first = await loadVesselWaveAssets(configuration, read);
    expect(first?.firstOrderData?.byteLength).toBe(149760);
    expect(first?.fullDifferenceData).toBeUndefined();
    expect(read).toHaveBeenCalledTimes(2);
    const full = await loadVesselWaveAssets({ ...configuration, secondOrderEnabled: true }, read);
    expect(full?.firstOrderData).toBe(first?.firstOrderData);
    expect(full?.fullDifferenceData?.byteLength).toBe(60634512);
    expect(read).toHaveBeenCalledTimes(4);
  });

  it('损坏或截断数据明确拒绝，不能作为可用波浪载荷', async () => {
    await expect(validateVesselWaveAsset({ path: '/fixture', sha256: '0'.repeat(64), bytes: 2 }, new Uint8Array([1])))
      .rejects.toThrow('长度');
    await expect(validateVesselWaveAsset({ path: '/fixture', sha256: '0'.repeat(64), bytes: 2 }, new Uint8Array([1, 2])))
      .rejects.toThrow('校验');
  });
});
