export const ILAB_AI_DEPLOYMENTS = ['公有云服务', '私有化部署', '混合服务', '本地运行'] as const;

export type IlabAiDeployment = (typeof ILAB_AI_DEPLOYMENTS)[number];

export const ILAB_AI_DATA_KEYS = [
  'ai_call_count',
  'ai_models_used',
  'ai_usage_scenarios',
  'ai_input_token_count',
  'ai_output_token_count',
  'ai_remark',
] as const;

export interface AiUsageLedger {
  callCount: number;
  inputTokens: number;
  outputTokens: number;
  scenarios: string[];
  model: string | null;
  provider: string | null;
  deployment: IlabAiDeployment | null;
  remark: string;
}

export interface AiDataModel {
  model: string;
  version: string;
  deployment: IlabAiDeployment;
  provider: string;
}

export interface IlabAiData {
  ai_call_count: number;
  ai_models_used: AiDataModel[];
  ai_usage_scenarios: string[];
  ai_input_token_count: number;
  ai_output_token_count: number;
  ai_remark: string;
}

export function emptyAiLedger(): AiUsageLedger {
  return {
    callCount: 0,
    inputTokens: 0,
    outputTokens: 0,
    scenarios: [],
    model: null,
    provider: null,
    deployment: null,
    remark: '本次实验尚未产生可核验的模型调用。',
  };
}

export function isAiUsageLedger(value: unknown): value is AiUsageLedger {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const record = value as Partial<AiUsageLedger>;
  return typeof record.callCount === 'number'
    && typeof record.inputTokens === 'number'
    && typeof record.outputTokens === 'number'
    && Array.isArray(record.scenarios)
    && typeof record.remark === 'string';
}

export function recordAiCall(
  ledger: AiUsageLedger,
  call: { scenario: string; model: string; provider: string; deployment: IlabAiDeployment; inputTokens: number; outputTokens: number; usageMissing: boolean },
): AiUsageLedger {
  const scenarios = ledger.scenarios.includes(call.scenario) ? ledger.scenarios : [...ledger.scenarios, call.scenario];
  const remark = call.usageMissing
    ? '已发生模型调用，但服务商响应没有返回 token 用量，因此 token 计为 0，没有估算。'
    : 'token 用量来自模型服务商响应，没有估算。版本号使用模型标识，服务商未另给版本号。';
  return {
    callCount: ledger.callCount + 1,
    inputTokens: ledger.inputTokens + Math.max(0, Math.floor(call.inputTokens)),
    outputTokens: ledger.outputTokens + Math.max(0, Math.floor(call.outputTokens)),
    scenarios,
    model: call.model,
    provider: call.provider,
    deployment: call.deployment,
    remark,
  };
}

export function buildAiData(ledger: AiUsageLedger): IlabAiData {
  if (ledger.callCount < 0 || ledger.inputTokens < 0 || ledger.outputTokens < 0) {
    throw new Error('ai_data 用量不能为负。');
  }
  if (ledger.callCount > 0 && (!ledger.model || !ledger.provider || !ledger.deployment || ledger.scenarios.length === 0)) {
    throw new Error('存在模型调用时，ai_data 的模型和使用场景不能为空。');
  }
  return {
    ai_call_count: ledger.callCount,
    ai_models_used: ledger.callCount > 0 && ledger.model && ledger.provider && ledger.deployment
      ? [{
        model: ledger.model,
        version: ledger.model,
        deployment: ledger.deployment,
        provider: ledger.provider,
      }]
      : [],
    ai_usage_scenarios: ledger.callCount > 0 ? ledger.scenarios : [],
    ai_input_token_count: ledger.inputTokens,
    ai_output_token_count: ledger.outputTokens,
    ai_remark: ledger.remark.slice(0, 500),
  };
}

export function assertAiDataKeys(data: IlabAiData): void {
  const keys = Object.keys(data);
  if (keys.length !== ILAB_AI_DATA_KEYS.length || ILAB_AI_DATA_KEYS.some((key) => !keys.includes(key))) {
    throw new Error('ai_data 含有未定义字段或缺少字段。');
  }
}
