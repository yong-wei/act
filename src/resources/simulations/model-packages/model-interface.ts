/**
 * 版本化模型包的运行时语义接口。
 *
 * 绑定只允许稳定语义名（节点名/动画名/extras），禁止 glTF 数组索引与
 * Blender 自动后缀。武器载荷与演示片段属于独立生命周期：仅由明确消费者
 * 延迟加载；弹药模板运行时克隆生成、寿命到期销毁，不进入主舰常驻节点。
 */

export interface SemanticGltf {
  readonly animations: readonly { readonly name?: unknown }[];
  readonly nodes: readonly { readonly name?: unknown; readonly extras?: unknown }[];
}

function namedAnimations(gltf: SemanticGltf): string[] {
  return gltf.animations.map((clip) => String(clip.name ?? ''));
}

/** 按名称解析动画；缺失或重名都算接口失败（返回 null），调用方不得静默降级。 */
export function findAnimationIndex(gltf: SemanticGltf, animationName: string): number | null {
  const hits = namedAnimations(gltf)
    .map((name, index) => (name === animationName ? index : -1))
    .filter((index) => index >= 0);
  return hits.length === 1 ? hits[0] : null;
}

/** 按名称解析节点；缺失或重名返回 null。 */
export function findNodeIndices(gltf: SemanticGltf, nodeName: string): number[] {
  return gltf.nodes
    .map((node, index) => (String(node.name ?? '') === nodeName ? index : -1))
    .filter((index) => index >= 0);
}

export function findNodeIndex(gltf: SemanticGltf, nodeName: string): number | null {
  const hits = findNodeIndices(gltf, nodeName);
  return hits.length === 1 ? hits[0] : null;
}

/** 按 extras.component_id 唯一解析节点（接口元数据通道）。 */
export function findNodeByComponentId(gltf: SemanticGltf, componentId: string): number | null {
  const hits = gltf.nodes
    .map((node, index) => {
      const extras = node.extras as { component_id?: unknown } | undefined;
      return extras?.component_id === componentId ? index : -1;
    })
    .filter((index) => index >= 0);
  return hits.length === 1 ? hits[0] : null;
}

/** 弹药模板节点名（MUNITION_*_TEMPLATE）：运行时按需克隆的生成源。 */
export function listMunitionTemplateNames(gltf: SemanticGltf): string[] {
  return gltf.nodes
    .map((node) => String(node.name ?? ''))
    .filter((name) => /^MUNITION_.*_TEMPLATE$/.test(name));
}

/** 装填实例节点名（VLS/HQ-10 已装填弹药）。 */
export function listLoadedInstanceNames(gltf: SemanticGltf): { vls: string[]; hq10: string[] } {
  const names = gltf.nodes.map((node) => String(node.name ?? ''));
  return {
    vls: names.filter((name) => /^VLS_.*_LOADED_MISSILE$/.test(name)),
    hq10: names.filter((name) => /^HQ10_R\d+_C\d+_LOADED_MISSILE$/.test(name)),
  };
}
