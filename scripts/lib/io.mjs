import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import Papa from "papaparse";
import { DATA, RAW } from "./config.mjs";

const require = createRequire(import.meta.url);
const AdmZip = require("adm-zip");

export function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}

function findZip() {
  if (!fs.existsSync(DATA)) return null;
  const zips = fs
    .readdirSync(DATA)
    .filter((f) => f.toLowerCase().endsWith(".zip"))
    .map((f) => ({
      name: f,
      mtime: fs.statSync(path.join(DATA, f)).mtimeMs,
    }))
    .sort((a, b) => b.mtime - a.mtime);
  return zips[0] ? path.join(DATA, zips[0].name) : null;
}

export function extractZipIfNeeded() {
  const zipPath = findZip();
  if (!zipPath) {
    if (!fs.existsSync(RAW) || fs.readdirSync(RAW).filter((f) => f.endsWith(".csv")).length === 0) {
      throw new Error(
        "No zip in data/ and no CSVs in data/raw/. Place a Homematic IP export zip in data/."
      );
    }
    console.log("Using existing CSVs in data/raw/");
    return path.basename(RAW);
  }
  console.log(`Extracting ${path.basename(zipPath)}…`);
  ensureDir(RAW);
  for (const f of fs.readdirSync(RAW)) {
    fs.unlinkSync(path.join(RAW, f));
  }
  const zip = new AdmZip(zipPath);
  zip.extractAllTo(RAW, true);
  return path.basename(zipPath);
}

export function parseCsvFile(filePath) {
  const text = fs.readFileSync(filePath, "utf8");
  const parsed = Papa.parse(text, {
    header: true,
    skipEmptyLines: true,
    dynamicTyping: false,
  });
  const points = [];
  let gaps = 0;
  for (const row of parsed.data) {
    const ts = Number(row["Time stamp"]);
    const rawVal = row.Value;
    const room = (row.Room || "").replace(/^"|"$/g, "");
    const category = (row.Category || "").replace(/^"|"$/g, "");
    const gapType = row["Data gap type"];
    if (gapType && String(gapType).trim() !== "") gaps += 1;
    if (!Number.isFinite(ts) || rawVal === "" || rawVal == null) continue;
    const value = Number(String(rawVal).replace(",", "."));
    if (!Number.isFinite(value)) continue;
    points.push({ t: ts, v: value, room, category });
  }
  points.sort((a, b) => a.t - b.t);
  return { points, gaps, room: points[0]?.room, category: points[0]?.category };
}
