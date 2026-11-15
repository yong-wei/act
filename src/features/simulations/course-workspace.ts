import { createVesselSimulationSessionBrowser, type VesselSession, type VesselSessionConfiguration,
  type VesselSessionFrame, type VesselSessionInput } from '@/lib/control-engine/vessel-session';
import { VesselRunRecorder } from './run-recorder';
import type { VesselRunEvidence } from './run-evidence';
import type { VesselCourseKey } from '@/resources/simulations/experiments/course-catalog';

export interface VesselCourseRunPlan {
  scopeKey: string;
  courseKey: VesselCourseKey;
  courseVersion: string;
  stepSequence: number;
  durationS: number;
  configuration: VesselSessionConfiguration;
  courseSettings?: Record<string, unknown>;
}

/** 原场景使用的运行与证据生命周期。数值推进由传入的原生会话完成。 */
export class VesselCourseWorkspace {
  private recorder: VesselRunRecorder | null;
  private frame: VesselSessionFrame;
  readonly initialInput: VesselSessionInput;
  readonly session: VesselSession;
  readonly plan: VesselCourseRunPlan;
  running = false;
  private disposal: Promise<void> | null = null;

  private constructor(plan: VesselCourseRunPlan, session: VesselSession,
    saved?: VesselRunEvidence & { revision: number }) {
    this.plan = plan;
    this.session = session;
    if (saved) session.restore(saved.checkpoint);
    session.setPaused(true);
    this.frame = session.read();
    this.initialInput = structuredClone(saved?.initialInput ?? this.frame.input);
    this.recorder = saved ? new VesselRunRecorder(saved, saved.revision) : null;
  }

  static async open(plan: VesselCourseRunPlan, saved?: VesselRunEvidence & { revision: number }) {
    if (saved && (saved.scopeKey !== plan.scopeKey || saved.courseKey !== plan.courseKey
      || saved.courseVersion !== plan.courseVersion || saved.stepSequence !== plan.stepSequence)) {
      throw new Error('保存的运行与当前实验范围不一致。');
    }
    const session = await createVesselSimulationSessionBrowser(saved?.configuration ?? plan.configuration);
    try { return new VesselCourseWorkspace(plan, session, saved); }
    catch (error) { session.dispose(); throw error; }
  }

  read() { return this.frame; }
  run() { return this.recorder?.run ?? null; }

  previewInput(input: VesselSessionInput) {
    if (this.recorder || this.frame.timeS > 0) throw new Error('运行已经建立，请重置后保存新的预测方案。');
    this.frame = this.session.advance(0, input);
    return this.frame.input;
  }

  async prepare(id: string, prediction: string, input: VesselSessionInput, designStudentModelId?: string) {
    if (this.recorder && this.recorder.run.stoppedAtMs !== null) {
      throw new Error('这次运行已结束，请重置后保留新的独立运行。');
    }
    if (!this.recorder) {
      if (!prediction.trim()) throw new Error('请先写下运行前预测。');
      this.session.setPaused(false);
      this.frame = this.session.advance(0, input);
      const checkpoint = this.session.snapshot();
      this.session.setPaused(true);
      this.recorder = new VesselRunRecorder({ ...this.plan, id, prediction, createdAtMs: Date.now(),
        lastTimeS: 0, stoppedAtMs: null, initialInput: structuredClone(this.frame.input),
        parameters: this.frame.parameters, designStudentModelId,
        parameterHash: this.frame.parameterHash, runtimeVersion: this.session.runtimeVersion,
        initialCheckpoint: checkpoint, checkpoint, trace: [], nativeSensorSamples: [], changes: [],
        stopReason: null, failure: null });
      await this.recorder.save(this.session);
    }
  }

  async start(id: string, prediction: string, input: VesselSessionInput, designStudentModelId?: string) {
    if (this.disposal) throw new Error('运行已释放，请读取已保存的记录后继续。');
    await this.prepare(id, prediction, input, designStudentModelId);
    this.session.setPaused(false);
    this.running = true;
  }

  advance(seconds: number, input: VesselSessionInput) {
    if (!this.running || !this.recorder) return { frame: this.frame, saved: null };
    const remaining = Math.max(0, this.plan.durationS - this.frame.timeS);
    if (remaining > 1e-8) {
      this.frame = this.session.advance(Math.min(seconds, remaining), input);
      this.recorder.append(this.frame);
    }
    const termination = this.frame.berth?.termination;
    const voyageTermination = this.frame.containerVoyage?.progress.termination;
    const iceArrival = this.plan.courseKey === 'icebreaker' && this.plan.stepSequence >= 8
      && this.frame.truth.position_ned[0] >= 800;
    if (termination || voyageTermination || iceArrival || this.frame.timeS >= this.plan.durationS - 1e-8) {
      this.running = false;
      this.session.setPaused(true);
      return { frame: this.frame, saved: this.recorder.save(this.session,
        termination?.reason === 'time_limit' || voyageTermination?.reason === 'time_limit' ? 'time_limit'
          : termination || voyageTermination || iceArrival ? 'arrival' : 'duration') };
    }
    return { frame: this.frame, saved: this.recorder.saveIfDue(this.session) };
  }

  async pause(reason: VesselRunEvidence['stopReason'] = null) {
    if (this.disposal) return this.disposal;
    this.running = false;
    this.session.setPaused(true);
    if (this.recorder && this.recorder.run.stoppedAtMs === null) await this.recorder.save(this.session, reason);
    else await this.recorder?.settled();
  }

  async fail(message: string) {
    this.running = false;
    this.session.setPaused(true);
    if (this.recorder?.run.stoppedAtMs === null) await this.recorder.save(this.session, 'failure', message);
  }

  dispose() {
    if (!this.disposal) {
      const saved = this.running ? this.pause() : this.recorder?.settled() ?? Promise.resolve();
      this.disposal = saved.finally(() => this.session.dispose());
    }
    return this.disposal;
  }
}
