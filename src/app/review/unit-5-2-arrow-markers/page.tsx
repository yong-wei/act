import {
  getInteractiveSvgMarkerSize,
  getInteractiveSvgMarkerStrokeWidth,
  InteractiveSvgMarkerDefs,
  InteractiveSvgMarkerRegistry,
  InteractiveSvgPointMarker,
  type InteractiveSvgMarkerKind,
  type InteractiveSvgPointMarkerKind
} from '@/features/interactive/shared/interactive-svg-markers';

const markerPrefix = 'unit52-review-marker';
const previewLineWidths = [3.5, 5, 7, 9];

const markerRows: Array<{
  kind: InteractiveSvgMarkerKind;
  label: string;
  role: string;
  color: string;
  path?: string;
  markerPosition: 'start' | 'end';
}> = [
  {
    kind: 'arrow-slim-concave',
    label: '细长收腰实心箭头',
    role: '曲线方向、相平面向量、信号流方向',
    color: '#dc2626',
    path: 'M 34 84 C 104 24, 178 22, 236 54 S 318 92, 366 42',
    markerPosition: 'end'
  },
  {
    kind: 'arrow-open-wide-concave',
    label: '宽开口收腰箭头',
    role: '坐标轴方向、弱强调趋势方向',
    color: '#1d4ed8',
    path: 'M 34 76 C 112 34, 210 30, 366 62',
    markerPosition: 'end'
  },
  {
    kind: 'dot-filled',
    label: '实心圆点端标',
    role: '曲线终点、采样点、状态点',
    color: '#0f766e',
    markerPosition: 'end'
  },
  {
    kind: 'dot-hollow',
    label: '空心圆点端标',
    role: '开端点、候选点、未选中点',
    color: '#0f766e',
    markerPosition: 'end'
  },
  {
    kind: 'diamond-filled',
    label: '实心菱形端标',
    role: '边界点、关键节点',
    color: '#7c3aed',
    markerPosition: 'end'
  },
  {
    kind: 'diamond-hollow',
    label: '空心菱形端标',
    role: '备用边界点、未激活关键节点',
    color: '#7c3aed',
    markerPosition: 'end'
  },
  {
    kind: 'start-dot-filled',
    label: '起始点实心圆',
    role: '轨迹起点、初始条件',
    color: '#ea580c',
    markerPosition: 'start'
  },
  {
    kind: 'start-dot-hollow',
    label: '起始点空心圆',
    role: '参考起点、未锁定初始点',
    color: '#ea580c',
    markerPosition: 'start'
  },
  {
    kind: 'pole-cross',
    label: '极点叉',
    role: '根轨迹极点、复平面极点',
    color: '#111827',
    markerPosition: 'end'
  }
];

const pointKinds: Array<{
  kind: InteractiveSvgPointMarkerKind;
  label: string;
  color: string;
}> = [
  { kind: 'dot-filled', label: '实心圆点', color: '#0f766e' },
  { kind: 'dot-hollow', label: '空心圆点', color: '#0f766e' },
  { kind: 'diamond-filled', label: '实心菱形', color: '#7c3aed' },
  { kind: 'diamond-hollow', label: '空心菱形', color: '#7c3aed' },
  { kind: 'start-dot-filled', label: '起点实心圆', color: '#ea580c' },
  { kind: 'start-dot-hollow', label: '起点空心圆', color: '#ea580c' },
  { kind: 'pole-cross', label: '极点叉', color: '#111827' }
];

function MarkerLinePreview({
  kind,
  color,
  lineWidth,
  path,
  markerPosition
}: {
  kind: InteractiveSvgMarkerKind;
  color: string;
  lineWidth: number;
  path?: string;
  markerPosition: 'start' | 'end';
}) {
  const d = path ?? 'M 34 58 C 112 30, 188 30, 246 58 S 322 86, 366 58';
  const size = getInteractiveSvgMarkerSize(kind, lineWidth);
  const markerStrokeWidth = getInteractiveSvgMarkerStrokeWidth(kind, lineWidth);
  const prefix = `${markerPrefix}-${kind}-${lineWidth.toString().replace('.', '_')}`;
  const markerUrl = InteractiveSvgMarkerRegistry.markerUrl(kind, prefix);
  const markerProps = markerPosition === 'start' ? { markerStart: markerUrl } : { markerEnd: markerUrl };

  return (
    <div>
      <div className="mb-1 text-xs leading-5 text-slate-500">
        线宽 {lineWidth}px · marker {size}px · 标记笔触 {markerStrokeWidth}px
      </div>
      <svg viewBox="0 0 400 116" className="h-28 w-full rounded border border-slate-100 bg-slate-50">
      <InteractiveSvgMarkerDefs prefix={prefix} color={color} lineStrokeWidth={lineWidth} />
      <line x1="28" y1="92" x2="372" y2="92" stroke="#e2e8f0" strokeWidth="1" />
      <path
        d={d}
        fill="none"
        stroke={color}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={lineWidth}
        {...markerProps}
      />
    </svg>
    </div>
  );
}

function MarkerRow({
  kind,
  label,
  role,
  color,
  path,
  markerPosition
}: (typeof markerRows)[number]) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="mb-4 grid gap-2 md:grid-cols-[18rem_minmax(0,1fr)]">
        <div>
          <div className="text-base font-semibold leading-7 text-slate-950">{label}</div>
          <div className="mt-1 text-sm leading-6 text-slate-600">{role}</div>
          <div className="mt-2 font-mono text-xs text-slate-500">{kind}</div>
        </div>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {previewLineWidths.map((lineWidth) => (
            <MarkerLinePreview key={lineWidth} kind={kind} color={color} lineWidth={lineWidth} path={path} markerPosition={markerPosition} />
          ))}
        </div>
      </div>
    </div>
  );
}

function PointMarkerPanel() {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="mb-4">
        <div className="text-base font-semibold leading-7 text-slate-950">坐标点标记</div>
        <div className="text-sm leading-6 text-slate-600">同一套 kind 也可以直接画在点坐标上，用于极点、起始点、候选交点。</div>
      </div>
      <svg viewBox="0 0 760 190" className="h-48 w-full rounded border border-slate-100 bg-slate-50">
        <g stroke="#e2e8f0">
          <line x1="40" y1="96" x2="720" y2="96" />
          <line x1="80" y1="30" x2="80" y2="160" />
        </g>
        {pointKinds.map((item, index) => {
          const x = 112 + index * 92;
          return (
            <g key={item.kind}>
              <InteractiveSvgPointMarker kind={item.kind} x={x} y={54} size={getInteractiveSvgMarkerSize(item.kind, 3.5)} strokeWidth={getInteractiveSvgMarkerStrokeWidth(item.kind, 3.5)} color={item.color} />
              <InteractiveSvgPointMarker kind={item.kind} x={x} y={86} size={getInteractiveSvgMarkerSize(item.kind, 5)} strokeWidth={getInteractiveSvgMarkerStrokeWidth(item.kind, 5)} color={item.color} />
              <InteractiveSvgPointMarker kind={item.kind} x={x} y={124} size={getInteractiveSvgMarkerSize(item.kind, 7)} strokeWidth={getInteractiveSvgMarkerStrokeWidth(item.kind, 7)} color={item.color} />
              <InteractiveSvgPointMarker kind={item.kind} x={x} y={166} size={getInteractiveSvgMarkerSize(item.kind, 9)} strokeWidth={getInteractiveSvgMarkerStrokeWidth(item.kind, 9)} color={item.color} />
              <text x={x} y="188" textAnchor="middle" className="fill-slate-600 text-[12px]">
                {item.label}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function P11CurveMockup() {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="mb-3">
        <div className="text-base font-semibold leading-7 text-slate-950">p11 红色曲线箭头草案</div>
        <div className="text-sm leading-6 text-slate-600">
          红色曲线从左下稳定区域起始，向右进入不稳定区域后向左穿出；末尾只标一个细长收腰箭头。
        </div>
      </div>
      <svg viewBox="0 0 720 360" className="h-[360px] w-full rounded border border-slate-100 bg-white">
        <InteractiveSvgMarkerDefs prefix="p11-review-red" color="#dc2626" lineStrokeWidth={7} />
        <rect x="52" y="34" width="616" height="278" fill="#f8fafc" stroke="#e2e8f0" />
        <rect x="52" y="34" width="360" height="278" fill="#d7d6ff" opacity="0.75" />
        <path d="M 412 174 L 412 312 L 158 312 C 188 246 242 196 322 174 C 350 166 382 166 412 174 Z" fill="#fff7ed" opacity="0.9" />
        <line x1="72" y1="174" x2="648" y2="174" stroke="#94a3b8" strokeWidth="1.4" />
        <line x1="412" y1="50" x2="412" y2="296" stroke="#94a3b8" strokeWidth="1.4" />
        <path d="M 112 302 C 156 230, 230 168, 330 148 C 422 130, 486 160, 504 204 C 526 258, 438 278, 328 252" fill="none" stroke="#dc2626" strokeLinecap="round" strokeLinejoin="round" strokeWidth="7" markerEnd={InteractiveSvgMarkerRegistry.markerUrl('arrow-slim-concave', 'p11-review-red')} />
        <InteractiveSvgPointMarker kind="start-dot-hollow" x={112} y={302} size={getInteractiveSvgMarkerSize('start-dot-hollow', 7)} strokeWidth={getInteractiveSvgMarkerStrokeWidth('start-dot-hollow', 7)} color="#dc2626" />
        <text x="108" y="326" className="fill-slate-600 text-[13px]">起始</text>
        <text x="132" y="70" className="fill-blue-700 text-[22px] font-semibold">稳定区域</text>
        <text x="456" y="286" className="fill-orange-600 text-[22px] font-semibold">不稳定区域</text>
      </svg>
    </div>
  );
}

function LargeDefaultOpenArrowPreview() {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="mb-3">
        <div className="text-base font-semibold leading-7 text-slate-950">宽开口箭头默认朝向大图</div>
        <div className="text-sm leading-6 text-slate-600">
          这里不使用 markerEnd 旋转，只按 SVG marker 自身坐标系放大绘制；默认从左向右。
        </div>
      </div>
      <svg viewBox="0 -350 1120 1120" className="h-[520px] w-full rounded border border-slate-100 bg-slate-50">
        <rect x="70" y="54" width="980" height="370" fill="white" stroke="#e2e8f0" strokeWidth="2" />
        <line x1="100" y1="250" x2="1010" y2="250" stroke="#e2e8f0" strokeWidth="2" />
        <path d="M100 250 L1010 250" stroke="#cbd5e1" strokeDasharray="10 12" strokeWidth="2" />
        <text x="100" y="292" className="fill-slate-500 text-[18px]">左侧接线入口</text>
        <text x="830" y="292" className="fill-slate-500 text-[18px]">右侧为默认前进方向</text>
        <text x="100" y="96" className="fill-slate-500 text-[16px]">浅灰横线表示默认正右方向</text>
        <g transform="translate(250 98) scale(24)" fill="none" stroke="#111827" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2">
          <path d="M1.2 -12.5 C6.15 5 20 7 22.2 7.5" />
          <path d="M1.2 27.5 C6.15 10 20 8 22.2 7.5" />
        </g>
        <circle cx="524" cy="278" r="5" fill="#dc2626" />
        <text x="542" y="284" className="fill-red-600 text-[16px]">当前 refX/refY 约对应的连接参考点</text>
      </svg>
    </div>
  );
}

function AdjustedOpenArrowCurvePreview() {
  const curveRows = [
    { lineWidth: 5, color: '#2563eb', path: 'M 76 122 C 184 58 292 62 386 126 S 554 184 674 112' },
    { lineWidth: 7, color: '#dc2626', path: 'M 76 222 C 168 122 314 118 414 196 S 560 286 674 192' },
    { lineWidth: 9, color: '#0f766e', path: 'M 76 332 C 194 256 312 260 416 326 S 560 384 674 312' }
  ];

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="mb-3">
        <div className="text-base font-semibold leading-7 text-slate-950">当前宽开口箭头接到曲线上的效果</div>
        <div className="text-sm leading-6 text-slate-600">
          这里直接使用共享类里的宽开口箭头。marker 标称宽度按线宽换算：线宽 7px 对应 marker 24px；实际视窗会额外放大以保留圆角。
        </div>
      </div>
      <svg viewBox="0 0 760 430" className="h-[430px] w-full rounded border border-slate-100 bg-slate-50">
        {curveRows.map((row) => (
          <InteractiveSvgMarkerDefs
            key={row.lineWidth}
            prefix={`review-current-open-arrow-${row.lineWidth.toString().replace('.', '_')}`}
            color={row.color}
            lineStrokeWidth={row.lineWidth}
            kinds={['arrow-open-wide-concave']}
          />
        ))}
        <rect x="42" y="34" width="676" height="354" fill="white" stroke="#e2e8f0" />
        {curveRows.map((row, index) => {
          const markerWidth = getInteractiveSvgMarkerSize('arrow-open-wide-concave', row.lineWidth);
          return (
            <g key={row.lineWidth}>
              <text x="58" y={62 + index * 110} className="fill-slate-500 text-[14px]">
                线宽 {row.lineWidth}px · marker 标称宽 {markerWidth}px · 视窗宽 {Number((markerWidth * 1.58).toFixed(2))}px · 高 {Number((markerWidth * 2.67).toFixed(2))}px
              </text>
              <path
                d={row.path}
                fill="none"
                stroke={row.color}
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={row.lineWidth}
                markerEnd={InteractiveSvgMarkerRegistry.markerUrl('arrow-open-wide-concave', `review-current-open-arrow-${row.lineWidth.toString().replace('.', '_')}`)}
              />
            </g>
          );
        })}
      </svg>
    </div>
  );
}

export default function Unit52ArrowMarkersPage() {
  return (
    <main className="min-h-screen bg-slate-100 px-6 py-8 text-slate-900">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">Temporary Marker Review</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-normal text-slate-950">互动课程共享 SVG marker 草案</h1>
          <p className="mt-3 max-w-4xl text-sm leading-6 text-slate-600">
            本页通过 <code className="rounded bg-white px-1 py-0.5">InteractiveSvgMarkerDefs</code> 和{' '}
            <code className="rounded bg-white px-1 py-0.5">InteractiveSvgPointMarker</code> 渲染，形状、颜色和尺寸都来自共享 marker 管理类。
            默认比例：细长箭头按线宽 7px 对应 marker 32px；开口箭头按线宽 7px 对应 marker 24px；点标按线宽 7px 对应 marker 30px。
          </p>
        </div>

        <section className="mb-8">
          <h2 className="mb-3 text-xl font-semibold text-slate-950">曲线与线段 marker</h2>
          <div className="grid gap-4">
            {markerRows.map((item) => (
              <MarkerRow key={item.kind} {...item} />
            ))}
          </div>
        </section>

        <section className="mb-8">
          <h2 className="mb-3 text-xl font-semibold text-slate-950">点标记与极点标记</h2>
          <PointMarkerPanel />
        </section>

        <section>
          <h2 className="mb-3 text-xl font-semibold text-slate-950">p11 应用草图</h2>
          <P11CurveMockup />
        </section>

        <section className="mt-8">
          <h2 className="mb-3 text-xl font-semibold text-slate-950">默认朝向检查</h2>
          <LargeDefaultOpenArrowPreview />
        </section>

        <section className="mt-8">
          <h2 className="mb-3 text-xl font-semibold text-slate-950">连接到曲线检查</h2>
          <AdjustedOpenArrowCurvePreview />
        </section>
      </div>
    </main>
  );
}
