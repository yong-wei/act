import FFTOceanComparisonClient from './comparison-client';

/**
 * FFT ↔ Gerstner 对照实验页（#2121，服务端组件外壳）：
 * 后端由 **Next searchParams** 选择（服务端与客户端首帧一致——无水合分歧）。
 * 受控变量：同镜头/海况/画布/像素负载；两分支同实验占位船体与远场平面
 * （归因边界见 comparison-client 注释）。生产不变量：实验路由，
 * 不改生产默认海洋后端。
 */
export default async function FFTOceanComparisonPage({
  searchParams,
}: {
  readonly searchParams: Promise<{ readonly backend?: string }>;
}) {
  const params = await searchParams;
  const backend = params?.backend === 'gerstner' ? 'gerstner' : 'fft';
  return <FFTOceanComparisonClient backend={backend} />;
}
