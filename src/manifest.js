/** CREATED BY WAKAMA.farm & Supported by Solana foundation */
import fs from "fs";
import path from "path";

const RUNS_DIR = "./runs";

const HEADER_V1 = "file,cid,sha256,tx,ts\n";
const HEADER_V2 = "file,cid,sha256,tx,ts,team,source\n";

function ensureRunsDir() {
  if (!fs.existsSync(RUNS_DIR)) fs.mkdirSync(RUNS_DIR, { recursive: true });
}

function getDailyFile() {
  const day = new Date().toISOString().slice(0, 10);
  return path.join(RUNS_DIR, `devnet_${day}.csv`);
}

function readFirstLine(filePath) {
  try {
    const buf = fs.readFileSync(filePath, "utf8");
    const line = buf.split(/\r?\n/)[0] || "";
    return line.trim();
  } catch {
    return "";
  }
}

function fileUsesV2(filePath) {
  const first = readFirstLine(filePath);
  return first.includes("team") || first.includes("source");
}

/**
 * Append a row into daily CSV.
 * Backward compatible:
 * - If file already exists with V1 header, we keep V1 rows.
 * - If file is new, we create V2 header (M2-ready).
 */
export function appendRow(row = {}) {
  ensureRunsDir();

  const filePath = getDailyFile();

  // create file if missing
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, HEADER_V2);
  }

  const useV2 = fileUsesV2(filePath);

  const file = row.file ?? "";
  const cid = row.cid ?? "";
  const sha256 = row.sha256 ?? "";
  const tx = row.tx ?? "";
  const ts = row.ts ?? new Date().toISOString();

  if (useV2) {
    const team = row.team ?? "";
    const source = row.source ?? "";
    const line = `${file},${cid},${sha256},${tx},${ts},${team},${source}\n`;
    fs.appendFileSync(filePath, line);
  } else {
    // fallback V1
    if (readFirstLine(filePath) === "") {
      fs.writeFileSync(filePath, HEADER_V1);
    }
    const line = `${file},${cid},${sha256},${tx},${ts}\n`;
    fs.appendFileSync(filePath, line);
  }
}
