/**
 * 版本化模型包的 ACT 侧验证器。
 *
 * `validateReceivedModelPackage` 核验候选目录内描述符声明的完整角色分母（存在性、大小、
 * SHA-256、角色唯一）；任一漂移拒绝整个包，不登记部分通过的子集。
 * `validateModelPackageInterface` 在解析 GLB JSON 后核验语义接口契约：
 * 动画数量/唯一性/目标节点可达、演示片段名、装填实例数与透明贴花。
 *
 * 名字解析只允许稳定语义名与 extras，禁止 glTF 数组索引或 Blender 自动后缀。
 */

import type { VersionedModelArtifact, VersionedModelPackageDescriptor, VersionedModelRole } from './types';

export interface ModelPackageFileIo {
  /** 候选目录内相对文件的 SHA-256 摘要（hex）；由调用方环境提供（Node 用 node:crypto）。 */
  readonly sha256: (relativeFile: string) => string;
  readonly sizeOf: (relativeFile: string) => number;
  /** 候选目录内存在的相对文件清单（含 manifest）。 */
  readonly listFiles: () => readonly string[];
}

export interface PackageIntegrityReceipt {
  readonly packageId: string;
  readonly modelVersion: string;
  readonly roles: Readonly<Record<VersionedModelRole, { sha256: string; bytes: number }>>;
  readonly manifestSha256: string;
}

const SHA256_PATTERN = /^[0-9a-f]{64}$/;
const BLENDER_SUFFIX_PATTERN = /\.\d{3}$/;

export function parseGlbJsonChunk(bytes: Uint8Array): Record<string, unknown> {
  const magic = String.fromCharCode(bytes[0], bytes[1], bytes[2], bytes[3]);
  if (magic !== 'glTF') throw new Error('not-a-glb');
  const jsonLength = bytes[12] | (bytes[13] << 8) | (bytes[14] << 16) | (bytes[15] << 24);
  const jsonType = bytes[16] | (bytes[17] << 8) | (bytes[18] << 16) | (bytes[19] << 24);
  // glTF 2.0 GLB 首块 chunkType=0x4E4F534A ('JSON' 小端)
  if (jsonType !== 0x4e4f534a) throw new Error(`missing-json-chunk:0x${jsonType.toString(16)}`);
  const jsonBytes = bytes.subarray(20, 20 + jsonLength);
  return JSON.parse(new TextDecoder().decode(jsonBytes)) as Record<string, unknown>;
}

function requireValidArtifact(role: VersionedModelRole, artifact: VersionedModelArtifact): void {
  if (artifact.role !== role) throw new Error(`role-mismatch:${role}:${artifact.role}`);
  if (!SHA256_PATTERN.test(artifact.sha256)) throw new Error(`invalid-sha256:${role}`);
  if (!Number.isInteger(artifact.bytes) || artifact.bytes <= 0) throw new Error(`invalid-bytes:${role}`);
}

export function validateReceivedModelPackage(
  descriptor: VersionedModelPackageDescriptor,
  io: ModelPackageFileIo,
): PackageIntegrityReceipt {
  if (!descriptor.roles) throw new Error('missing-role-denominator');
  const roles = Object.values(descriptor.roles);
  const files = new Set(roles.map((artifact) => artifact.file));
  if (roles.length === 0 || files.size !== roles.length) throw new Error('incomplete-role-denominator');
  if (!roles.every((artifact) => artifact.url.startsWith(`${descriptor.baseUrl}/`))) {
    throw new Error('artifact-outside-package-directory');
  }
  for (const [role, artifact] of Object.entries(descriptor.roles) as [VersionedModelRole, VersionedModelArtifact][]) {
    requireValidArtifact(role, artifact);
    if (!io.listFiles().includes(artifact.file)) throw new Error(`missing-file:${artifact.file}`);
    if (io.sizeOf(artifact.file) !== artifact.bytes) throw new Error(`size-mismatch:${artifact.file}`);
    const digest = io.sha256(artifact.file);
    if (digest !== artifact.sha256) throw new Error(`sha-mismatch:${artifact.file}`);
  }
  const manifestDigest = io.sha256('manifest.json');
  if (manifestDigest !== descriptor.releaseManifestSha256) throw new Error('manifest-sha-mismatch');
  // 分母封闭：候选目录只允许 manifest + 已登记角色文件 + 内容寻址 textures/<sha>.png。
  const declared = new Set([...files, 'manifest.json']);
  const textureSidecar = /^textures\/[0-9a-f]{64}\.png$/;
  for (const present of io.listFiles()) {
    if (textureSidecar.test(present)) {
      const digest = present.slice('textures/'.length, -'.png'.length);
      if (io.sha256(present) !== digest) throw new Error(`texture-sha-mismatch:${present}`);
      continue;
    }
    if (!declared.has(present)) throw new Error(`undeclared-file:${present}`);
  }
  return {
    packageId: descriptor.packageId,
    modelVersion: descriptor.modelVersion,
    manifestSha256: manifestDigest,
    roles: Object.fromEntries(
      Object.entries(descriptor.roles).map(([role, artifact]) => [role, { sha256: artifact.sha256, bytes: artifact.bytes }]),
    ) as PackageIntegrityReceipt['roles'],
  };
}

// ---- 语义接口验证（GLB JSON 层） ----

interface GltfNode { readonly name?: unknown; readonly children?: unknown }
interface GltfAnimation {
  readonly name?: unknown;
  readonly channels?: readonly { readonly target?: { readonly node?: unknown } }[];
}
interface GltfJson {
  readonly nodes?: readonly GltfNode[];
  readonly animations?: readonly GltfAnimation[];
  readonly images?: readonly { name?: unknown; mimeType?: unknown }[];
  readonly scenes?: readonly { nodes?: unknown }[];
}

function asGltfJson(value: Record<string, unknown>): GltfJson {
  return value as GltfJson;
}

function reachableNodeIndices(json: GltfJson): Set<number> {
  const nodes = json.nodes ?? [];
  const reachable = new Set<number>();
  const stack: number[] = [];
  for (const root of (json.scenes?.[0]?.nodes as number[] | undefined) ?? []) stack.push(root);
  while (stack.length > 0) {
    const index = stack.pop();
    if (index === undefined || reachable.has(index) || index < 0 || index >= nodes.length) continue;
    reachable.add(index);
    for (const child of nodes[index].children as number[] | undefined ?? []) stack.push(child);
  }
  return reachable;
}

function nodeName(json: GltfJson, index: number): string {
  return String(json.nodes?.[index]?.name ?? '');
}

export interface InterfaceViolation { readonly kind: string; readonly detail: string }

/**
 * 校验语义接口契约。`glbJson` 键为角色名；仅需要被校验的角色提供。
 * 返回违规清单（空 = 通过）；调用方对非空清单 fail closed。
 */
export function validateModelPackageInterface(
  descriptor: VersionedModelPackageDescriptor,
  glbJson: Readonly<Partial<Record<VersionedModelRole, Record<string, unknown>>>>,
): InterfaceViolation[] {
  const violations: InterfaceViolation[] = [];
  const contract = descriptor.interfaceContract;

  for (const lodRole of ['ship-lod0', 'ship-lod1', 'ship-lod2'] as const) {
    const raw = glbJson[lodRole];
    if (!raw) {
      violations.push({ kind: 'missing-role', detail: lodRole });
      continue;
    }
    const json = asGltfJson(raw);
    const animations = json.animations ?? [];
    const names = animations.map((clip) => String(clip.name ?? ''));
    if (names.length !== contract.shipAnimationCount) {
      violations.push({ kind: 'ship-animation-count', detail: `${lodRole}:${names.length}` });
    }
    if (new Set(names).size !== names.length) {
      violations.push({ kind: 'ship-animation-duplicate', detail: lodRole });
    }
    const reachable = reachableNodeIndices(json);
    const nodeCount = json.nodes?.length ?? 0;
    for (let i = 0; i < animations.length; i += 1) {
      const clip = animations[i];
      for (const channel of clip.channels ?? []) {
        const target = channel.target?.node;
        if (typeof target !== 'number' || !reachable.has(target)) {
          violations.push({ kind: 'animation-target-unreachable', detail: `${lodRole}:${names[i] || i}` });
        }
      }
    }
    if (nodeCount > 0 && reachable.size === 0) {
      violations.push({ kind: 'scene-root-empty', detail: lodRole });
    }
    for (const required of contract.shipInterfaceAnimations) {
      if (!names.includes(required)) violations.push({ kind: 'interface-animation-missing', detail: `${lodRole}:${required}` });
      if (BLENDER_SUFFIX_PATTERN.test(required)) violations.push({ kind: 'blender-suffix-name', detail: required });
    }
    const imageNames = (json.images ?? []).map((image) => String(image.name ?? ''));
    for (const decal of contract.decalImages) {
      if (!imageNames.includes(decal)) violations.push({ kind: 'decal-image-missing', detail: `${lodRole}:${decal}` });
    }
    for (const image of json.images ?? []) {
      if (contract.decalImages.includes(String(image.name ?? '')) && image.mimeType !== 'image/png') {
        violations.push({ kind: 'decal-not-png', detail: `${lodRole}:${String(image.name)}` });
      }
    }
  }

  const demoRaw = glbJson.demo;
  if (contract.demoAnimations.length > 0 || descriptor.roles?.demo) {
    if (!demoRaw) {
      violations.push({ kind: 'missing-role', detail: 'demo' });
    } else {
      const demoNames = (asGltfJson(demoRaw).animations ?? []).map((clip) => String(clip.name ?? ''));
      const expected = [...contract.demoAnimations].sort().join('|');
      if (demoNames.length !== contract.demoAnimations.length || [...demoNames].sort().join('|') !== expected) {
        violations.push({ kind: 'demo-animation-set', detail: demoNames.sort().join('|') });
      }
    }
  }

  const payloadRaw = glbJson.payload;
  const requiresPayload = contract.vlsLoadedCount > 0 || contract.hq10LoadedCount > 0 || Boolean(descriptor.roles?.payload);
  if (!requiresPayload) {
    return violations;
  }
  if (!payloadRaw) {
    violations.push({ kind: 'missing-role', detail: 'payload' });
  } else {
    const json = asGltfJson(payloadRaw);
    const names = (json.nodes ?? []).map((node) => String(node.name ?? ''));
    const vls = names.filter((name) => /^VLS_.*_LOADED_MISSILE$/.test(name));
    const hq10 = names.filter((name) => /^HQ10_R\d+_C\d+_LOADED_MISSILE$/.test(name));
    if (vls.length !== contract.vlsLoadedCount) {
      violations.push({ kind: 'vls-loaded-count', detail: String(vls.length) });
    }
    if (hq10.length !== contract.hq10LoadedCount) {
      violations.push({ kind: 'hq10-loaded-count', detail: String(hq10.length) });
    }
    const templates = names.filter((name) => /^MUNITION_.*_TEMPLATE$/.test(name));
    if (templates.length === 0) violations.push({ kind: 'munition-template-missing', detail: '' });
    for (const name of names) {
      if (BLENDER_SUFFIX_PATTERN.test(name)) violations.push({ kind: 'blender-suffix-name', detail: name });
    }
  }

  return violations;
}
