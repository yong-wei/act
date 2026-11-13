import { createHash } from 'node:crypto';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { Matrix4, Quaternion, Vector3 } from 'three';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';

const { values } = parseArgs({ options: {
  release: { type: 'string' }, node: { type: 'string', multiple: true }, output: { type: 'string' },
} });
if (!values.release || !values.node?.length || !values.output) {
  throw new Error('需要--release、至少一个--node和--output');
}
const digest = (bytes) => createHash('sha256').update(bytes).digest('hex');
const manifestBytes = await readFile(path.join(values.release, 'manifest.json'));
const manifest = JSON.parse(manifestBytes);
const artifact = manifest.artifacts['ship-lod0'];
const source = await readFile(path.join(values.release, artifact.file));
if (digest(source) !== artifact.sha256 || source.length !== artifact.bytes) {
  throw new Error('GLB与版本清单不一致');
}
if (source.readUInt32LE(0) !== 0x46546c67 || source.readUInt32LE(4) !== 2
    || source.readUInt32LE(8) !== source.length) throw new Error('GLB头无效');
const jsonLength = source.readUInt32LE(12);
const gltf = JSON.parse(source.subarray(20, 20 + jsonLength).toString('utf8'));
const binaryOffset = 20 + jsonLength + 8;
const binary = source.subarray(binaryOffset);
await MeshoptDecoder.ready;
const decodedViews = new Map();
function bufferView(index) {
  if (decodedViews.has(index)) return decodedViews.get(index);
  const view = gltf.bufferViews[index];
  const compressed = view.extensions?.EXT_meshopt_compression;
  let bytes;
  if (compressed) {
    if (compressed.buffer !== 0) throw new Error('压缩数据使用未知缓冲区');
    bytes = Buffer.alloc(compressed.count * compressed.byteStride);
    MeshoptDecoder.decodeGltfBuffer(bytes, compressed.count, compressed.byteStride,
      binary.subarray(compressed.byteOffset, compressed.byteOffset + compressed.byteLength),
      compressed.mode, compressed.filter ?? 'NONE');
  } else {
    if (view.buffer !== 0) throw new Error('GLB包含外部缓冲区');
    bytes = binary.subarray(view.byteOffset ?? 0, (view.byteOffset ?? 0) + view.byteLength);
  }
  decodedViews.set(index, bytes);
  return bytes;
}
function accessor(index) {
  const definition = gltf.accessors[index];
  if (definition.sparse || definition.normalized) throw new Error('需要显式处理稀疏/归一化属性');
  const components = { SCALAR: 1, VEC3: 3 }[definition.type];
  const format = { 5126: [4, 'readFloatLE'], 5125: [4, 'readUInt32LE'],
    5123: [2, 'readUInt16LE'], 5121: [1, 'readUInt8'] }[definition.componentType];
  if (!format || !components) throw new Error('网格属性类型未覆盖');
  const view = gltf.bufferViews[definition.bufferView];
  const stride = view.byteStride ?? view.extensions?.EXT_meshopt_compression?.byteStride ?? components * format[0];
  const bytes = bufferView(definition.bufferView);
  const output = new Array(definition.count * components);
  for (let row = 0; row < definition.count; row += 1) {
    for (let axis = 0; axis < components; axis += 1) {
      output[row * components + axis] = bytes[format[1]]((definition.byteOffset ?? 0) + row * stride + axis * format[0]);
    }
  }
  if (output.some((value) => !Number.isFinite(value))) throw new Error('网格含非有限坐标');
  return output;
}

const vertices = [];
const triangles = [];
const selections = [];
const names = new Set(values.node);
function visit(index, parentMatrix) {
  const node = gltf.nodes[index];
  const local = node.matrix ? new Matrix4().fromArray(node.matrix) : new Matrix4().compose(
    new Vector3().fromArray(node.translation ?? [0, 0, 0]),
    new Quaternion().fromArray(node.rotation ?? [0, 0, 0, 1]),
    new Vector3().fromArray(node.scale ?? [1, 1, 1]),
  );
  const world = new Matrix4().multiplyMatrices(parentMatrix, local);
  if (names.has(node.name)) {
    const mesh = gltf.meshes[node.mesh];
    if (!mesh) throw new Error(`所选节点缺少网格 ${node.name}`);
    const offset = vertices.length / 3;
    for (const primitive of mesh.primitives) {
      if ((primitive.mode ?? 4) !== 4) throw new Error('所选表面包含非三角图元');
      const points = accessor(primitive.attributes.POSITION);
      const primitiveOffset = vertices.length / 3;
      for (let point = 0; point < points.length; point += 3) {
        const coordinate = new Vector3(points[point], points[point + 1], points[point + 2]).applyMatrix4(world);
        vertices.push(coordinate.x, coordinate.y, coordinate.z);
      }
      const indices = primitive.indices === undefined ? Array.from({ length: points.length / 3 }, (_, i) => i)
        : accessor(primitive.indices);
      if (indices.length % 3 || indices.some((i) => i < 0 || i >= points.length / 3)) throw new Error('三角索引越界');
      for (const index of indices) triangles.push(index + primitiveOffset);
    }
    selections.push({ node: node.name, nodeIndex: index, mesh: node.mesh,
      firstVertex: offset, vertexCount: vertices.length / 3 - offset, worldMatrix: world.toArray() });
  }
  for (const child of node.children ?? []) visit(child, world);
}
for (const root of gltf.scenes[gltf.scene ?? 0].nodes) visit(root, new Matrix4());
if (selections.length !== names.size) throw new Error('所选节点存在缺失或重名');
await mkdir(values.output, { recursive: true });
const pointBytes = Buffer.from(new Float64Array(vertices).buffer);
const triangleBytes = Buffer.from(new Uint32Array(triangles).buffer);
await writeFile(path.join(values.output, 'vertices.f64'), pointBytes);
await writeFile(path.join(values.output, 'triangles.u32'), triangleBytes);
const proof = {
  schema: 'act.visual-hull-extraction.v1', sourceRelease: manifest.sourceRelease,
  sourceCommit: manifest.sourceCommit, sourceSha256: digest(source),
  manifestSha256: digest(manifestBytes), generatorSha256: digest(await readFile(new URL(import.meta.url))),
  decoderSha256: digest(await readFile(new URL(import.meta.resolve('three/examples/jsm/libs/meshopt_decoder.module.js')))),
  coordinateBasis: manifest.coordinateBasis, modelToSceneMatrix: manifest.modelToSceneMatrix,
  vertices: vertices.length / 3, triangles: triangles.length / 3, selections,
  byteOrder: 'little-endian', outputSha256: { 'vertices.f64': digest(pointBytes), 'triangles.u32': digest(triangleBytes) },
};
await writeFile(path.join(values.output, 'source.json'), JSON.stringify(proof, null, 2) + '\n');
console.log(JSON.stringify({ vertices: proof.vertices, triangles: proof.triangles, sourceSha256: proof.sourceSha256 }));
