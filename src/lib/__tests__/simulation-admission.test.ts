import { describe, expect, it } from 'vitest';
import { AdmissionGate } from '@/lib/simulation-admission';

describe('仿真在线名额', () => {
  it('名额未满时放行，超过后按到达顺序排队', () => {
    const gate = new AdmissionGate(2, 1000);
    expect(gate.request('a', 0).status).toBe('admitted');
    expect(gate.request('b', 0).status).toBe('admitted');
    const first = gate.request('c', 0);
    const second = gate.request('d', 0);
    expect(first).toMatchObject({ status: 'queued', position: 1, waiting: 1 });
    expect(second).toMatchObject({ status: 'queued', position: 2, waiting: 2 });
    expect(first.message).toContain('按班级分批');
  });

  it('名额到期后按排队顺序补入', () => {
    const gate = new AdmissionGate(1, 1000);
    gate.request('a', 0);
    gate.request('b', 0);
    const promoted = gate.request('b', 1000);
    expect(promoted.status).toBe('admitted');
    expect(gate.snapshot(1000).waiting).toBe(0);
  });
});
