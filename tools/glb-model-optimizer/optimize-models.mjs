/**
 * GLB 资产 meshopt 压缩：源目录中的 *.glb → 输出目录中的同名文件。
 *
 * 任一模型编码失败时，manifest 将该模型标记为 fallback-original 供生产诊断；
 * 其余模型继续处理，但命令最终失败，禁止发布部分成功的产物集。
 */
import { mkdir, mkdtemp, readdir, rename, rm, stat, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { meshopt } from '@gltf-transform/functions';
import { MeshoptEncoder } from 'meshoptimizer';

function readDirectoryArgument(name) {
  const index = process.argv.indexOf(name);
  const value = index >= 0 ? process.argv[index + 1] : undefined;
  if (!value || value.startsWith('--')) {
    throw new Error(`Missing required ${name} directory`);
  }
  return path.resolve(process.cwd(), value);
}

const sourceDir = readDirectoryArgument('--source');
const outputDir = readDirectoryArgument('--output');
const failedManifestPath = path.join(
  path.dirname(outputDir),
  `${path.basename(outputDir)}.failed-manifest.json`,
);
const inProgressPath = path.join(
  path.dirname(outputDir),
  `${path.basename(outputDir)}.in-progress.json`,
);

async function replaceOutputDirectory(stagingDir) {
  const backupDir = `${outputDir}.previous-${process.pid}-${Date.now()}`;
  let previousOutputExists = false;
  try {
    await rename(outputDir, backupDir);
    previousOutputExists = true;
  } catch (error) {
    if (!(error instanceof Error && 'code' in error && error.code === 'ENOENT')) {
      throw error;
    }
  }

  try {
    await rename(stagingDir, outputDir);
  } catch (error) {
    if (previousOutputExists) {
      await rename(backupDir, outputDir);
    }
    throw error;
  }

  if (previousOutputExists) {
    await rm(backupDir, { recursive: true, force: true });
  }
  await rm(failedManifestPath, { force: true });
  await rm(inProgressPath, { force: true });
}

async function main() {
  await mkdir(path.dirname(outputDir), { recursive: true });
  await writeFile(
    inProgressPath,
    `${JSON.stringify({ pid: process.pid, startedAt: new Date().toISOString() })}\n`,
    'utf8',
  );
  const stagingDir = await mkdtemp(
    path.join(path.dirname(outputDir), `.${path.basename(outputDir)}-staging-`),
  );
  const models = (await readdir(sourceDir))
    .filter((name) => name.endsWith('.glb'))
    .sort();

  const manifest = { models: {} };
  const failures = [];
  await MeshoptEncoder.ready;
  const io = new NodeIO()
    .registerExtensions(ALL_EXTENSIONS)
    .registerDependencies({ 'meshopt.encoder': MeshoptEncoder });

  for (const name of models) {
    const sourcePath = path.join(sourceDir, name);
    const outputPath = path.join(stagingDir, name);
    const sourceSize = (await stat(sourcePath)).size;
    const sourceSha256 = createHash('sha256')
      .update(await readFile(sourcePath))
      .digest('hex');
    try {
      const document = await io.read(sourcePath);
      await document.transform(meshopt({ encoder: MeshoptEncoder, level: 'medium' }));
      await io.write(outputPath, document);
      const outputSize = (await stat(outputPath)).size;
      const outputSha256 = createHash('sha256').update(await readFile(outputPath)).digest('hex');
      manifest.models[name] = {
        status: 'meshopt',
        url: `/assets/models-opt/${name}`,
        sourceBytes: sourceSize,
        sourceSha256,
        optimizedBytes: outputSize,
        outputSha256,
        optimizerName: '@act/glb-model-optimizer',
        optimizerVersion: '1.0.0',
        optimizerLevel: 'medium',
        optimizerConfigDigest: createHash('sha256')
          .update(`${createHash('sha256').update(await readFile(new URL(import.meta.url))).digest('hex')}\nmedium\n`)
          .digest('hex'),
      };
      console.log(`[models:produce] ${name}: ${(sourceSize / 1e6).toFixed(1)}MB → ${(outputSize / 1e6).toFixed(1)}MB`);
    } catch (error) {
      failures.push(name);
      manifest.models[name] = {
        status: 'fallback-original',
        url: `/assets/${name}`,
        sourceBytes: sourceSize,
        sourceSha256,
        error: error instanceof Error ? error.message : String(error),
      };
      console.warn(`[models:produce] ${name}: meshopt failed, fallback to original (${manifest.models[name].error})`);
    }
  }

  if (failures.length > 0) {
    await writeFile(failedManifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
    await rm(stagingDir, { recursive: true, force: true });
    await rm(inProgressPath, { force: true });
    throw new Error(`Failed to produce ${failures.length} optimized model(s): ${failures.join(', ')}`);
  }

  await writeFile(
    path.join(stagingDir, 'manifest.json'),
    `${JSON.stringify(manifest, null, 2)}\n`,
    'utf8',
  );
  await replaceOutputDirectory(stagingDir);
  console.log(`[models:produce] published ${models.length} model(s) with a complete manifest`);
}

await main();
