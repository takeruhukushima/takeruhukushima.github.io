<!-- MAGI -->
# atproto — 構造化データと lexicon

CV と「読むべき論文リスト」を機械可読な構造化データ(JSON)にまとめたもの。
AT Protocol lexicon 形式のスキーマも後学用に置いてある。

## いま使われている経路

`data/cv.json` が **トップページ (`src/pages/index.astro`) の Publications / 学会発表 / 講演の原本**。
サイトはこの JSON を import して描画する（JSON を編集 → サイトに反映）。

- `data/cv.json` … 手書き。自分の業績（`publications` / `presentations`(口頭=oral・ポスター=poster) / `talks`(講演)）を内包。
  `publications`・`talks` は現状空配列で、増えたら追記する。英語著者名は `authorsEn` に入れると英語表示で使われる。
- `data/papers.json` … **生成物**。`node atproto/gen-papers.mjs` が
  `paper-list`(status: `to-read`) と `paper-survey`(status: `surveyed`) の frontmatter から作る。直接編集しない。

## Lexicon（後学用・未公開）

| NSID | 中身 |
|------|------|
| `dev.takeruf.cv` | CV。自分の publications / presentations / talks を内包（rkey=`self`） |
| `dev.takeruf.paper` | 追跡中の**他者の**論文（reading list / survey）。自分の業績ではない |

`dev.takeruf.*` は所有ドメイン非依存の個人用 NSID。github.io は `_lexicon` DNS を張れないため
正式な NSID 公開はできないが、自分の PDS へのレコード投入・利用は可能。

## PDS への push（任意・現状は未使用）

App Password ログインが要るので普段は使わない。やる場合のみ:

```bash
node atproto/gen-papers.mjs                       # papers.json 最新化
node atproto/push.mjs --dry-run                   # 送信内容の確認（認証不要）
ATP_IDENTIFIER=<handle> ATP_APP_PASSWORD=<pw> node atproto/push.mjs
```

`putRecord` は同一 rkey を上書き（重複しない）。自作 lexicon は PDS 未登録のため `validate:false`。
App Password はコードにも Git にも残さないこと。

> TODO(将来): 誰でもログインして使える、AT Protocol ベースの CV 作成サイトとして作り直す。
<!-- /MAGI -->
