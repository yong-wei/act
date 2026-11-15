import type { VesselLocalStepAttempt, VesselRunEvidence } from './run-evidence';
import type { VesselSessionInput } from '@/lib/control-engine/vessel-session';
import type { VesselFineStepPoint, VesselObservedSample } from '@/lib/control-engine/vessel-session';
import type { FrozenVesselStudentModel, VesselModelComparison } from '@/resources/simulations/experiments/student-analysis';
import type { VesselEvidenceProgress } from './evidence-upload';

export interface VesselExperimentDraft {
  scopeKey: string;
  stepSequence: number;
  activeRunId: string | null;
  prediction: string;
  explanation: string;
  durationS: number;
  checkpoint: string | null;
  runConfiguration: unknown;
  completedSteps: number[];
  updatedAtMs: number;
  answers?: Record<string, string>;
  plannedRunId?: string;
  reportRunIds?: string[];
  reportClientRef?: string;
  originId?: string;
  lngSettings?: import('@/resources/simulations/experiments/lng-course').LngCourseSettings;
  courseSettings?: Record<string, unknown>;
  designStudentModelId?: string;
  controls?: { mode: VesselSessionInput['controlMode']; pid: VesselSessionInput['pid'];
    manualRudderDeg: number; derivativeFilterTauS: number; integralTrackingEnabled: boolean;
    integralTrackingTimeS: number; variants: Record<number, string>; controllerSourceRunId?: string; designStudentModelId?: string };
}

let databasePromise: Promise<IDBDatabase> | null = null;
type StoredRun = Omit<VesselRunEvidence, 'trace' | 'nativeSensorSamples' | 'fineStepSamples'> & {
  revision: number; traceLength: number; nativeSampleCount: number;fineSampleCount?:number;
  uploadReceipt?:VesselEvidenceProgress & {reportClientRef:string} };
interface TraceChunk { runId: string; start: number; points: VesselRunEvidence['trace'] }
interface SensorChunk { runId: string; start: number; points: VesselObservedSample[] }
interface FineStepChunk { runId:string;start:number;points:VesselFineStepPoint[] }
export interface VesselRunSummary extends Pick<VesselRunEvidence, 'id' | 'scopeKey' | 'courseVersion' | 'stepSequence' |
  'createdAtMs' | 'stoppedAtMs' | 'lastTimeS' | 'configuration' | 'initialInput' | 'stopReason' | 'controllerSourceRunId' | 'designStudentModelId' | 'courseSettings'> {
  durationS: number;
  sampleCount: number;
  finalInput?:VesselSessionInput;
  uploadedToReportRef?:string;
  stopReason: VesselRunEvidence['stopReason'];
}

function database(): Promise<IDBDatabase> {
  if (databasePromise) return databasePromise;
  databasePromise = new Promise((resolve, reject) => {
    const request = indexedDB.open('act-vessel-experiment-v2', 6);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains('runs')) {
        const runs = request.result.createObjectStore('runs', { keyPath: 'id' });
        runs.createIndex('scopeKey', 'scopeKey');
        const chunks = request.result.createObjectStore('trace-chunks', { keyPath: ['runId', 'start'] });
        chunks.createIndex('runId', 'runId');
        request.result.createObjectStore('drafts', { keyPath: 'scopeKey' });
      }
      for (const name of ['models', 'comparisons', 'attempts']) {
        if (!request.result.objectStoreNames.contains(name)) {
          request.result.createObjectStore(name, { keyPath: 'id' }).createIndex('scopeKey', 'scopeKey');
        }
      }
      if (!request.result.objectStoreNames.contains('sensor-chunks')) {
        request.result.createObjectStore('sensor-chunks', { keyPath: ['runId','start'] }).createIndex('runId','runId');
      }
      if (!request.result.objectStoreNames.contains('fine-step-chunks')) {
        request.result.createObjectStore('fine-step-chunks',{keyPath:['runId','start']}).createIndex('runId','runId');
      }
      if (!request.result.objectStoreNames.contains('step-drafts')) {
        request.result.createObjectStore('step-drafts',{keyPath:['scopeKey','stepSequence']});
      }
    };
    request.onsuccess = () => {
      request.result.onversionchange = () => { request.result.close(); databasePromise = null; };
      resolve(request.result);
    };
    request.onerror = () => reject(request.error ?? new Error('本机实验记录暂时无法打开。'));
    request.onblocked = () => reject(new Error('另一页面正在更新本机实验记录，请关闭该页面后重试。'));
  });
  void databasePromise.catch(() => { databasePromise = null; });
  return databasePromise;
}

async function read<T>(store: string, key: IDBValidKey): Promise<T | undefined> {
  const db = await database();
  return new Promise((resolve, reject) => {
    const request = db.transaction(store, 'readonly').objectStore(store).get(key);
    request.onsuccess = () => resolve(request.result as T | undefined);
    request.onerror = () => reject(request.error);
  });
}

async function put(store: string, value: unknown): Promise<void> {
  const db = await database();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(store, 'readwrite');
    transaction.objectStore(store).put(value);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error('本机实验记录保存失败。'));
    transaction.onabort = () => reject(transaction.error ?? new Error('本机实验记录保存已中断。'));
  });
}

export function readExperimentDraft(scopeKey: string) {
  return read<VesselExperimentDraft>('drafts', scopeKey);
}

export function readStepExperimentDraft(scopeKey:string,stepSequence:number) {
  return read<VesselExperimentDraft>('step-drafts',[scopeKey,stepSequence]);
}

export function readRunEvidenceHeader(id: string) {
  return read<StoredRun>('runs', id);
}

export async function listExperimentDrafts(baseScopeKey:string):Promise<VesselExperimentDraft[]> {
  const db = await database();
  return new Promise((resolve,reject)=> {
    const request = db.transaction('drafts','readonly').objectStore('drafts').getAll();
    request.onsuccess = () => resolve((request.result as VesselExperimentDraft[])
      .filter((draft)=>draft.scopeKey === baseScopeKey || draft.scopeKey.startsWith(`${baseScopeKey}:round:`))
      .sort((a,b)=>b.updatedAtMs-a.updatedAtMs));
    request.onerror = () => reject(request.error);
  });
}

export async function saveExperimentDraft(draft: VesselExperimentDraft):Promise<void> {
  const db = await database();
  return new Promise((resolve,reject)=> {
    const tx = db.transaction(['drafts','step-drafts'],'readwrite');
    tx.objectStore('drafts').put(draft);
    tx.objectStore('step-drafts').put(draft);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

export async function readRunEvidence(id: string): Promise<(VesselRunEvidence & { revision: number }) | undefined> {
  const db = await database();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['runs', 'trace-chunks', 'sensor-chunks','fine-step-chunks'], 'readonly');
    const metadata = transaction.objectStore('runs').get(id);
    const chunks = transaction.objectStore('trace-chunks').index('runId').getAll(id);
    const sensorChunks = transaction.objectStore('sensor-chunks').index('runId').getAll(id);
    const fineChunks = transaction.objectStore('fine-step-chunks').index('runId').getAll(id);
    transaction.oncomplete = () => {
      const stored = metadata.result as StoredRun | undefined;
      if (!stored) { resolve(undefined); return; }
      const trace = (chunks.result as TraceChunk[]).sort((a, b) => a.start - b.start).flatMap((chunk) => chunk.points);
      const nativeSensorSamples = (sensorChunks.result as SensorChunk[]).sort((a,b) => a.start-b.start).flatMap((chunk) => chunk.points);
      const fineStepSamples = (fineChunks.result as FineStepChunk[]).sort((a,b)=>a.start-b.start).flatMap((chunk)=>chunk.points);
      if (trace.length !== stored.traceLength || nativeSensorSamples.length !== (stored.nativeSampleCount ?? 0)
        || fineStepSamples.length !== (stored.fineSampleCount ?? 0)) {
        reject(new Error('本机运行的采样记录不完整。')); return;
      }
      resolve({ ...stored, trace, nativeSensorSamples, fineStepSamples });
    };
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });
}

export async function saveRunEvidence(run: VesselRunEvidence, expectedRevision: number): Promise<number> {
  const db = await database();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['runs', 'trace-chunks', 'sensor-chunks','fine-step-chunks'], 'readwrite');
    const runs = transaction.objectStore('runs');
    const request = runs.get(run.id);
    let conflict: Error | null = null;
    request.onsuccess = () => {
      const previous = request.result as StoredRun | undefined;
      const priorLength = previous?.traceLength ?? 0;
      const priorNativeCount = previous?.nativeSampleCount ?? 0;
      const priorFineCount = previous?.fineSampleCount ?? 0;
      if ((previous?.revision ?? 0) !== expectedRevision || priorLength > run.trace.length
        || priorNativeCount > run.nativeSensorSamples.length
        || priorFineCount > (run.fineStepSamples?.length ?? 0)
        || (previous && (previous.scopeKey !== run.scopeKey || previous.parameterHash !== run.parameterHash))) {
        conflict = new Error('这次运行已在另一页面更新，请重新读取记录后继续。');
        transaction.abort();
        return;
      }
      if (run.trace.length > priorLength) transaction.objectStore('trace-chunks').put({
        runId: run.id, start: priorLength, points: run.trace.slice(priorLength),
      } satisfies TraceChunk);
      if (run.nativeSensorSamples.length > priorNativeCount) transaction.objectStore('sensor-chunks').put({
        runId: run.id, start: priorNativeCount, points: run.nativeSensorSamples.slice(priorNativeCount),
      } satisfies SensorChunk);
      if ((run.fineStepSamples?.length ?? 0) > priorFineCount) transaction.objectStore('fine-step-chunks').put({
        runId:run.id,start:priorFineCount,points:run.fineStepSamples!.slice(priorFineCount),
      } satisfies FineStepChunk);
      const { trace, nativeSensorSamples, fineStepSamples, ...metadata } = run;
      runs.put({ ...metadata, revision: expectedRevision + 1, traceLength: trace.length,
        nativeSampleCount: nativeSensorSamples.length,fineSampleCount:fineStepSamples?.length ?? 0,
        uploadReceipt:previous?.uploadReceipt } satisfies StoredRun);
    };
    transaction.oncomplete = () => resolve(expectedRevision + 1);
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(conflict ?? transaction.error ?? new Error('本机运行保存已中断。'));
  });
}

export async function listRunEvidence(scopeKey: string): Promise<VesselRunSummary[]> {
  const db = await database();
  return new Promise((resolve, reject) => {
    const request = db.transaction('runs', 'readonly').objectStore('runs').index('scopeKey').getAll(scopeKey);
    request.onsuccess = () => resolve((request.result as StoredRun[]).map((run) => ({
      id: run.id, stepSequence: run.stepSequence, createdAtMs: run.createdAtMs, stoppedAtMs: run.stoppedAtMs,
      durationS: run.lastTimeS,
      sampleCount: run.traceLength, stopReason: run.stopReason,
      finalInput:run.changes.at(-1)?.input ?? run.initialInput,
      scopeKey: run.scopeKey, courseVersion: run.courseVersion, lastTimeS: run.lastTimeS,
      configuration: run.configuration, initialInput: run.initialInput, controllerSourceRunId: run.controllerSourceRunId,designStudentModelId:run.designStudentModelId,
      courseSettings:run.courseSettings,
      uploadedToReportRef:run.stoppedAtMs !== null && run.uploadReceipt
        && ['completed','failed'].includes(run.uploadReceipt.status) && run.uploadReceipt.controlCount === run.traceLength
        && run.uploadReceipt.nativeCount === run.nativeSampleCount && (run.uploadReceipt.fineCount ?? 0) === (run.fineSampleCount ?? 0)
        && Math.abs(run.uploadReceipt.lastTimeS-run.lastTimeS) < 1e-7 ? run.uploadReceipt.reportClientRef : undefined,
    })).sort((a, b) => b.createdAtMs - a.createdAtMs));
    request.onerror = () => reject(request.error);
  });
}

export async function saveRunUploadReceipt(runId:string,reportClientRef:string,receipt:VesselEvidenceProgress):Promise<void> {
  const db = await database();
  return new Promise((resolve,reject)=> {
    const tx = db.transaction('runs','readwrite');
    const store = tx.objectStore('runs');
    const request = store.get(runId);
    let failure:Error | null = null;
    request.onsuccess = () => {
      const run = request.result as StoredRun | undefined;
      if (!run || receipt.runRef !== runId || receipt.controlCount > run.traceLength
        || receipt.nativeCount > run.nativeSampleCount || (receipt.fineCount ?? 0) > (run.fineSampleCount ?? 0)) {
        failure = new Error('上传回执超出本机保存的记录，请读取最新进度后重试。');tx.abort();return;
      }
      store.put({...run,uploadReceipt:{...receipt,reportClientRef}} satisfies StoredRun);
    };
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(failure ?? tx.error);
  });
}

async function listByScope<T>(store: string, scopeKey: string): Promise<T[]> {
  const db = await database();
  return new Promise((resolve, reject) => {
    const request = db.transaction(store, 'readonly').objectStore(store).index('scopeKey').getAll(scopeKey);
    request.onsuccess = () => resolve(request.result as T[]);
    request.onerror = () => reject(request.error);
  });
}

export const saveFrozenStudentModel = (model: FrozenVesselStudentModel) => put('models', model);
export const listFrozenStudentModels = async (scopeKey: string) =>
  (await listByScope<FrozenVesselStudentModel>('models', scopeKey)).sort((a,b) => a.createdAtMs-b.createdAtMs);
export const saveModelComparison = (comparison: VesselModelComparison) => put('comparisons', comparison);
export const listModelComparisons = (scopeKey: string) => listByScope<VesselModelComparison>('comparisons', scopeKey);
export const saveLocalStepAttempt = (attempt: VesselLocalStepAttempt) => put('attempts', attempt);
export const listLocalStepAttempts = (scopeKey: string) => listByScope<VesselLocalStepAttempt>('attempts', scopeKey);
