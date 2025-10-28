const fs = require('fs');
const crypto = require('crypto');
const { execFileSync } = require('child_process');

const GATEWAY = 'https://gateway.pinata.cloud/ipfs';

// util
const sha256Buf = (buf) => crypto.createHash('sha256').update(buf).digest('hex');
const fetchBytes = async (url) => {
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  const ab = await res.arrayBuffer();
  return Buffer.from(ab);
};

(async () => {
  // prend le dernier batch depuis ingest
  const INGEST = process.env.INGEST_DIR || `${process.env.HOME}/dev/wakama/wakama-oracle-ingest/batches`;
  const files = fs.readdirSync(INGEST).filter(f => f.endsWith('.json')).sort();
  if (!files.length) throw new Error('no batch found');
  const filename = files[files.length - 1];
  const pathJson = `${INGEST}/${filename}`;
  const bytesLocal = fs.readFileSync(pathJson);
  const shaLocal = sha256Buf(bytesLocal);

  // upload Pinata via curl (on garde le flux exact)
  const jwt = process.env.PINATA_JWT;
  if (!jwt) throw new Error('PINATA_JWT missing');
  const out = execFileSync('curl', [
    '-sS','-X','POST','https://api.pinata.cloud/pinning/pinFileToIPFS',
    '-H', `Authorization: Bearer ${jwt}`,
    '-F', `file=@${pathJson};filename=${filename}`
  ], { encoding: 'utf8' });
  let cid;
  try { cid = JSON.parse(out).IpfsHash; } catch { throw new Error(`pinata response parse error: ${out}`); }

  // vérif byte-à-byte via gateway Pinata
  const bytesGw = await fetchBytes(`${GATEWAY}/${cid}`);
  const shaGw = sha256Buf(bytesGw);
  if (shaGw !== shaLocal) {
    console.error('sha mismatch gateway vs local');
    console.error(JSON.stringify({ shaLocal, shaGw, cid, file: filename }, null, 2));
    process.exit(1);
  }

  // mémo on-chain via solana CLI
  const SELF = execFileSync('solana', ['address'], { encoding: 'utf8' }).trim();
  const memo = JSON.stringify({ cid, sha256: shaLocal, file: filename });
  const txLine = execFileSync('solana', [
    'transfer', SELF, '0',
    '--url','https://api.devnet.solana.com',
    '--with-memo', memo,
    '--allow-unfunded-recipient',
    '--no-wait'
  ], { encoding: 'utf8' }).trim();
  const tx = txLine.split(/\s+/).pop();

  console.log(JSON.stringify({ ok:true, file: filename, cid, sha256: shaLocal, tx, gw: GATEWAY }));
  process.exit(0);
})().catch(e => { console.error(e.message || e); process.exit(1); });
