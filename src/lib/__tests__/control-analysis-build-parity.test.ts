import { readFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { expect, it } from 'vitest';

import * as full from '@/resources/control-system/wasm/control_engine/index.js';
import * as compact from '@/resources/control-system/wasm/control_analysis/index.js';
import { buildUnit41AnalysisRequest } from '@/resources/control-system/analysis/unit-4-1-request-builder';

it('keeps the compact Rust analysis outputs identical and the transfer within budget', () => {
  const bytes = (name: string) => readFileSync(`src/resources/control-system/wasm/${name}/index_bg.wasm`);
  full.initSync({ module: bytes('control_engine') });
  const compactBytes = bytes('control_analysis');
  compact.initSync({ module: compactBytes });

  const linear = JSON.stringify(buildUnit41AnalysisRequest('step-04', {
    gain: 2.25, structures: [{ kind: 'gain', enabled: true, params: { k: 2.25 } }],
  }));
  const nonlinear = JSON.stringify({
    runtimeMode: 'nonlinear_analysis',
    analysisKind: 'phase_plane',
    modelId: 'damped_second_order',
    initialPoint: [1.2, 0.1],
    parameters: { zeta: 0.35, omega_n: 1 },
    timeRange: { start: 0, end: 8, samples: 180 },
  });

  expect(compact.compute_analysis(linear)).toBe(full.compute_analysis(linear));
  expect(compact.compute_nonlinear_analysis(nonlinear)).toBe(full.compute_nonlinear_analysis(nonlinear));
  expect(Object.keys(compact).filter(name => name.startsWith('compute_')).sort()).toEqual([
    'compute_analysis', 'compute_nonlinear_analysis',
  ]);
  expect(gzipSync(compactBytes).length).toBeLessThanOrEqual(512 * 1024);
});
