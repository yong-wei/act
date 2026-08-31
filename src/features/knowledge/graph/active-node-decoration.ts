import type { AuthorityNodeDecoration } from '../authority-graph-view-model';
import type { KnowledgeConceptNodeShape } from './visual-config';

export const ACTIVE_NODE_DECORATION_METADATA_KEY = 'decoration' as const;

const RUNTIME_SHAPES = new Set<KnowledgeConceptNodeShape>([
  'circle',
  'square',
  'hexagon',
  'triangle',
  'diamond',
  'pentagon',
]);

export const FAMILY_MARKER_COLOR: Record<string, string> = {
  media: '#38bdf8',
  text: '#f8fafc',
  exercise: '#f59e0b',
  simulation: '#34d399',
  project: '#c084fc',
};

export function readActiveNodeDecoration(metadata: unknown): AuthorityNodeDecoration | null {
  if (!metadata || typeof metadata !== 'object') return null;
  const decoration = (metadata as { decoration?: unknown }).decoration;
  if (!decoration || typeof decoration !== 'object') return null;
  const record = decoration as Partial<AuthorityNodeDecoration>;
  if (typeof record.glyphRadius !== 'number' || !Number.isFinite(record.glyphRadius)) return null;
  return {
    visualFamilies: Array.isArray(record.visualFamilies) ? record.visualFamilies : [],
    hasCardStar: Boolean(record.hasCardStar),
    hasCrossDomainHalo: Boolean(record.hasCrossDomainHalo),
    glyphRadius: record.glyphRadius,
  };
}

export function readActivePresentationShape(metadata: unknown): KnowledgeConceptNodeShape | null {
  if (!metadata || typeof metadata !== 'object') return null;
  const shape = (metadata as { presentationShape?: unknown }).presentationShape;
  return typeof shape === 'string' && RUNTIME_SHAPES.has(shape as KnowledgeConceptNodeShape)
    ? shape as KnowledgeConceptNodeShape
    : null;
}

export function toRuntimePresentationShape(shape: string): KnowledgeConceptNodeShape {
  if (shape === 'rounded') return 'square';
  return RUNTIME_SHAPES.has(shape as KnowledgeConceptNodeShape)
    ? shape as KnowledgeConceptNodeShape
    : 'circle';
}

export function paintActiveNodeDecorations2d(
  ctx: CanvasRenderingContext2D,
  input: {
    x: number;
    y: number;
    radius: number;
    globalScale: number;
    decoration: AuthorityNodeDecoration;
  },
): void {
  const { x, y, radius, globalScale, decoration } = input;
  const lineScale = Math.max(0.0001, globalScale);

  if (decoration.hasCrossDomainHalo) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(x, y, radius + 5 / lineScale, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.85)';
    ctx.lineWidth = 2.2 / lineScale;
    ctx.stroke();
    ctx.restore();
  }

  const families = decoration.visualFamilies.slice(0, 4);
  families.forEach((family, index) => {
    const angle = -Math.PI / 2 + (index * (Math.PI * 2)) / Math.max(families.length, 1);
    const markerRadius = Math.max(2.2 / lineScale, radius * 0.22);
    const markerX = x + Math.cos(angle) * radius * 0.46;
    const markerY = y + Math.sin(angle) * radius * 0.46;
    ctx.beginPath();
    ctx.arc(markerX, markerY, markerRadius, 0, Math.PI * 2);
    ctx.fillStyle = FAMILY_MARKER_COLOR[family] ?? '#94a3b8';
    ctx.fill();
  });

  if (decoration.hasCardStar) {
    ctx.save();
    ctx.fillStyle = '#fbbf24';
    ctx.beginPath();
    const spikes = 5;
    const outer = Math.max(3 / lineScale, radius * 0.34);
    const inner = outer * 0.42;
    for (let i = 0; i < spikes * 2; i += 1) {
      const angle = -Math.PI / 2 + (i * Math.PI) / spikes;
      const length = i % 2 === 0 ? outer : inner;
      const pointX = x + Math.cos(angle) * length;
      const pointY = y + Math.sin(angle) * length;
      if (i === 0) ctx.moveTo(pointX, pointY);
      else ctx.lineTo(pointX, pointY);
    }
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
}

export function attachActiveNodeDecorations3d(
  group: import('three').Group,
  THREE: typeof import('three'),
  input: {
    radius: number;
    decoration: AuthorityNodeDecoration;
    opacity: number;
  },
): void {
  const { radius, decoration, opacity } = input;

  if (decoration.hasCrossDomainHalo) {
    const halo = new THREE.Mesh(
      new THREE.RingGeometry(radius + 0.9, radius + 1.35, 48),
      new THREE.MeshBasicMaterial({
        color: new THREE.Color('#38bdf8'),
        transparent: true,
        opacity: 0.85 * opacity,
        side: THREE.DoubleSide,
        depthWrite: false,
      }),
    );
    halo.rotation.x = Math.PI / 2;
    group.add(halo);
  }

  const families = decoration.visualFamilies.slice(0, 4);
  families.forEach((family, index) => {
    const angle = -Math.PI / 2 + (index * (Math.PI * 2)) / Math.max(families.length, 1);
    const marker = new THREE.Mesh(
      new THREE.SphereGeometry(Math.max(0.55, radius * 0.18), 12, 12),
      new THREE.MeshBasicMaterial({
        color: new THREE.Color(FAMILY_MARKER_COLOR[family] ?? '#94a3b8'),
        transparent: true,
        opacity,
      }),
    );
    marker.position.set(
      Math.cos(angle) * radius * 0.46,
      Math.sin(angle) * radius * 0.46,
      radius * 0.12,
    );
    group.add(marker);
  });

  if (decoration.hasCardStar) {
    const star = new THREE.Mesh(
      new THREE.OctahedronGeometry(Math.max(0.7, radius * 0.28), 0),
      new THREE.MeshBasicMaterial({ color: new THREE.Color('#fbbf24') }),
    );
    star.position.set(0, 0, radius * 0.08);
    group.add(star);
  }
}
