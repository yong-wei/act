import type { VesselSession, VesselSessionFrame } from '@/lib/control-engine/vessel-session';
import { saveRunEvidence } from './local-evidence-store';
import { collectVesselTracePoint, vesselDredgerModeEvents, type VesselRunEvidence } from './run-evidence';

/** 每次实际运行独立保存，写入按版本顺序串行提交。 */
export class VesselRunRecorder {
  readonly run: VesselRunEvidence;
  private revision: number;
  private writes: Promise<void> = Promise.resolve();
  private lastSavedTimeS: number;
  private lastInput: string;

  constructor(run: VesselRunEvidence, revision = 0) {
    this.run = run;
    this.revision = revision;
    this.lastSavedTimeS = run.lastTimeS;
    this.lastInput = JSON.stringify(run.changes.at(-1)?.input ?? run.initialInput);
  }

  append(frame: VesselSessionFrame) {
    if (this.run.stoppedAtMs !== null) throw new Error('已结束的运行不能追加采样。');
    const inputKey = JSON.stringify(frame.input);
    if (inputKey !== this.lastInput) {
      this.run.changes.push({ timeS: this.run.lastTimeS, input: structuredClone(frame.input) });
      this.lastInput = inputKey;
    }
    for (const sample of frame.controlSamples) {
      const previous = this.run.trace.at(-1);
      if (previous && sample.timeS <= previous.timeS) throw new Error('采样时间发生重复，请恢复保存的运行后继续。');
      this.run.trace.push(collectVesselTracePoint(sample, previous?.measurements ?? {}));
    }
    this.run.lastTimeS = frame.timeS;
    if (frame.cruiseComfort) this.run.cruiseComfort = frame.cruiseComfort;
    if (frame.dredger) this.run.dredgerModeEvents = vesselDredgerModeEvents(frame);
    this.run.nativeSensorSamples.push(...frame.samples);
    if (frame.fineStepSamples) {
      this.run.fineStepSamples ??= [];
      this.run.fineStepSamples.push(...frame.fineStepSamples);
    }
  }

  save(session: VesselSession, reason: VesselRunEvidence['stopReason'] = null, failure: string | null = null) {
    this.run.checkpoint = session.snapshot();
    if (reason !== null) {
      this.run.stopReason = reason;
      this.run.failure = failure;
      this.run.stoppedAtMs ??= Date.now();
    }
    this.lastSavedTimeS = this.run.lastTimeS;
    const snapshot: VesselRunEvidence = { ...this.run, trace: this.run.trace.slice(),
      nativeSensorSamples: this.run.nativeSensorSamples.slice(), fineStepSamples:this.run.fineStepSamples?.slice(),
      changes: this.run.changes.slice() };
    this.writes = this.writes.then(async () => {
      this.revision = await saveRunEvidence(snapshot, this.revision);
    });
    return this.writes;
  }

  saveIfDue(session: VesselSession) {
    if (this.run.lastTimeS - this.lastSavedTimeS < 5) return null;
    return this.save(session);
  }

  settled() { return this.writes; }
}
