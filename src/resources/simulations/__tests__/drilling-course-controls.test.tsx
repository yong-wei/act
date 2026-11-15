import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import { DrillingCourseControls } from '../experiments/drilling-course-controls';
import { drillingCourseDefaultSettings } from '../experiments/drilling-course';
import type { VesselExperimentController } from '../simulations/use-vessel-experiment';
import type { DrillingCourseSettings } from '../experiments/drilling-course';

describe('981报告运行引用入口', () => {
  it('在原控制面板列出本人已保存运行，并显示既有引用选择', () => {
    const session = {
      activeSeq: 20, busy: false,
      course: {
        ready: true, running: false, completed: false, models: [],
        settings: drillingCourseDefaultSettings(20), reportRunIds: ['completed-own-run'],
        setReportRunIds: vi.fn(),
        runs: [
          { id: 'completed-own-run', stepSequence: 5, lastTimeS: 300, stoppedAtMs: 1000, createdAtMs: 100 },
          { id: 'unfinished-run', stepSequence: 19, lastTimeS: 12, stoppedAtMs: null, createdAtMs: 200 },
        ],
      },
    } as unknown as VesselExperimentController<DrillingCourseSettings>;
    const html = renderToStaticMarkup(<DrillingCourseControls session={session} timeS={0} />);
    expect(html).toContain('报告引用的本人运行');
    expect(html.match(/type="checkbox"/g)).toHaveLength(1);
    expect(html).toContain('checked=""');
    expect(html).toContain('300.0');
  });
});
