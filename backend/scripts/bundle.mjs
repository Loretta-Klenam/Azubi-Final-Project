import { build } from 'esbuild';
import { mkdir } from 'fs/promises';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

await mkdir(resolve(root, 'dist'), { recursive: true });

await build({
  entryPoints: [resolve(root, 'src/index.ts')],
  bundle: true,
  platform: 'node',
  target: 'node22',
  format: 'cjs',
  outfile: resolve(root, 'dist/index.js'),
  external: ['@aws-sdk/*'],
  sourcemap: false,
  minify: false,
});

console.log('Lambda handler bundled to dist/index.js');
