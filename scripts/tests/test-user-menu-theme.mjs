import { readFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

async function main() {
  const filePath = path.resolve('src/components/shared/user-menu.tsx');
  const source = await readFile(filePath, 'utf8');

  const requiredTokens = [
    'surface-card-soft',
    'text-foreground',
    'text-subtle',
    'bg-background',
  ];

  const missing = requiredTokens.filter((token) => !source.includes(token));
  if (missing.length > 0) {
    throw new Error(`user-menu 缺少主题语义样式：${missing.join(', ')}`);
  }

  const forbiddenPatterns = [
    'bg-slate-',
    'text-slate-',
    'border-slate-',
    'text-white',
  ];

  const matchedForbidden = forbiddenPatterns.filter((pattern) => source.includes(pattern));
  if (matchedForbidden.length > 0) {
    throw new Error(`user-menu 仍包含硬编码配色：${matchedForbidden.join(', ')}`);
  }

  console.log('user-menu theme test passed');
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});

