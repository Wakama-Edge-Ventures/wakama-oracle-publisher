#!/usr/bin/env node
// tools/build-now.cjs
// CJS, Node >=18

const fs = require('fs');
const path = require('path');

// Args compatibles (ne rien casser)
const receiptsDir = process.argv[2] || 'receipts';

// Par défaut on conserve ton chemin actuel (cross-repo).
// Si tu veux sortir localement dans ce repo, passe un 3e argument.
const outPath =
  process.argv[3] ||
  path.join(__dirname, '..', '..', 'wakama-dashboard', 'public', 'now.json');

// Utils
const readJsonSafe = (p) => {
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch {
    return null;
  }
};
const uniq = (arr) => Array.from(new Set(arr));

const isDir = (p) => {
  try {
    return fs.statSync(p).isDirectory();
  } catch {
    return false;
  }
};

function walk(dir) {
  let out = [];
  let entries = [];
  try {
    entries = fs.readdirSync(dir);
  } catch {
    return out;
  }

  for (const name of entries) {
    const p = path.join(dir, name);
    let st;
    try {
      st = fs.statSync(p);
    } catch {
      continue;
    }
    if (st.isDirectory()) {
      out = out.concat(walk(p));
    } else {
      out.push(p);
    }
  }
  return out;
}

function findReceiptsUnder(root) {
  const all = walk(root);
  return all.filter(
    (p) =>
      p.includes(`${path.sep}receipts${path.sep}`) &&
      p.endsWith('-receipt.json')
  );
}

// ---- M2: team canonical ----
const CANONICAL_TEAM_ID = 'Wakama_team';

const TEAM_ALIASES = {
  'Wakama Core': CANONICAL_TEAM_ID,
  'team_wakama': CANONICAL_TEAM_ID,
  'Wakama Team': CANONICAL_TEAM_ID,
  'Wakama team': CANONICAL_TEAM_ID,
  'Wakama_team': CANONICAL_TEAM_ID,
  'CAPN Wakama Team': CANONICAL_TEAM_ID,
  'UJLoG Wakama Team': CANONICAL_TEAM_ID,
};

function normalizeTeam(raw) {
  const t = (raw || '').toString().trim();
  if (!t) return CANONICAL_TEAM_ID;
  return TEAM_ALIASES[t] || t;
}

function inferTeamFromFile(fileName) {
  const f = (fileName || '').toLowerCase();

  if (f.includes('scak-')) return 'team-scak-coop';
  if (f.includes('makm2-')) return 'team-makm2';
  if (f.includes('techlab-')) return 'team-techlab-cme';

  return '';
}

// ---- M1 compat: fallback count depuis le nom du batch ----
// Ex: scak-korhogo-1000-zone-A-Prod-1.json -> 1000
function inferCountFromFile(fileName) {
  const f = (fileName || '').toLowerCase();
  const m = f.match(/-(\d{2,})-(?:[^/]+)\.json$/) || f.match(/-(\d{2,})-/);
  if (!m) return null;

  const n = Number.parseInt(m[1], 10);
  if (!Number.isFinite(n) || n <= 0) return null;

  // garde-fou léger pour éviter des nombres absurdes
  if (n > 5_000_000) return null;

  return n;
}

function normalizeSource(raw) {
  const s = (raw || '').toString().trim();
  return s; // on ne force pas un default ici pour ne rien casser
}

function normalizeStatus(rawStatus, tx) {
  const s = (rawStatus || '').toString().trim();
  if (s && s !== 'unknown') return s;
  return tx ? 'submitted' : 'n/a';
}

// Collecte (2 modes)
// 1) Mode classique: receiptsDir contient directement des .json
// 2) Mode root-scan: receiptsDir est un root (ex: ~/dev/wakama),
//    on scanne tous les */receipts/*-receipt.json
let files = [];

if (isDir(receiptsDir)) {
  const direct = fs
    .readdirSync(receiptsDir)
    .filter((f) => f.endsWith('.json'));

  if (direct.length > 0) {
    files = direct.map((f) => path.join(receiptsDir, f)).sort();
  } else {
    files = findReceiptsUnder(receiptsDir).sort();
  }
}

// Build items
const items = [];
for (const p of files) {
  const f = path.basename(p);
  const j = readJsonSafe(p);
  if (!j) continue;

  // Compat: certains reçus peuvent avoir IpfsHash au lieu de cid
  const cid = j.cid || j.IpfsHash || null;
  const tx = j.tx || '';
  const sha256 = j.sha256 || '';

  // ts prioritaire côté reçu, sinon fallback sur nom de fichier (sans .json)
  const ts = (j.ts && String(j.ts)) || f.replace(/\.json$/, '');

  if (!cid) continue; // ignorer reçus incomplets

  // ✅ team: accepte legacy keys + fallback par file + fallback canonique
  const rawTeam =
    (typeof j.team === 'string' && j.team) ||
    (typeof j.team_id === 'string' && j.team_id) ||
    (typeof j.teamKey === 'string' && j.teamKey) ||
    inferTeamFromFile(j.file || f) ||
    '';

  const team = normalizeTeam(rawTeam) || CANONICAL_TEAM_ID;

  // ✅ source: string safe
  const source = normalizeSource(j.source);

  // ✅ status: évite "unknown" si tx présent
  const status = normalizeStatus(j.status, tx);

  // ✅ compat M1/M2 points/count + legacy keys + fallback filename
  const metaCount =
    j.meta && typeof j.meta.count === 'number' ? j.meta.count : null;

  const count =
    typeof j.count === 'number'
      ? j.count
      : typeof j.points === 'number'
      ? j.points
      : typeof j.events === 'number'
      ? j.events
      : typeof j.records === 'number'
      ? j.records
      : typeof j.rows === 'number'
      ? j.rows
      : typeof metaCount === 'number'
      ? metaCount
      : inferCountFromFile(j.file || '')
      ? inferCountFromFile(j.file || '')
      : null;

  const points = count;

  items.push({
    cid,
    tx,
    file: j.file || f, // garder le nom “logique” si présent
    sha256,
    gw: j.gw || null,

    // temps
    ts,
    ts_min: j.ts_min || null,
    ts_max: j.ts_max || null,

    // métriques
    count,
    points,

    status,
    slot: typeof j.slot === 'number' ? j.slot : null,
    source,
    team,
  });
}

// Tri: plus récent en premier par ts (string compare OK sur ISO)
items.sort((a, b) => String(b.ts).localeCompare(String(a.ts)));

const totals = {
  files: items.length,
  cids: uniq(items.map((it) => it.cid)).length,
  onchainTx: items.filter((it) => it.tx && String(it.tx).length > 0).length,
  lastTs: items.length ? items[0].ts : '—',
};

// Sortie: ne pas tronquer ici; le dashboard tranche déjà à 50
const out = { totals, items };

fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(out, null, 2), 'utf8');
console.log(`Wrote snapshot: ${outPath}`);
