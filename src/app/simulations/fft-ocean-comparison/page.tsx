import FFTOceanComparisonClient from './comparison-client';
import { parseComparisonBackend, parseComparisonScene } from './comparison-lab';

/**
 * FFT ↔ Gerstner 对照实验页（#2130，服务端组件外壳）：
 * 后端与场景由 **Next searchParams** 选择（服务端与客户端首帧一致——无水合分歧）。
 * 受控变量：同镜头/海况/画布/像素负载；两分支同一高精 055 与水平远场环带。
 * 生产不变量：实验路由，不改生产默认海洋后端。
 */
export default async function FFTOceanComparisonPage({
  searchParams,
}: {
  readonly searchParams: Promise<{
    readonly backend?: string;
    readonly scene?: string;
    readonly vessel?: string;
  }>;
}) {
  const params = await searchParams;
  const backend = parseComparisonBackend(params?.backend);
  const scene = parseComparisonScene(params?.scene);
  const failAsset = params?.vessel === 'missing';
  return <FFTOceanComparisonClient backend={backend} scene={scene} failAsset={failAsset} />;
}
