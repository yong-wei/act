/**
 * GLB 资产 meshopt 压缩：public/assets/*.glb → public/assets/models-opt/<name>.glb
 *
 * 失败回退（fallback）：任一模型编码失败时，manifest 将该模型标记为
 * fallback-original，运行时回退到原始 GLB；其余模型不受影响。
 * 接入构建链路：npm run build 中 prisma generate 之后、next build 之前执行。
 */
import { mkdir, readdir, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { meshopt } from '@gltf-transform/functions';
import { MeshoptEncoder } from 'meshoptimizer';

const SOURCE_DIR = path.join(process.cwd(), 'public/assets');
const OUTPUT_DIR = path.join(SOURCE_DIR, 'models-opt');
const MANIFEST_PATH = path.join(OUTPUT_DIR, 'manifest.json');

async function main() {
  await mkdir(OUTPUT_DIR, { recursive: true });
  const models = (await readdir(SOURCE_DIR))
    .filter((name) => name.endsWith('.glb'))
    .sort();

  const manifest = { models: {} };
  await MeshoptEncoder.ready;
  const io = new NodeIO()
    .registerExtensions(ALL_EXTENSIONS)
    .registerDependencies({ 'meshopt.encoder': MeshoptEncoder });

  for (const name of models) {
    const sourcePath = path.join(SOURCE_DIR, name);
    const outputPath = path.join(OUTPUT_DIR, name);
    const sourceSize = (await stat(sourcePath)).size;
    try {
      const document = await io.read(sourcePath);
      await document.transform(meshopt({ encoder: MeshoptEncoder, level: 'medium' }));
      await io.write(outputPath, document);
      const outputSize = (await stat(outputPath)).size;
      manifest.models[name] = {
        status: 'meshopt',
        url: `/assets/models-opt/${name}`,
        sourceBytes: sourceSize,
        optimizedBytes: outputSize,
      };
      console.log(`[models:optimize] ${name}: ${(sourceSize / 1e6).toFixed(1)}MB → ${(outputSize / 1e6).toFixed(1)}MB`);
    } catch (error) {
      // fallback：编码失败时保留原始 GLB 并在 manifest 记录，不阻断构建。
      manifest.models[name] = {
        status: 'fallback-original',
        url: `/assets/${name}`,
        sourceBytes: sourceSize,
        error: error instanceof Error ? error.message : String(error),
      };
      console.warn(`[models:optimize] ${name}: meshopt failed, fallback to original (${manifest.models[name].error})`);
    }
  }

  await writeFile(MANIFEST_PATH, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  console.log(`[models:optimize] manifest written for ${models.length} model(s)`);
}

await main();
