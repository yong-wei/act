import { BufferGeometry, Float32BufferAttribute } from 'three';

export const SHIP_SURFACE_CELL_METERS = 2;

/** 单一网格：船周细化，粗细边界共享顶点，没有重叠水面或 T 接缝。 */
export function createMarineSurfaceGeometry(domain: number, backgroundResolution: number) {
  const half = domain / 2;
  const levels = [
    { extent: Math.min(384, half), cell: SHIP_SURFACE_CELL_METERS },
    { extent: Math.min(512, half), cell: 4 },
    { extent: half, cell: Math.max(4, domain / backgroundResolution) },
  ].filter((level, i, all) => i === 0 || level.extent > all[i - 1].extent);
  const positions: number[] = [], indices: number[] = [], vertices = new Map<string, number>();
  const vertex = (x: number, z: number) => {
    const key = x + ':' + z;
    const old = vertices.get(key);
    if (old !== undefined) return old;
    const id = positions.length / 3; vertices.set(key, id); positions.push(x, 0, z); return id;
  };
  for (let level = 0; level < levels.length; level++) {
    const { extent, cell } = levels[level];
    const inner = level ? levels[level - 1].extent : 0;
    const fine = level ? levels[level - 1].cell : cell;
    for (let z = -extent; z < extent; z += cell) for (let x = -extent; x < extent; x += cell) {
      if (inner && x >= -inner && x < inner && z >= -inner && z < inner) continue;
      const corners = [[x, z], [x, z + cell], [x + cell, z + cell], [x + cell, z]];
      const edge: number[] = [];
      for (let i = 0; i < 4; i++) {
        const a = corners[i], b = corners[(i + 1) % 4];
        edge.push(vertex(a[0], a[1]));
        const mx = (a[0] + b[0]) / 2, mz = (a[1] + b[1]) / 2;
        const shared = inner && ((Math.abs(mx) === inner && Math.abs(mz) < inner)
          || (Math.abs(mz) === inner && Math.abs(mx) < inner));
        if (shared) for (let offset = fine; offset < cell; offset += fine) {
          edge.push(vertex(a[0] + (b[0] - a[0]) * offset / cell, a[1] + (b[1] - a[1]) * offset / cell));
        }
      }
      if (edge.length === 4) indices.push(edge[0], edge[1], edge[2], edge[0], edge[2], edge[3]);
      else {
        const center = vertex(x + cell / 2, z + cell / 2);
        for (let i = 0; i < edge.length; i++) indices.push(center, edge[i], edge[(i + 1) % edge.length]);
      }
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices); geometry.computeVertexNormals(); geometry.computeBoundingSphere();
  return geometry;
}
