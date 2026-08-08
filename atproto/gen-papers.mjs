// MAGI
// blog の paper-list mdx frontmatter を唯一の原本として読み、
// dev.takeruf.paper 準拠の data/papers.json を生成する。
// これで PDS へ push するデータがブログと二重管理にならない。
//   使い方: node atproto/gen-papers.mjs
import { readdir, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(root, "..");
const SITE = "https://takeruhukushima.github.io";

// 生成対象: [ディレクトリ, その項目に付与する status ]
const SOURCES = [
  { dir: "src/content/blog/research/paper-list", status: "to-read" },
  { dir: "src/content/blog/research/paper-survey", status: "surveyed" },
];

// --- 最小限の frontmatter パーサ(依存なし) --------------------------------
// 対応: `key: "value"` / `key: value` / `key: ["a","b"]`
function parseFrontmatter(text) {
  const m = text.match(/^---\s*\n([\s\S]*?)\n---/);
  if (!m) return null;
  const out = {};
  for (const line of m[1].split("\n")) {
    const mm = line.match(/^([A-Za-z0-9_]+):\s*(.*)$/);
    if (!mm) continue;
    const key = mm[1];
    let raw = mm[2].trim();
    if (!raw) continue;
    if (raw.startsWith("[")) {
      try {
        out[key] = JSON.parse(raw);
        continue;
      } catch {
        /* fall through */
      }
    }
    if (
      (raw.startsWith('"') && raw.endsWith('"')) ||
      (raw.startsWith("'") && raw.endsWith("'"))
    ) {
      raw = raw.slice(1, -1);
    }
    out[key] = raw;
  }
  return out;
}

// rkey は a-zA-Z0-9.-_:~ のみ。ファイル名から安全に生成する。
function toRkey(prefix, base) {
  const slug = base
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 100);
  return `${prefix}-${slug}`;
}

const records = [];
for (const src of SOURCES) {
  let files = [];
  try {
    files = (await readdir(path.join(repoRoot, src.dir))).filter((f) => f.endsWith(".mdx"));
  } catch {
    continue;
  }
  for (const file of files) {
    const full = path.join(repoRoot, src.dir, file);
    const fm = parseFrontmatter(await readFile(full, "utf8"));
    if (!fm || !fm.title) continue;
    const base = file.replace(/\.mdx$/, "");
    // content は src/content/blog/... に置かれ、ルートは /blog/... で配信される
    const rel = src.dir.replace(/^src\/content\/blog/, "") + "/" + base;
    const rec = {
      $type: "dev.takeruf.paper",
      title: fm.title,
      status: src.status,
    };
    if (fm.paperUrl) rec.paperUrl = fm.paperUrl;
    if (fm.codeUrl) rec.codeUrl = fm.codeUrl;
    if (fm.venue) rec.venue = fm.venue;
    if (fm.year != null) rec.year = String(fm.year);
    if (Array.isArray(fm.tags) && fm.tags.length) rec.tags = fm.tags;
    rec.sourceUrl = `${SITE}/blog${rel}`;
    records.push({ rkey: toRkey(src.status === "to-read" ? "tr" : "sv", base), value: rec });
  }
}

records.sort((a, b) => a.rkey.localeCompare(b.rkey));
const outPath = path.join(root, "data", "papers.json");
await writeFile(outPath, JSON.stringify(records, null, 2) + "\n");
console.log(`wrote ${records.length} paper records -> ${path.relative(repoRoot, outPath)}`);
// /MAGI
