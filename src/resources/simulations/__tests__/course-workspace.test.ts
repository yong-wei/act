import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { VesselSession, VesselSessionFrame, VesselSessionInput } from '@/lib/control-engine/vessel-session';
import type { VesselRunEvidence } from '@/features/simulations/run-evidence';
import { VesselCourseWorkspace } from '@/features/simulations/course-workspace';

const mocks = vi.hoisted(() => ({create:vi.fn(),save:vi.fn()}));
vi.mock('@/lib/control-engine/vessel-session', () => ({createVesselSimulationSessionBrowser:mocks.create}));
vi.mock('@/features/simulations/local-evidence-store', () => ({saveRunEvidence:mocks.save}));

const input: VesselSessionInput = {controlMode:'manual',pid:{kp:0,ki:0,kd:0},targetHeadingDeg:0,
  feedback:'measurement',actuators:{shafts:[],surfaces:[]}};
const plan = {scopeKey:'lifecycle-fixture',courseKey:'lng' as const,courseVersion:'fixture',stepSequence:6,
  durationS:1200,configuration:{}};
let revision:number;
let stored:(VesselRunEvidence & {revision:number})|undefined;

function sessionFixture() {
  const frame = {timeS:0,input,parameterHash:'fixture',parameters:{},controlSamples:[],samples:[]} as unknown as VesselSessionFrame;
  return {read:vi.fn(() => frame),advance:vi.fn(() => frame),setPaused:vi.fn(),
    snapshot:vi.fn(() => 'opaque-lifecycle-checkpoint'),restore:vi.fn(),reset:vi.fn(),dispose:vi.fn()} satisfies VesselSession;
}

beforeEach(() => {
  mocks.create.mockReset();mocks.save.mockReset();revision=0;stored=undefined;
  mocks.create.mockImplementation(async () => sessionFixture());
  mocks.save.mockImplementation(async (run:VesselRunEvidence,expectedRevision:number) => {
    if (expectedRevision !== revision) throw new Error('revision conflict');
    revision++;
    stored={...run,revision};
    return revision;
  });
});

describe('原页面运行的释放与恢复', () => {
  it('暂停后读取的版本可以继续保存，释放已暂停实例不会再次推进版本', async () => {
    const first=await VesselCourseWorkspace.open(plan);
    await first.start('run','lifecycle fixture',input);
    await first.pause();
    const saved=stored!;
    const restored=await VesselCourseWorkspace.open(plan,saved);
    await first.dispose();
    expect(revision).toBe(saved.revision);
    await restored.start('run','lifecycle fixture',input);
    await expect(restored.pause()).resolves.toBeUndefined();
    expect(revision).toBe(saved.revision+1);
    await restored.dispose();
  });

  it('重入释放等待同一次保存，未启动的恢复实例释放后保持原版本', async () => {
    const first=await VesselCourseWorkspace.open(plan);
    await first.start('run','lifecycle fixture',input);
    const save=mocks.save.getMockImplementation()!;
    let release!:() => void;
    mocks.save.mockImplementationOnce(async (...args:unknown[]) => {
      await new Promise<void>((resolve) => {release=resolve;});
      return save(...args);
    });
    const disposing=first.dispose();
    expect(first.dispose()).toBe(disposing);
    await Promise.resolve();await Promise.resolve();
    expect(first.session.dispose).not.toHaveBeenCalled();
    release();await disposing;
    expect(first.session.dispose).toHaveBeenCalledTimes(1);
    expect(revision).toBe(2);
    const restored=await VesselCourseWorkspace.open(plan,stored!);
    await restored.dispose();await restored.dispose();
    expect(revision).toBe(2);
    expect(restored.session.dispose).toHaveBeenCalledTimes(1);
    await expect(restored.start('run','lifecycle fixture',input)).rejects.toThrow('运行已释放');
  });

  it('实际航次到达即停止记录，重载后保持终止状态', async () => {
    const session = sessionFixture();
    const frame = session.read();
    mocks.create.mockResolvedValueOnce(session);
    const course = await VesselCourseWorkspace.open({...plan,courseKey:'container',stepSequence:11});
    await course.start('voyage-run','actual voyage fixture',input);
    frame.timeS = 750;
    frame.containerVoyage = {progress:{termination:{reason:'arrived',timeS:750,finalWaterSpeedMps:8}}} as VesselSessionFrame['containerVoyage'];
    const result = course.advance(1/60,input);
    await result.saved;
    expect(course.running).toBe(false);
    expect(stored?.stopReason).toBe('arrival');
    expect(stored?.lastTimeS).toBe(750);
    expect(stored?.stoppedAtMs).not.toBeNull();
    await course.dispose();
  });
});
