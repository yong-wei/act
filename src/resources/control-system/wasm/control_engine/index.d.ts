/* tslint:disable */
/* eslint-disable */

export class VesselSimulationSession {
    free(): void;
    [Symbol.dispose](): void;
    advance(seconds: number, input_json: string): string;
    constructor(configuration_json: string);
    read(): string;
    reset(): void;
    restore(snapshot: string): void;
    setPaused(paused: boolean): void;
    snapshot(): string;
}

export function compute_analysis(request_json: string): string;

export function compute_nonlinear_analysis(request_json: string): string;

export function compute_rl_training(request_json: string): string;

export function compute_simulation_step(request_json: string): string;

export function compute_virtual_simulation_step(request_json: string): string;

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
    readonly memory: WebAssembly.Memory;
    readonly __wbg_vesselsimulationsession_free: (a: number, b: number) => void;
    readonly compute_analysis: (a: number, b: number) => [number, number, number, number];
    readonly compute_nonlinear_analysis: (a: number, b: number) => [number, number, number, number];
    readonly compute_rl_training: (a: number, b: number) => [number, number, number, number];
    readonly compute_simulation_step: (a: number, b: number) => [number, number, number, number];
    readonly compute_virtual_simulation_step: (a: number, b: number) => [number, number, number, number];
    readonly vesselsimulationsession_advance: (a: number, b: number, c: number, d: number) => [number, number, number, number];
    readonly vesselsimulationsession_new: (a: number, b: number) => [number, number, number];
    readonly vesselsimulationsession_read: (a: number) => [number, number, number, number];
    readonly vesselsimulationsession_reset: (a: number) => [number, number];
    readonly vesselsimulationsession_restore: (a: number, b: number, c: number) => [number, number];
    readonly vesselsimulationsession_setPaused: (a: number, b: number) => void;
    readonly vesselsimulationsession_snapshot: (a: number) => [number, number, number, number];
    readonly __wbindgen_externrefs: WebAssembly.Table;
    readonly __wbindgen_malloc: (a: number, b: number) => number;
    readonly __wbindgen_realloc: (a: number, b: number, c: number, d: number) => number;
    readonly __externref_table_dealloc: (a: number) => void;
    readonly __wbindgen_free: (a: number, b: number, c: number) => void;
    readonly __wbindgen_start: () => void;
}

export type SyncInitInput = BufferSource | WebAssembly.Module;

/**
 * Instantiates the given `module`, which can either be bytes or
 * a precompiled `WebAssembly.Module`.
 *
 * @param {{ module: SyncInitInput }} module - Passing `SyncInitInput` directly is deprecated.
 *
 * @returns {InitOutput}
 */
export function initSync(module: { module: SyncInitInput } | SyncInitInput): InitOutput;

/**
 * If `module_or_path` is {RequestInfo} or {URL}, makes a request and
 * for everything else, calls `WebAssembly.instantiate` directly.
 *
 * @param {{ module_or_path: InitInput | Promise<InitInput> }} module_or_path - Passing `InitInput` directly is deprecated.
 *
 * @returns {Promise<InitOutput>}
 */
export default function __wbg_init (module_or_path?: { module_or_path: InitInput | Promise<InitInput> } | InitInput | Promise<InitInput>): Promise<InitOutput>;
