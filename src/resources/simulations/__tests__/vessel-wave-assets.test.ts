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

  it('教学入口只加载代表差频表，保留完整表供旧版本恢复', async () => {
    const read = vi.fn(async (asset: { path: string }) => new Uint8Array(await readFile(path.join(process.cwd(), 'public/assets', asset.path))));
    const compact = await loadVesselWaveAssets({ ...configuration, secondOrderEnabled: true, waveTableProfile: 'teaching-v1' }, read);
    expect(compact?.fullDifferenceData?.byteLength).toBe(528768);
    const metadata = JSON.parse(compact!.fullDifferenceMetadata!);
    expect(metadata.frequencies_rad_s).toHaveLength(16);
    expect(metadata.headings_rad_to).toHaveLength(9);
    expect(metadata.teaching_projection.source_data_sha256).toBe('2f1251e6c2ad163c4d6771ceec143edcc028445f7c77181ea8ff84b0fb17bb4b');
    expect(metadata.teaching_projection.amplitude_relative_tolerance).toBe(.5);
    expect(read.mock.calls.every(([asset]) => !asset.path.endsWith('/qtf-f32le.bin'))).toBe(true);
  });
  it('代表节点逐字来自冻结基线，抽取不产生新的求解数据', async () => {
    const manifest = JSON.parse(await readFile('src/lib/control-engine/semisub-wave-manifest.json', 'utf8'));
    const prefix = 'public/assets/model-releases/semisub-981-hydrodynamics/v5.0.0';
    const source = await readFile(`${prefix}/${manifest.full_difference.data_sha256}/${manifest.full_difference.data_file}`);
    const compact = await readFile(`${prefix}/${manifest.teaching_difference.data_sha256}/${manifest.teaching_difference.data_file}`);
    const originalMetadata = JSON.parse(await readFile(`${prefix}/${manifest.full_difference.data_sha256}/${manifest.full_difference.metadata_file}`, 'utf8'));
    const metadata = JSON.parse(await readFile(`${prefix}/${manifest.teaching_difference.data_sha256}/${manifest.teaching_difference.metadata_file}`, 'utf8'));
    const frequencies = metadata.teaching_projection.frequency_indices as number[];
    const headings = metadata.teaching_projection.heading_indices as number[];
    const count = originalMetadata.frequencies_rad_s.length;
    const triangle = count * (count + 1) / 2;
    let offset = 0;
    for (const firstHeading of headings) for (const secondHeading of headings) for (let channel = 0; channel < 6; channel++) {
      for (const [index, firstFrequency] of frequencies.entries()) for (const secondFrequency of frequencies.slice(0, index + 1)) {
        const sourceOffset = (((firstHeading * originalMetadata.headings_rad_to.length + secondHeading) * 6 + channel)
          * triangle + firstFrequency * (firstFrequency + 1) / 2 + secondFrequency) * 8;
        if (!compact.subarray(offset, offset + 8).equals(source.subarray(sourceOffset, sourceOffset + 8))) throw new Error('代表系数偏离冻结基线');
        offset += 8;
      }
    }
    expect(offset).toBe(compact.length);
    expect(compact.length / source.length).toBeLessThan(.01);
  });

});
