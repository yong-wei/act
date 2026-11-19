import { describe, expect, it } from 'vitest';
import { chooseAdmissionScale, parseAdmissionHostCpu } from '../simulation-admission-pressure';

describe('simulation admission pressure', () => {
  it('counts CPU stolen by the host and blocked on I/O as unavailable', () => {
    expect(parseAdmissionHostCpu('cpu  20 1 9 60 5 1 1 3 2 0\ncpu0 1 0 0 1\ncpu1 1 0 0 1\n'))
      .toEqual({ total: 100, busy: 40, cores: 2 });
    expect(parseAdmissionHostCpu('cpu 1 1 1')).toBeUndefined();
  });

  it('stops new work at 90% and backs off promptly before that', () => {
    expect(chooseAdmissionScale(3, 0.90, 0, false, 0, 2)).toBe(0);
    expect(chooseAdmissionScale(3, 0.82, 0.16, false, 0, 2)).toBe(1.5);
    expect(chooseAdmissionScale(3, 0.30, 1.2, true, 12000, 2)).toBe(1.5);
    expect(chooseAdmissionScale(0, 0.55, 0.7, false, 0, 2)).toBe(0.5);
  });

  it('increases only after stable spare capacity and permits a higher cap after expansion', () => {
    expect(chooseAdmissionScale(1, 0.30, 1.2, false, 7999, 2)).toBe(1);
    expect(chooseAdmissionScale(1, 0.30, 1.2, false, 8000, 2)).toBe(1.5);
    expect(chooseAdmissionScale(4, 0.30, 1.2, false, 8000, 2)).toBe(4);
    expect(chooseAdmissionScale(4, 0.30, 2.4, false, 8000, 4)).toBe(4.5);
  });
});
