#!/usr/bin/env node
// Compat: conserve l'usage
//   node tools/export-now.cjs /abs/path/now.json
// et délègue à build-now.cjs en s'appuyant sur les receipts.

const { spawnSync } = require('child_process');
const path = require('path');
const fs = require('fs');

// --- Arg obligatoire (on ne casse pas l'usage actuel) ---
const outArg = process.argv[2];
if (!outArg) {
  console.error('usage: node tools/export-now.cjs /abs/path/now.json');
  process.exit(1);
}

// Normalise la sortie même si l'utilisateur passe un chemin relatif.
const outPath = path.isAbsolute(outArg)
  ? outArg
  : path.resolve(process.cwd(), outArg);

// Dir des reçus (projet/receipts). Chemin explicite pour éviter les cwd surprises.
const receiptsDir = path.join(__dirname, '..', 'receipts');

// Tolérance au typo historique éventuel: build-now.cjs vs buil-now.cjs
const buildNowPrimary = path.join(__dirname, 'build-now.cjs');
const buildNowFallback = path.join(__dirname, 'buil-now.cjs');
const buildNowPath = fs.existsSync(buildNowPrimary)
  ? buildNowPrimary
  : buildNowFallback;

// build-now.cjs attend: <receiptsDir> <outPath>
const args = [buildNowPath, receiptsDir, outPath];

const r = spawnSync(process.execPath, args, {
  stdio: 'inherit',
  env: process.env,
});

process.exit(typeof r.status === 'number' ? r.status : 1);
