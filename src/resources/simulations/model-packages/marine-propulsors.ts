import * as THREE from 'three';
import type { BindingTelemetrySource } from '../components/semantic-bindings-rig';
import type { LiveSpinBinding, VersionedModelPackageDescriptor } from './types';
import type { MarineFoamEmitter, SurfaceHistoryPose } from '../scene/water/comparison-surface-history';

/** 只读取已显示模型的语义锚点。演示 clip 只用于确定轴，不能充当推进遥测。 */
export function createMarinePropulsors(model: THREE.Object3D, animations: readonly THREE.AnimationClip[],
  descriptor: VersionedModelPackageDescriptor, telemetry: () => BindingTelemetrySource) {
  if (descriptor.propulsionAnchors) return createPublishedPropulsors(model, descriptor, telemetry);
  const forward = new THREE.Vector3(descriptor.coordinateBasis.forward === '+X' ? 1 : 0, 0,
    descriptor.coordinateBasis.forward === '+Z' ? 1 : 0);
  model.updateWorldMatrix(true, true);
  const definitions: { id: string; node: THREE.Object3D; axis: THREE.Vector3; binding?: LiveSpinBinding }[] = [];
  for (const binding of descriptor.semanticBindings ?? []) {
    if (binding.drive === 'live-spin' && !binding.cutter) {
      for (const name of binding.nodes) {
        const node = model.getObjectByName(name);
        if (node) definitions.push({ id: binding.thrusterId !== undefined ? `thruster-${binding.thrusterId}` : binding.id + ':' + name, node,
          axis: new THREE.Vector3(Number(binding.axis === 'x'), Number(binding.axis === 'y'), Number(binding.axis === 'z')), binding });
      }
    } else if (binding.drive === 'clip-loop' && binding.id.startsWith('prop')) {
      const clip = animations.find(clip => clip.name === binding.clip);
      for (const track of clip?.tracks ?? []) {
        const parsed = THREE.PropertyBinding.parseTrackName(track.name);
        if (parsed.propertyName !== 'quaternion') continue;
        const node = model.getObjectByName(parsed.nodeName);
        if (!node) continue;
        const first = new THREE.Quaternion().fromArray(track.values, 0).invert();
        let axis: THREE.Vector3 | null = null;
        for (let i = 4; i < track.values.length; i += 4) {
          const relative = first.clone().multiply(new THREE.Quaternion().fromArray(track.values, i));
          const candidate = new THREE.Vector3(relative.x, relative.y, relative.z);
          if (candidate.lengthSq() > 1e-8) { axis = candidate.normalize(); break; }
        }
        if (axis) definitions.push({ id: binding.id, node, axis });
      }
    }
  }
  // 声明节点优先；缺失节点不制造一个固定船艉发射器。
  const declared = descriptor.propulsors;
  const selected = declared?.length ? declared.flatMap(prop => {
    const found = definitions.find(item => item.node.name === prop.node);
    return found ? [{ ...found, id: prop.id }] : [];
  }) : definitions;
  const worldForward = forward.clone().transformDirection(model.matrixWorld);
  const sources = selected.map(source => {
    const worldAxis = source.axis.clone().transformDirection(source.node.matrixWorld);
    const sign = worldAxis.dot(worldForward) < 0 ? -1 : 1;
    // 仅在挂载时估算几何直径；不在每帧遍历模型。上游暂无统一桨径声明。
    const box = new THREE.Box3().setFromObject(source.node);
    const size = box.getSize(new THREE.Vector3());
    const diameter = THREE.MathUtils.clamp(Math.max(size.y, Math.min(size.x, size.z)), 0.8, 10);
    return { ...source, sign, diameter };
  });
  const origin = new THREE.Vector3(), location = new THREE.Vector3(), axis = new THREE.Vector3();
  return {
    sample(pose: SurfaceHistoryPose): readonly MarineFoamEmitter[] {
      const sim = telemetry();
      model.updateWorldMatrix(true, false);
      model.getWorldPosition(origin);
      worldForward.copy(forward).transformDirection(model.matrixWorld);
      const magnitude = Math.hypot(worldForward.x, worldForward.z) || 1;
      const fx = worldForward.x / magnitude, fz = worldForward.z / magnitude;
      const designSpeed = descriptor.telemetryScale?.designSpeedMps ?? 15;
      return sources.map(source => {
        source.node.getWorldPosition(location);
        axis.copy(source.axis).transformDirection(source.node.matrixWorld).multiplyScalar(source.sign);
        const binding = source.binding;
        const rpm = binding?.azipodSlot ? sim.azipod?.[binding.azipodSlot]?.rpm
          : binding?.thrusterId !== undefined ? sim.thrusters?.find(item => item.id === binding.thrusterId)?.rpm : undefined;
        const hasRpm = typeof rpm === 'number' && Number.isFinite(rpm);
        const ratio = hasRpm ? (sim.advancing === false ? 0 : rpm / (binding?.designRpm ?? 90)) : pose.speedMps / designSpeed;
        const dx = location.x - origin.x, dz = location.z - origin.z;
        const along = dx * fx + dz * fz, side = -dx * fz + dz * fx;
        const axisAlong = axis.x * fx + axis.z * fz, axisSide = -axis.x * fz + axis.z * fx;
        return { id: source.id, x: pose.x + Math.sin(pose.headingRad) * along - Math.cos(pose.headingRad) * side,
          z: pose.z + Math.cos(pose.headingRad) * along + Math.sin(pose.headingRad) * side,
          headingRad: pose.headingRad + Math.atan2(-axisSide, axisAlong) + (ratio < 0 ? Math.PI : 0),
          activity: Math.min(1.5, ratio * ratio), diameterMeters: source.diameter,
          depthMeters: -1 - location.y, estimated: true };
      });
    },
  };
}

/** 独立接口不依赖精模已解码；正式LOD读取节点，静态代理按相同遥测旋转声明枢轴。 */
function createPublishedPropulsors(model: THREE.Object3D, descriptor: VersionedModelPackageDescriptor,
  telemetry: () => BindingTelemetrySource) {
  model.updateWorldMatrix(true, true);
  const forward = new THREE.Vector3(descriptor.coordinateBasis.forward === '+X' ? 1 : 0, 0,
    descriptor.coordinateBasis.forward === '+Z' ? 1 : 0);
  const modelInverse = model.matrixWorld.clone().invert();
  const sources = descriptor.propulsionAnchors!.map(anchor => {
    const node = model.getObjectByName(anchor.lodNode)
      ?? model.getObjectByName(THREE.PropertyBinding.sanitizeNodeName(anchor.lodNode));
    const binding = descriptor.semanticBindings?.find((item): item is LiveSpinBinding => item.drive === 'live-spin'
      && !item.cutter && item.nodes.some(name => THREE.PropertyBinding.sanitizeNodeName(name)
        === THREE.PropertyBinding.sanitizeNodeName(anchor.lodNode)));
    const axisModel = new THREE.Vector3(...anchor.shaftAxisModel);
    const axisLocal = node ? axisModel.clone().transformDirection(modelInverse.clone().multiply(node.matrixWorld).invert()) : axisModel;
    const directionSign = axisModel.dot(forward) < 0 ? -1 : 1;
    return { anchor, node, binding, axisLocal, directionSign,
      id: binding?.thrusterId !== undefined ? `thruster-${binding.thrusterId}` : anchor.id };
  });
  const origin = new THREE.Vector3(), location = new THREE.Vector3(), axis = new THREE.Vector3(), scale = new THREE.Vector3();
  const worldForward = new THREE.Vector3();
  return {
    sample(pose: SurfaceHistoryPose): readonly MarineFoamEmitter[] {
      const sim = telemetry();
      model.updateWorldMatrix(true, false); model.getWorldPosition(origin); model.getWorldScale(scale);
      worldForward.copy(forward).transformDirection(model.matrixWorld);
      const norm = Math.hypot(worldForward.x, worldForward.z) || 1, fx = worldForward.x / norm, fz = worldForward.z / norm;
      return sources.map(({ anchor, node, binding, axisLocal, directionSign, id }) => {
        const pod = binding?.azipodSlot ? sim.azipod?.[binding.azipodSlot] : binding?.thrusterId !== undefined
          ? sim.thrusters?.find(item => item.id === binding.thrusterId) : undefined;
        if (node) {
          node.getWorldPosition(location);
          axis.copy(axisLocal).transformDirection(node.matrixWorld);
        } else {
          location.set(...anchor.positionModelM); axis.set(...anchor.shaftAxisModel);
          if (anchor.azimuthPivotModelM && anchor.azimuthAxisModel) {
            const steering = descriptor.semanticBindings?.find(item => item.drive === 'procedural' && item.id === 'pod-azimuth');
            const angle = pod?.azimuthRad ?? (steering?.drive === 'procedural'
              ? THREE.MathUtils.degToRad(steering.maxAngleDeg * (steering.sign ?? 1)
                * THREE.MathUtils.clamp(sim.rudderDeg / (descriptor.telemetryScale?.rudderLimitDeg ?? 35), -1, 1)) : 0);
            const pivot = new THREE.Vector3(...anchor.azimuthPivotModelM), yawAxis = new THREE.Vector3(...anchor.azimuthAxisModel).normalize();
            location.sub(pivot).applyAxisAngle(yawAxis, angle).add(pivot); axis.applyAxisAngle(yawAxis, angle);
          }
          location.applyMatrix4(model.matrixWorld); axis.transformDirection(model.matrixWorld);
        }
        axis.multiplyScalar(directionSign);
        const rpm = pod?.rpm, hasRpm = typeof rpm === 'number' && Number.isFinite(rpm);
        const ratio = hasRpm ? (sim.advancing === false ? 0 : rpm / (binding?.designRpm ?? 90))
          : pose.speedMps / (descriptor.telemetryScale?.designSpeedMps ?? 15);
        const dx = location.x - origin.x, dz = location.z - origin.z;
        const along = dx * fx + dz * fz, side = -dx * fz + dz * fx;
        const axisAlong = axis.x * fx + axis.z * fz, axisSide = -axis.x * fz + axis.z * fx;
        return { id, x: pose.x + Math.sin(pose.headingRad) * along - Math.cos(pose.headingRad) * side,
          z: pose.z + Math.cos(pose.headingRad) * along + Math.sin(pose.headingRad) * side,
          headingRad: pose.headingRad + Math.atan2(-axisSide, axisAlong) + (ratio < 0 ? Math.PI : 0),
          activity: Math.min(1.5, ratio * ratio), diameterMeters: anchor.diameterM * Math.abs(scale.x),
          depthMeters: -1 - location.y, estimated: true };
      });
    },
  };
}
