#!/usr/bin/env node
/**
 * Build script for domx
 * Creates CJS, ESM, and minified bundles
 */

const esbuild = require('esbuild');
const fs = require('fs');
const path = require('path');

const outdir = path.join(__dirname, '..', 'dist');

// Ensure dist directory exists
if (!fs.existsSync(outdir)) {
  fs.mkdirSync(outdir);
}

async function build() {
  // domx.js - ESM
  await esbuild.build({
    entryPoints: ['src/domx.js'],
    bundle: true,
    format: 'esm',
    outfile: 'dist/domx.esm.js',
    minify: true,
    sourcemap: true,
  });

  // domx.js - CJS
  await esbuild.build({
    entryPoints: ['src/domx.js'],
    bundle: true,
    format: 'cjs',
    outfile: 'dist/domx.js',
    minify: true,
    sourcemap: true,
  });

  // domx.js - IIFE for browser
  await esbuild.build({
    entryPoints: ['src/domx.js'],
    bundle: true,
    format: 'iife',
    globalName: 'domx',
    outfile: 'dist/domx.min.js',
    minify: true,
    sourcemap: true,
  });

  // domx-htmx.js - ESM
  await esbuild.build({
    entryPoints: ['src/domx-htmx.js'],
    bundle: true,
    format: 'esm',
    outfile: 'dist/domx-htmx.esm.js',
    minify: true,
    sourcemap: true,
  });

  // domx-htmx.js - CJS
  await esbuild.build({
    entryPoints: ['src/domx-htmx.js'],
    bundle: true,
    format: 'cjs',
    outfile: 'dist/domx-htmx.js',
    minify: true,
    sourcemap: true,
  });

  // domx-htmx.js - IIFE for browser
  await esbuild.build({
    entryPoints: ['src/domx-htmx.js'],
    bundle: true,
    format: 'iife',
    globalName: 'domxHtmx',
    outfile: 'dist/domx-htmx.min.js',
    minify: true,
    sourcemap: true,
  });

  console.log('Build complete!');

  // Report sizes
  const files = fs.readdirSync(outdir).filter(f => f.endsWith('.js'));
  for (const file of files) {
    const stat = fs.statSync(path.join(outdir, file));
    console.log(`  ${file}: ${stat.size} bytes`);
  }
}

build().catch(err => {
  console.error(err);
  process.exit(1);
});
