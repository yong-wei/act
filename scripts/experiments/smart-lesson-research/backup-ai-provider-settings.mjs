import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import pg from 'pg';

const OUTPUT_FILE = path.resolve(
  process.cwd(),
  'scripts/experiments/outputs/2026-09-08-autocontrol-root-locus/ai_provider_settings_before_provider_change.json',
);

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 2 });
try {
  const result = await pool.query(
    'select value from "PlatformSetting" where key = $1',
    ['ai_provider_settings'],
  );
  if (result.rowCount === 0) {
    throw new Error('PlatformSetting 中不存在 ai_provider_settings');
  }
  const value = result.rows[0].value;
  fs.mkdirSync(path.dirname(OUTPUT_FILE), { recursive: true });
  fs.writeFileSync(OUTPUT_FILE, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  const sanitized = {
    activeProvider: value.activeProvider,
    providers: value.providers.map((provider) => ({
      id: provider.id,
      name: provider.name,
      providerKind: provider.providerKind,
      baseURL: provider.baseURL,
      authMode: provider.authMode,
      secretRef: provider.secretRef,
      selectedModel: provider.selectedModel,
      enabled: provider.enabled,
      priority: provider.priority,
      health: provider.health,
      capabilities: provider.capabilities,
      models: provider.models.map((model) => ({
        id: model.id,
        label: model.label,
        model: model.model,
        options: model.options ?? null,
      })),
    })),
  };
  console.log(JSON.stringify(sanitized, null, 2));
  console.error(`[backup] ${OUTPUT_FILE}`);
} finally {
  await pool.end();
}
