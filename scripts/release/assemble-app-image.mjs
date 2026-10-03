#!/usr/bin/env node
// Assemble a prebuilt app rootfs onto the immutable runner-os image.
// This loads artifacts produced on the build machine. It does not compile source.

import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const BUNDLE_SCHEMA = 'act.app-image-bundle.v1';

function fail(message) {
  process.stderr.write(`${message}\n`);
  process.exit(1);
}

function parseArgs(argv) {
  const options = {};
  for (let index = 0; index < argv.length; index += 2) {
    const token = argv[index];
    if (!token?.startsWith('--')) fail(`无法识别的参数: ${token}`);
    const value = argv[index + 1];
    if (!value || value.startsWith('--')) fail(`缺少 ${token} 的值`);
    options[token.slice(2)] = value;
  }
  return options;
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    encoding: 'utf8',
    maxBuffer: 32 * 1024 * 1024,
    ...options,
  });
  if (result.error) fail(`${command} 无法执行: ${result.error.message}`);
  return result;
}

function podman(args) {
  const result = run('podman', args);
  if (result.status !== 0) {
    fail(`podman ${args.join(' ')} 失败\n${result.stderr || result.stdout || ''}`);
  }
  return (result.stdout || '').trim();
}

function readMeta(bundle) {
  const result = run('tar', ['-xOf', bundle, 'app-meta.json']);
  if (result.status !== 0) fail(`无法读取应用增量元数据\n${result.stderr || ''}`);
  const meta = JSON.parse(result.stdout);
  if (meta.schema !== BUNDLE_SCHEMA) fail(`应用增量包 schema 不匹配: ${meta.schema}`);
  return meta;
}

function sameList(left, right) {
  return Array.isArray(left)
    && Array.isArray(right)
    && left.length === right.length
    && left.every((item, index) => item === right[index]);
}

function quoteDockerfile(value) {
  const text = String(value);
  if (!/[\s"$`\\]/.test(text)) return text;
  return `"${text.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

function commitChanges(config) {
  const changes = [];
  if (config.User) changes.push(`USER ${config.User}`);
  for (const entry of config.Env || []) {
    const splitAt = entry.indexOf('=');
    if (splitAt <= 0) fail(`无法识别的环境变量: ${entry}`);
    changes.push(`ENV ${entry.slice(0, splitAt)}=${quoteDockerfile(entry.slice(splitAt + 1))}`);
  }
  if (config.WorkingDir) changes.push(`WORKDIR ${config.WorkingDir}`);
  if (config.Entrypoint?.length) changes.push(`ENTRYPOINT ${JSON.stringify(config.Entrypoint)}`);
  if (config.Cmd?.length) changes.push(`CMD ${JSON.stringify(config.Cmd)}`);
  for (const port of Object.keys(config.ExposedPorts || {})) {
    changes.push(`EXPOSE ${port.replace(/\/(tcp|udp)$/u, '')}`);
  }
  for (const [key, value] of Object.entries(config.Labels || {})) {
    changes.push(`LABEL ${key}=${quoteDockerfile(value)}`);
  }
  return changes;
}

function safeRelative(rel) {
  if (!rel || path.isAbsolute(rel) || rel.split(/[\\/]/u).includes('..')) {
    fail(`拒绝不安全的删除路径: ${rel}`);
  }
  return rel;
}

function extractRootfs(bundle, mountPoint) {
  const source = spawn('tar', ['-xOf', bundle, 'app-rootfs.tar.gz'], { stdio: ['ignore', 'pipe', 'inherit'] });
  const extract = spawn('tar', ['-xz', '-C', mountPoint], { stdio: ['pipe', 'inherit', 'inherit'] });
  source.stdout.pipe(extract.stdin);
  source.stdout.on('error', () => {});
  extract.stdin.on('error', () => {});
  return Promise.all([
    new Promise((resolve, reject) => {
      source.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`读取增量包失败: ${code}`))));
    }),
    new Promise((resolve, reject) => {
      extract.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`展开应用根文件系统失败: ${code}`))));
    }),
  ]);
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const bundle = options.bundle;
  const targetImage = options.image;
  const runnerOsTar = options['runner-os-tar'];
  if (!bundle || !targetImage) fail('用法: assemble-app-image.mjs --bundle <tar> --image <tag> --runner-os-tar <tar>');
  const meta = readMeta(bundle);
  const runnerOsImage = meta.runnerOsImage;
  if (!runnerOsImage) fail('应用增量包缺少运行系统镜像标签');

  if (!podmanExists(runnerOsImage)) {
    if (!runnerOsTar || !fs.existsSync(runnerOsTar)) {
      fail(`远端没有运行系统镜像 ${runnerOsImage}，且缺少镜像包 ${runnerOsTar || ''}`);
    }
    process.stdout.write(`[assemble] 装载运行系统镜像 ${runnerOsImage}\n`);
    podman(['load', '-i', runnerOsTar]);
  }
  if (!podmanExists(runnerOsImage)) {
    fail(`装载后仍没有运行系统镜像 ${runnerOsImage}`);
  }
  const actualLayers = JSON.parse(podman([
    'image', 'inspect', runnerOsImage, '--format', '{{json .RootFS.Layers}}',
  ]));
  if (!sameList(actualLayers, meta.runnerOsDiffIds)) {
    fail(
      `运行系统镜像 ${runnerOsImage} 的层与本次应用增量不一致。`
      + '不要覆盖已有标签；请确认装载的是同一次构建产出的运行系统镜像。',
    );
  }

  const name = `act-app-assemble-${process.pid}`;
  let mounted = false;
  const cleanup = () => {
    if (mounted) spawnSync('podman', ['umount', name], { stdio: 'ignore' });
    spawnSync('podman', ['rm', '-f', name], { stdio: 'ignore' });
  };
  process.on('SIGINT', () => { cleanup(); process.exit(130); });
  process.on('SIGTERM', () => { cleanup(); process.exit(143); });
  try {
    podman(['create', '--name', name, '--entrypoint', '/bin/true', runnerOsImage]);
    const mountPoint = podman(['mount', name]);
    if (!mountPoint || !path.isAbsolute(mountPoint)) fail(`podman mount 没有返回路径: ${mountPoint}`);
    mounted = true;
    await extractRootfs(bundle, mountPoint);
    for (const deletion of meta.deletions || []) {
      fs.rmSync(path.join(mountPoint, safeRelative(deletion)), { recursive: true, force: true });
    }
    const umount = run('podman', ['umount', name]);
    mounted = false;
    if (umount.status !== 0) fail(`podman umount 失败\n${umount.stderr || ''}`);
    const commitArgs = ['commit'];
    for (const change of commitChanges(meta.config || {})) {
      commitArgs.push('--change', change);
    }
    commitArgs.push(name, targetImage);
    podman(commitArgs);
  } catch (error) {
    cleanup();
    fail(error instanceof Error ? error.message : String(error));
  }
  cleanup();
  process.stdout.write(`[assemble] 已组装 ${targetImage}\n`);
}

function podmanExists(tag) {
  const result = run('podman', ['image', 'exists', tag]);
  return result.status === 0;
}

main().catch((error) => {
  fail(error instanceof Error ? error.message : String(error));
});
