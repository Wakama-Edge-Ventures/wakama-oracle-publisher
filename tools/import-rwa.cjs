#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const rwaDir = path.resolve(__dirname, '..', '..', 'wakama-rwa-templates', 'receipts');
const pubDir = path.resolve(__dirname, '..', 'receipts');

if (!fs.existsSync(rwaDir)) {
  console.error('RWA receipts dir not found:', rwaDir);
  process.exit(1);
}

fs.mkdirSync(pubDir, { recursive: true });

const files = fs.readdirSync(rwaDir).filter(f => f.endsWith('.json'));
for (const f of files) {
  const src = path.join(rwaDir, f);
  const dst = path.join(pubDir, f);
  fs.copyFileSync(src, dst);
  console.log('Imported', f);
}

console.log('Done.');
