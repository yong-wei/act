/**
 * 可见规则网格的三角面查询。仅做渲染几何采样，不推进物理。
 * 无外部依赖，Worker 直接使用此函数的同一实现。
 */
export function displacedGridHeightAt(
  worldX: number,
  worldZ: number,
  cell: number,
  sample: (x: number, z: number) => { height: number; displacementX: number; displacementZ: number },
): number {
  type Vertex = { x: number; z: number; y: number };
  const cache = new Map<string, Vertex>();
  const corner = (i: number, j: number): Vertex => {
    const key = i + ':' + j;
    let vertex = cache.get(key);
    if (!vertex) {
      const x = i * cell;
      const z = j * cell;
      const field = sample(x, z);
      vertex = { x: x + field.displacementX, z: z + field.displacementZ, y: field.height };
      cache.set(key, vertex);
    }
    return vertex;
  };
  const height = (a: Vertex, b: Vertex, c: Vertex): number | null => {
    const det = (b.z - c.z) * (a.x - c.x) + (c.x - b.x) * (a.z - c.z);
    if (Math.abs(det) < 1e-10) return null;
    const u = ((b.z - c.z) * (worldX - c.x) + (c.x - b.x) * (worldZ - c.z)) / det;
    const v = ((c.z - a.z) * (worldX - c.x) + (a.x - c.x) * (worldZ - c.z)) / det;
    const w = 1 - u - v;
    if (Math.min(u, v, w) < -1e-6) return null;
    return u * a.y + v * b.y + w * c.y;
  };
  const initial = sample(worldX, worldZ);
  const i = Math.floor((worldX - initial.displacementX) / cell);
  const j = Math.floor((worldZ - initial.displacementZ) / cell);
  for (let radius = 0; radius <= 2; radius += 1) {
    for (let di = -radius; di <= radius; di += 1) for (let dj = -radius; dj <= radius; dj += 1) {
      if (Math.max(Math.abs(di), Math.abs(dj)) !== radius) continue;
      const a = corner(i + di, j + dj);
      const b = corner(i + di, j + dj + 1);
      const c = corner(i + di + 1, j + dj + 1);
      const d = corner(i + di + 1, j + dj);
      const value = height(a, b, d) ?? height(b, c, d);
      if (value !== null) return value;
    }
  }
  throw new Error('Displaced surface does not cover the requested point');
}
