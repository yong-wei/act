import {
  adminLogin,
  getAdminAISettings,
  saveAdminAISettings,
  testAdminAIModel,
} from './admin-auth.mjs';

function option(argv, name, fallback) {
  const index = argv.indexOf(name);
  return index >= 0 ? argv[index + 1] : fallback;
}

function assertOk(label, response, allowedStatuses = [200]) {
  if (!allowedStatuses.includes(response.status)) {
    throw new Error(`${label} 失败 status=${response.status} body=${JSON.stringify(response.json)}`);
  }
}

async function testOnly(argv) {
  const providerId = option(argv, '--provider-id', '');
  const model = option(argv, '--model', '');
  if (!providerId || !model) throw new Error('--provider-id 与 --model 必填');
  const admin = await adminLogin();
  const response = await testAdminAIModel(admin.cookieHeader, providerId, model);
  console.log(JSON.stringify({ status: response.status, body: response.json }, null, 2));
  if (response.status !== 200 || response.json?.ok !== true) {
    console.error(`[test] provider=${providerId} model=${model} 不可用`);
    process.exitCode = 1;
  }
}

async function switchOnly(argv) {
  const providerId = option(argv, '--provider-id', '');
  const model = option(argv, '--model', '');
  if (!providerId || !model) throw new Error('--provider-id 与 --model 必填');
  const admin = await adminLogin();
  const currentResponse = await getAdminAISettings(admin.cookieHeader);
  assertOk('读取当前 AI 设置', currentResponse);
  const settings = currentResponse.json;
  delete settings.runtimeStates;
  delete settings.operationLedger;
  const provider = settings.providers.find((candidate) => candidate.id === providerId);
  if (!provider) throw new Error(`provider 不存在: ${providerId}`);
  if (!provider.models.some((candidate) => candidate.model === model)) {
    throw new Error(`model 不在 provider.models 中: ${model}`);
  }
  provider.selectedModel = model;
  settings.activeProvider = providerId;
  const saveResponse = await saveAdminAISettings(admin.cookieHeader, settings);
  assertOk('保存 AI 设置', saveResponse);
  console.log(JSON.stringify({
    status: saveResponse.status,
    activeProvider: saveResponse.json?.activeProvider,
    selectedModel: saveResponse.json?.providers?.find((candidate) => candidate.id === providerId)?.selectedModel,
  }, null, 2));
}

async function main() {
  const argv = process.argv.slice(2);
  const command = argv[0];
  if (command === 'test') await testOnly(argv.slice(1));
  else if (command === 'switch') await switchOnly(argv.slice(1));
  else throw new Error('用法: provider-compat-tool.mjs test --provider-id X --model Y | switch --provider-id X --model Y');
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
