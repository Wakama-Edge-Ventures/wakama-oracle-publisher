/** CREATED BY WAKAMA.farm & Supported by Solana foundation */
import fs from "fs-extra";
import crypto from "node:crypto";
import { Web3Storage, File } from "web3.storage";

const client = new Web3Storage({ token: process.env.WEB3STORAGE_TOKEN });
const dir = "../wakama-oracle-ingest/batches";

const files = (await fs.readdir(dir)).filter(f=>f.endsWith(".json"));
for (const f of files) {
  const p = `${dir}/${f}`;
  const data = await fs.readFile(p);
  const sha256 = crypto.createHash("sha256").update(data).digest("hex");
  const cid = await client.put([new File([data], f)], { wrapWithDirectory:false });
  console.log(JSON.stringify({ file:f, cid, sha256 }));
  // TODO J2: emit devnet event via Anchor program
}
