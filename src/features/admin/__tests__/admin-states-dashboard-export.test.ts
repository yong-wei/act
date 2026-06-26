import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const dashboardSource = readFileSync(
  join(process.cwd(), 'src/features/admin/states/admin-states-dashboard.tsx'),
  'utf8',
);

describe('AdminStatesDashboard export state', () => {
  it('keeps usage export deep links observable and downloadable', () => {
    expect(dashboardSource).toContain("initialExportQuery?: {");
    expect(dashboardSource).toContain("initialExportQuery?.focus === 'usage-export'");
    expect(dashboardSource).not.toContain("kind: 'admin-states-export'");
    expect(dashboardSource).toContain("id: `admin-states-export-request:${demoMode ? 'demo' : 'real'}:");
    expect(dashboardSource).toContain("status: error ? 'failed' : 'succeeded'");
    expect(dashboardSource).toContain('恢复真实数据接口后重试导出');
    expect(dashboardSource).toContain('文件和操作账本 ID 将由服务端下载响应返回');
    expect(dashboardSource).not.toContain('displayReference: exportIdempotencyKey');
    expect(dashboardSource).toContain('download={exportFilename}');
    expect(dashboardSource).toContain('/api/admin/states/export?source=');
    expect(dashboardSource).not.toContain('data:application/json');
  });
});
