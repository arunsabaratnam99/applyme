import * as esbuild from 'esbuild';
import { copyFileSync, mkdirSync, cpSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const src = join(root, 'src');
const dist = join(root, 'dist');

mkdirSync(dist, { recursive: true });
mkdirSync(join(dist, 'icons'), { recursive: true });

// Bundle background, content, popup scripts
await esbuild.build({
  entryPoints: [
    join(src, 'background.ts'),
    join(src, 'content.ts'),
    join(src, 'popup.ts'),
  ],
  bundle: true,
  outdir: dist,
  format: 'esm',
  platform: 'browser',
  target: 'chrome120',
  minify: process.env.NODE_ENV === 'production',
  sourcemap: process.env.NODE_ENV !== 'production',
});

// Copy static assets
copyFileSync(join(src, 'popup.html'), join(dist, 'popup.html'));
copyFileSync(join(src, 'manifest.json'), join(dist, 'manifest.json'));

// Copy icons if they exist (placeholder — real icons would live in src/icons/)
try {
  cpSync(join(src, 'icons'), join(dist, 'icons'), { recursive: true });
} catch {
  // No icons directory yet — skip
}

console.log('Extension built to', dist);
