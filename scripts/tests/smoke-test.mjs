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

console.log('Smoke test passed.');
