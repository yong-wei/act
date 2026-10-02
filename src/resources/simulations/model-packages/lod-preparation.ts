import { Group, Mesh, type Scene, type Camera, type Object3D, type Texture, type WebGPURenderer } from 'three/webgpu';
import { cloneSkinnedScene } from './clone-skinned-scene';
import { ossArtifactUrl, shipLodMountPlan, type VersionedModelPackageDescriptor } from './types';
import { findAnimationIndex, type SemanticGltf } from './model-interface';

const selectedUrls = new Map<string, string>();
const publicOrigins = new Map<string, Promise<boolean>>();

export function rememberShipLodUrl(descriptor: VersionedModelPackageDescriptor, url: string) {
  const artifact = Object.values(descriptor.roles).find(item => item && (item.url === url || ossArtifactUrl(item) === url));
  if (artifact) selectedUrls.set(`${artifact.sha256}:${artifact.url}`, url);
}

/** 源只在尚未消费的目标档准备时选择；同一已显示资产不换域重复下载。 */
export async function resolvePreparedShipLodUrls(descriptor: VersionedModelPackageDescriptor, tier: 'high' | 'medium' | 'low') {
  const { local, preferred } = shipLodMountPlan(descriptor, tier);
  const artifact = Object.values(descriptor.roles).find(item => item?.url === local)!;
  const remembered = selectedUrls.get(`${artifact.sha256}:${artifact.url}`);
  if (remembered) return [remembered, ...[local, preferred].filter(url => url !== remembered)];
  // 公开模型桶只允许已配置的应用Origin；开发环境直接使用同源包，避免必然失败的CORS探测。
  if (window.location.origin !== 'https://act.adapt-learn.online') return [local];
  const key = `${descriptor.packageId}:${descriptor.releaseManifestSha256}`;
  let available = publicOrigins.get(key);
  if (!available) {
    available = (async () => {
      const controller = new AbortController();
      const timer = window.setTimeout(() => controller.abort(), 1500);
      try {
        const response = await fetch(preferred, { method: 'HEAD', mode: 'cors', signal: controller.signal });
        return response.ok;
      } catch { return false; }
      finally { window.clearTimeout(timer); }
    })();
    publicOrigins.set(key, available);
  }
  return await available ? [preferred, local] : [local];
}

export function validatePreparedShipLod(descriptor: VersionedModelPackageDescriptor, json: SemanticGltf) {
  const contract = descriptor.interfaceContract;
  if (json.animations.length !== contract.shipAnimationCount
    || contract.shipInterfaceAnimations.some(name => findAnimationIndex(json, name) === null)) {
    throw new Error('Replacement ship model does not match its declared animation interface');
  }
}

/** 只准备资源，不挂控制器/语义动画；临时对象不得释放共用几何和材质。 */
export async function prepareShipLod(
  renderer: Pick<WebGPURenderer, 'compileAsync' | 'initTexture'>,
  model: Object3D,
  camera: Camera,
  scene: Scene,
  active: () => boolean,
) {
  const cloned = cloneSkinnedScene(model);
  const target = new Group();
  const textures = new Set<Texture>();
  cloned.traverse(object => {
    if (!(object instanceof Mesh)) return;
    object.castShadow = object.receiveShadow = true;
    object.frustumCulled = false;
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
      for (const value of Object.values(material)) {
        if (value && typeof value === 'object' && 'isTexture' in value && value.isTexture) textures.add(value as Texture);
      }
    }
  });
  target.add(cloned);
  try {
    for (const texture of textures) {
      await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
      if (!active()) return false;
      renderer.initTexture(texture);
    }
    if (!active()) return false;
    await renderer.compileAsync(target, camera, scene);
    return active();
  } finally {
    cloned.traverse(object => {
      if ('isSkinnedMesh' in object && object.isSkinnedMesh && 'skeleton' in object) {
        (object.skeleton as { dispose(): void }).dispose();
      }
    });
    target.clear();
  }
}
