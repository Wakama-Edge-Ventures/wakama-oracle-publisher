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

// ---- M2: team canonical ----
const CANONICAL_TEAM_ID = 'Wakama_team';

const TEAM_ALIASES = {
  'Wakama Core': CANONICAL_TEAM_ID,
  'team_wakama': CANONICAL_TEAM_ID,
  'Wakama Team': CANONICAL_TEAM_ID,
  'Wakama team': CANONICAL_TEAM_ID,
  'Wakama_team': CANONICAL_TEAM_ID,
};

function normalizeTeam(raw) {
  const t = (raw || '').toString().trim();
  if (!t) return CANONICAL_TEAM_ID; // ✅ default canonique
  return TEAM_ALIASES[t] || t;
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

// Collecte
const files = (fs.existsSync(receiptsDir) ? fs.readdirSync(receiptsDir) : [])
  .filter((f) => f.endsWith('.json'))
  .sort(); // tri alpha; on triera par ts plus bas

const items = [];
for (const f of files) {
  const p = path.join(receiptsDir, f);
  const j = readJsonSafe(p);
  if (!j) continue;

  // Compat: certains reçus peuvent avoir IpfsHash au lieu de cid
  const cid = j.cid || j.IpfsHash || null;
  const tx = j.tx || '';
  const sha256 = j.sha256 || '';

  // ts prioritaire côté reçu, sinon fallback sur nom de fichier (sans .json)
  const ts = (j.ts && String(j.ts)) || f.replace(/\.json$/, '');

  if (!cid) continue; // ignorer reçus incomplets

  // ✅ team: accepte legacy keys + fallback canonique
  const rawTeam =
    (typeof j.team === 'string' && j.team) ||
    (typeof j.team_id === 'string' && j.team_id) ||
    (typeof j.teamKey === 'string' && j.teamKey) ||
    '';

  const team = normalizeTeam(rawTeam);

  // ✅ source: string safe
  const source = normalizeSource(j.source);

  // ✅ status: évite "unknown" si tx présent
  const status = normalizeStatus(j.status, tx);

  items.push({
    cid,
    tx,
    file: j.file || f, // garder le nom “logique” si présent
    sha256,
    ts,
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
