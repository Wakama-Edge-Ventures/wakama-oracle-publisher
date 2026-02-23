#!/usr/bin/env node
// Compat: conserve l'usage
//   node tools/export-now.cjs /abs/path/now.json
// Nouveau (optionnel):
//   RECEIPTS_DIR=receipts_mainnet node tools/export-now.cjs now.json
//   node tools/export-now.cjs now.json receipts_mainnet

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
const outPath = path.isAbsolute(outArg) ? outArg : path.resolve(process.cwd(), outArg);

// Receipts dir:
// - priorité à ENV RECEIPTS_DIR
// - sinon 2e arg optionnel
// - sinon fallback historique: ../receipts
const receiptsArg = process.argv[3];
const receiptsRaw = process.env.RECEIPTS_DIR || receiptsArg || path.join(__dirname, '..', 'receipts');
const receiptsDir = path.isAbsolute(receiptsRaw) ? receiptsRaw : path.resolve(process.cwd(), receiptsRaw);

// Tolérance au typo historique éventuel: build-now.cjs vs buil-now.cjs
const buildNowPrimary = path.join(__dirname, 'build-now.cjs');
const buildNowFallback = path.join(__dirname, 'buil-now.cjs');
const buildNowPath = fs.existsSync(buildNowPrimary) ? buildNowPrimary : buildNowFallback;

// build-now.cjs attend: <receiptsDir> <outPath>
const args = [buildNowPath, receiptsDir, outPath];

const r = spawnSync(process.execPath, args, {
  stdio: 'inherit',
  env: process.env,
});

process.exit(typeof r.status === 'number' ? r.status : 1);