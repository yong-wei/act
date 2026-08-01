import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(scriptDir, '../..');
const schemaPath = path.join(rootDir, 'prisma', 'schema.prisma');
const authRoutePath = path.join(
  rootDir,
  'src',
  'app',
  'api',
  'auth',
  '[...nextauth]',
  'route.ts',
);
const envExamplePath = path.join(rootDir, '.env.example');
const ciWorkflowPath = path.join(rootDir, '.github', 'workflows', 'ci.yml');
const shipModelPreviewPath = path.join(
  rootDir,
  'src',
  'resources',
  'simulations',
  'ship-model-preview.tsx',
);

const assertFile = (filePath) => {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Missing file: ${filePath}`);
  }
};

assertFile(schemaPath);
assertFile(authRoutePath);
assertFile(envExamplePath);
assertFile(ciWorkflowPath);
assertFile(shipModelPreviewPath);

const schemaContent = fs.readFileSync(schemaPath, 'utf8');
if (!/provider\s+=\s+"postgresql"/.test(schemaContent)) {
  throw new Error('Prisma schema is not configured for PostgreSQL.');
}
if (!schemaContent.includes('binaryTargets')) {
  throw new Error('Prisma schema must define binaryTargets for container runtime compatibility.');
}
if (!schemaContent.includes('"linux-musl-openssl-3.0.x"')) {
  throw new Error('Prisma schema binaryTargets must include linux-musl-openssl-3.0.x.');
}

const shipModelPreviewContent = fs.readFileSync(shipModelPreviewPath, 'utf8');
if (shipModelPreviewContent.includes('PRELOAD_MODELS.forEach')) {
  throw new Error('Home ship preview should not eagerly preload all GLB models.');
}

const envContent = fs.readFileSync(envExamplePath, 'utf8');
const ciWorkflowContent = fs.readFileSync(ciWorkflowPath, 'utf8');
const requiredVars = [
  'DATABASE_URL=',
  'NEXTAUTH_URL=',
  'NEXTAUTH_SECRET=',
  'SIM_SERVICE_URL=',
  'LLM_SERVICE_URL=',
];

const missingVars = requiredVars.filter((entry) => !envContent.includes(entry));
if (missingVars.length > 0) {
  throw new Error(`.env.example missing keys: ${missingVars.join(', ')}`);
}

if (!ciWorkflowContent.includes('dtolnay/rust-toolchain@stable')) {
  throw new Error('CI workflow must install the stable Rust toolchain before build.');
}
if (!ciWorkflowContent.includes('targets: wasm32-unknown-unknown')) {
  throw new Error('CI workflow must add the wasm32-unknown-unknown target before build.');
}
if (!ciWorkflowContent.includes('cargo install wasm-pack --locked --version 0.15.0')) {
  throw new Error('CI workflow must install wasm-pack 0.15.0 before npm run build.');
}
if (!/- name: Build\s+env:\s+NODE_MAX_OLD_SPACE_SIZE: 12288\s+run: npm run build/.test(ciWorkflowContent)) {
  throw new Error('CI build must use a 12288 MiB Node old-space heap.');
}

const wasmBuildScriptPath = path.join(rootDir, 'scripts', 'wasm', 'build-control-engine.mjs');
const wasmBuildScriptContent = fs.readFileSync(wasmBuildScriptPath, 'utf8');
if (!wasmBuildScriptContent.includes('FORCE_WASM_BUILD')) {
  throw new Error('Wasm build script must support FORCE_WASM_BUILD for explicit rebuilds.');
}
if (!wasmBuildScriptContent.includes('.build-hash')) {
  throw new Error('Wasm build script must persist a build hash for smart rebuild skipping.');
}
if (!wasmBuildScriptContent.includes('rust/control-engine/src')) {
  throw new Error('Wasm build script must include Rust source files in the input hash.');
}
if (!wasmBuildScriptContent.includes('wasm-pack --version')) {
  throw new Error('Wasm build script must include wasm-pack version in the input hash.');
}

console.log('Smoke test passed.');
