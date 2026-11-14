import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { Matrix4, Vector3 } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';

const { values } = parseArgs({ options: {
  release: { type: 'string' }, extraction: { type: 'string' }, output: { type: 'string' },
} });
if (!values.release || !values.extraction || !values.output) throw new Error('需要release、extraction和output');
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const manifest = JSON.parse(await readFile(path.join(values.release, 'manifest.json')));
const bytes = await readFile(path.join(values.release, manifest.artifacts['ship-lod0'].file));
const proof = JSON.parse(await readFile(path.join(values.extraction, 'source.json')));
if (sha256(bytes) !== proof.sourceSha256) throw new Error('独立对照的GLB身份不一致');
const jsonLength = bytes.readUInt32LE(12);
const source = JSON.parse(bytes.subarray(20, 20 + jsonLength));
// 保留全部几何与变换，材质从本次数值对照中移除以免触发图像解码或网络读取。
delete source.images;
delete source.textures;
delete source.materials;
for (const mesh of source.meshes) for (const primitive of mesh.primitives) delete primitive.material;
const jsonBytes = Buffer.from(JSON.stringify(source));
const paddedLength = Math.ceil(jsonBytes.length / 4) * 4;
const binaryChunk = bytes.subarray(20 + jsonLength);
const document = Buffer.alloc(20 + paddedLength + binaryChunk.length, 0x20);
document.writeUInt32LE(0x46546c67, 0);
document.writeUInt32LE(2, 4);
document.writeUInt32LE(document.length, 8);
document.writeUInt32LE(paddedLength, 12);
document.writeUInt32LE(0x4e4f534a, 16);
jsonBytes.copy(document, 20);
binaryChunk.copy(document, 20 + paddedLength);
const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
const loaded = await loader.parseAsync(document.buffer.slice(document.byteOffset, document.byteOffset + document.byteLength), '');
loaded.scene.updateMatrixWorld(true);
loaded.scene.traverse((node) => { if (node.isSkinnedMesh) node.skeleton.update(); });
const selected = new Set(proof.selections.map((selection) => selection.nodeIndex));
const statistics = () => ({ count: 0, sum: [0, 0, 0], min: [Infinity, Infinity, Infinity], max: [-Infinity, -Infinity, -Infinity] });
const expected = statistics();
const add = (target, point) => {
  target.count += 1;
  const coordinates = point.toArray();
  for (let axis = 0; axis < 3; axis += 1) {
    target.sum[axis] += coordinates[axis];
    target.min[axis] = Math.min(target.min[axis], coordinates[axis]);
    target.max[axis] = Math.max(target.max[axis], coordinates[axis]);
  }
};
loaded.scene.traverse((node) => {
  if (!node.isMesh) return;
  let owner = node;
  while (owner && loaded.parser.associations.get(owner)?.nodes === undefined) owner = owner.parent;
  const nodeIndex = owner && loaded.parser.associations.get(owner)?.nodes;
  if (!selected.has(nodeIndex)) return;
  for (let instance = 0; instance < (node.isInstancedMesh ? node.count : 1); instance += 1) {
    const transform = new Matrix4();
    if (node.isInstancedMesh) node.getMatrixAt(instance, transform);
    transform.premultiply(node.matrixWorld);
    for (let index = 0; index < node.geometry.attributes.position.count; index += 1) {
      add(expected, node.getVertexPosition(index, new Vector3()).applyMatrix4(transform));
    }
  }
});
const extracted = await readFile(path.join(values.extraction, 'vertices.f64'));
if (sha256(extracted) !== proof.outputSha256['vertices.f64']) throw new Error('提取结果字节漂移');
const actual = statistics();
for (let offset = 0; offset < extracted.length; offset += 24) {
  add(actual, new Vector3(extracted.readDoubleLE(offset), extracted.readDoubleLE(offset + 8), extracted.readDoubleLE(offset + 16)));
}
const errors = Object.fromEntries(['sum', 'min', 'max'].map((name) => [name,
  Math.max(...expected[name].map((value, axis) => Math.abs(actual[name][axis] - value) / Math.max(1, Math.abs(value))))]));
const passed = expected.count === actual.count && Object.values(errors).every((value) => value < 1e-6);
const result = { schema: 'act.visual-mesh-independent-validation.v1', status: passed ? 'passed' : 'failed',
  source_sha256: proof.sourceSha256, extractor_sha256: proof.generatorSha256,
  validator_sha256: sha256(await readFile(new URL(import.meta.url))),
  reference_loader_sha256: sha256(await readFile(new URL(import.meta.resolve('three/examples/jsm/loaders/GLTFLoader.js')))),
  expected, actual, relative_errors: errors, relative_tolerance: 1e-6 };
await writeFile(values.output, JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify({ status: result.status, count: actual.count, relative_errors: errors }));
if (!passed) process.exitCode = 1;
