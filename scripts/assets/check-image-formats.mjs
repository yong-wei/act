import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { extname } from 'node:path';
import sharp from 'sharp';

const BASE = process.argv.find(value => value.startsWith('--base='))?.slice('--base='.length);
const STAGED = process.argv.includes('--staged');
const BITMAP = /\.(?:avif|bmp|gif|heic|heif|jpe?g|png|tiff?|webp)$/iu;
const MODEL_TEXTURE = /^public\/assets\/model-releases\/[^/]+\/v\d+\.\d+\.\d+\/textures\/[a-f\d]{64}\.png$/u;
const LOGO_SOURCE = 'public/assets/platform-brand/deepblue-smart-control-logo-source.png';

function list(...arguments_) {
  return execFileSync('git', arguments_, { encoding: 'utf8' }).split('\0').filter(Boolean);
}

const delta = STAGED
  ? list('diff', '--cached', '--name-only', '-z', '--diff-filter=ACMR')
  : BASE ? list('diff', '--name-only', '-z', '--diff-filter=ACMR', BASE, 'HEAD') : [];
const files = new Set(STAGED ? delta : list('ls-files', '-z', 'public', 'src').concat(delta));
const failures = [];
for (const file of files) {
  const shipped = /^(?:public|src)\//u.test(file);
  const authoredForDelivery = /^course-content\/(?:authoring\/lessons\/[^/]+\/media\/processed|runtime\/lessons\/[^/]+\/media)\//u.test(file);
  if ((!shipped && !authoredForDelivery) || !BITMAP.test(file) || (!STAGED && !existsSync(file))) continue;
  if (MODEL_TEXTURE.test(file) || file === LOGO_SOURCE) continue;
  if (extname(file) !== '.webp') {
    failures.push(`${file} 必须采用 WebP`);
    continue;
  }
  try {
    const encoded = STAGED ? execFileSync('git', ['show', `:${file}`], { maxBuffer: 64 * 1024 * 1024 }) : readFileSync(file);
    const info = await sharp(encoded, { failOn: 'error' }).metadata();
    if (info.format !== 'webp' || !info.width || !info.height) throw Error('format');
  } catch {
    failures.push(`${file} 不是可识别的 WebP 图片`);
  }
}
if (failures.length) {
  console.error(failures.join('\n'));
  process.exitCode = 1;
} else {
  console.log('图片格式准入通过。');
}
