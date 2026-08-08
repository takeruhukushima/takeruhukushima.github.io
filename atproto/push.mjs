// MAGI
// data/cv.json と data/papers.json を AT Protocol の PDS へ putRecord する。
// 認証は App Password を環境変数で受け取る(パスワードはコードに書かない)。
//
//   1) https://bsky.app/settings/app-passwords で App Password を発行
//   2) node atproto/gen-papers.mjs        # papers.json を最新化(任意)
//   3) ATP_IDENTIFIER=takerufukushima.bsky.social \
//      ATP_APP_PASSWORD=xxxx-xxxx-xxxx-xxxx \
//      node atproto/push.mjs              # --dry-run で送信内容だけ確認可
//
// putRecord は validate:false（自作 lexicon は PDS 未登録のため）。
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.dirname(fileURLToPath(import.meta.url));
const SERVICE = process.env.ATP_SERVICE || "https://bsky.social";
const ID = process.env.ATP_IDENTIFIER;
const PW = process.env.ATP_APP_PASSWORD;
const DRY = process.argv.includes("--dry-run");

const CV_NSID = "dev.takeruf.cv";
const PAPER_NSID = "dev.takeruf.paper";

const readJson = async (p) => JSON.parse(await readFile(path.join(root, p), "utf8"));

async function xrpc(method, nsid, body, token) {
  const res = await fetch(`${SERVICE}/xrpc/${nsid}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { data = text; }
  if (!res.ok) {
    throw new Error(`${nsid} -> ${res.status} ${JSON.stringify(data)}`);
  }
  return data;
}

async function main() {
  const now = new Date().toISOString();
  const cv = await readJson("data/cv.json");
  cv.updatedAt = now;
  const papers = await readJson("data/papers.json");

  const plan = [
    { collection: CV_NSID, rkey: "self", record: cv },
    ...papers.map((p) => ({
      collection: PAPER_NSID,
      rkey: p.rkey,
      record: { ...p.value, addedAt: p.value.addedAt || now },
    })),
  ];

  console.log(`Records to push: ${plan.length} (1 cv + ${papers.length} papers)`);

  if (DRY) {
    for (const w of plan) console.log(`  [dry] ${w.collection}/${w.rkey}  ${w.record.title?.en || w.record.title || ""}`);
    console.log("\nDry run only. Set ATP_IDENTIFIER / ATP_APP_PASSWORD and drop --dry-run to push.");
    return;
  }

  if (!ID || !PW) {
    console.error("ERROR: set ATP_IDENTIFIER and ATP_APP_PASSWORD env vars (or use --dry-run).");
    process.exit(1);
  }

  const session = await xrpc("POST", "com.atproto.server.createSession", { identifier: ID, password: PW });
  const { accessJwt, did } = session;
  console.log(`Authenticated as ${session.handle} (${did})`);

  for (const w of plan) {
    await xrpc(
      "POST",
      "com.atproto.repo.putRecord",
      { repo: did, collection: w.collection, rkey: w.rkey, record: w.record, validate: false },
      accessJwt
    );
    console.log(`  ✓ ${w.collection}/${w.rkey}`);
  }
  console.log("Done.");
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
// /MAGI
