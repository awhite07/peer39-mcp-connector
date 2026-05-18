#!/usr/bin/env node
// Copy HTML views from src/setup/views into dist/setup/views so the runtime
// can find them when started from `node dist/index.js`.
import { cpSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repo = join(here, '..');
const srcDir = join(repo, 'src', 'setup', 'views');
const dstDir = join(repo, 'dist', 'setup', 'views');

if (!existsSync(srcDir)) {
  console.error(`[copy-views] no source dir at ${srcDir}`);
  process.exit(0);
}
mkdirSync(dstDir, { recursive: true });
cpSync(srcDir, dstDir, { recursive: true });
console.log(`[copy-views] copied ${srcDir} -> ${dstDir}`);
