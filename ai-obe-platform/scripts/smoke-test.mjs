import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(scriptDir, '..');
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

const assertFile = (filePath) => {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Missing file: ${filePath}`);
  }
};

assertFile(schemaPath);
assertFile(authRoutePath);
assertFile(envExamplePath);

const schemaContent = fs.readFileSync(schemaPath, 'utf8');
if (!schemaContent.includes('provider = "postgresql"')) {
  throw new Error('Prisma schema is not configured for PostgreSQL.');
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
