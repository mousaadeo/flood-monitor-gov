#!/usr/bin/env node
/**
 * Post-build script: Fix __vite__mapDeps TDZ bug on iOS Safari < 15
 *
 * Vite generates: const __vite__mapDeps=(i,m=__vite__mapDeps,...)
 * The self-reference in default parameter causes TDZ ReferenceError on iOS Safari < 15
 * because 'const' variables are in TDZ until fully initialized.
 *
 * Fix: replace 'const __vite__mapDeps=' with 'var __vite__mapDeps='
 * 'var' is hoisted and has no TDZ, so self-reference in default param works fine.
 */

import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs';
import { join, extname } from 'path';

const ASSETS_DIR = new URL('../dist/public/assets', import.meta.url).pathname;

function fixFile(filePath) {
  const content = readFileSync(filePath, 'utf8');
  if (!content.includes('const __vite__mapDeps=')) return false;
  
  const fixed = content.replace(/const __vite__mapDeps=/g, 'var __vite__mapDeps=');
  writeFileSync(filePath, fixed, 'utf8');
  return true;
}

let fixedCount = 0;
const files = readdirSync(ASSETS_DIR);
for (const file of files) {
  if (extname(file) !== '.js') continue;
  const filePath = join(ASSETS_DIR, file);
  if (fixFile(filePath)) {
    console.log(`[fix-mapdeps-tdz] Fixed: ${file}`);
    fixedCount++;
  }
}

console.log(`[fix-mapdeps-tdz] Done. Fixed ${fixedCount} file(s).`);
