import { createHash } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';

/** 镜像保留已校验的公开数据副本，浏览器优先经ESA读取相同内容。 */
export async function prepareVesselWaveAssets(root) {
  const manifest = JSON.parse(await readFile(path.join(root, 'src/lib/control-engine/semisub-wave-manifest.json'), 'utf8'));
  const prefix = 'model-releases/semisub-981-hydrodynamics/v5.0.0';
  for (const entry of [manifest.first_order, manifest.full_difference, manifest.teaching_difference]) {
    for (const [name, expected] of [[entry.metadata_file, entry.metadata_sha256], [entry.data_file, entry.data_sha256]]) {
      const key = `${prefix}/${entry.data_sha256}/${name}`;
      const destination = path.join(root, 'public/assets', key);
      let bytes;
      try { bytes = await readFile(destination); }
      catch (error) { if (error.code !== 'ENOENT') throw error; }
      if (!bytes) {
        const response = await fetch(`https://static.adapt-learn.online/${key}`, { signal: AbortSignal.timeout(60_000) });
        if (!response.ok) throw new Error(`Hydrodynamic asset unavailable (${response.status}) ${key}`);
        bytes = Buffer.from(await response.arrayBuffer());
      }
      if (createHash('sha256').update(bytes).digest('hex') !== expected) throw new Error(`Hydrodynamic checksum mismatch ${key}`);
      await mkdir(path.dirname(destination), { recursive: true });
      const temporary = `${destination}.${process.pid}.tmp`;
      await writeFile(temporary, bytes);
      await rename(temporary, destination);
    }
  }
}
