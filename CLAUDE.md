# HaruNekoGAME

子供（ひらがなをぎりぎり読める）が iPad でひとりで遊ぶブラウザゲーム集。
主人公は子供が描いた 3 匹のネコ。

## 公開と構成（技術の決まり）

- GitHub Pages で `main` の直下をそのまま公開する。**ビルド工程は無し**。
- 各ゲームは `games/<id>.html` の **HTML 1 ファイルで完結**させる（CSS / JS はそのファイル内に書く）。
- 外部から読み込んでよいのは次の 2 つだけ。npm・バンドラ・その他 CDN は使わない。
  - three.js r128: `https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js`
  - Google Fonts (Yusei Magic): `https://fonts.googleapis.com/css2?family=Yusei+Magic&display=swap`
  - three.js の examples（OrbitControls など）も読み込まない。必要ならページ内に自前で書く。
- 共通ファイルは `shared/` に置く。
  - `shared/neko.js` … 3 匹のネコを three.js で作るライブラリ（グローバル `NEKO`）
  - `shared/style.css` … 共通の見た目（紙色の背景、太い黒線、手描き風ボタン、フォント）
- `index.html` が「ゲーム ひろば」。上に 3 匹、下にゲームのカード一覧。
  - ゲームを追加するときは `index.html` の `GAMES` 配列に 1 行足す。

```
/
├── index.html            ゲーム ひろば（一覧）
├── shared/neko.js        ネコ生成ライブラリ
├── shared/style.css      共通スタイル
└── games/
    ├── neko-viewer.html  3 匹を回して見る確認用ページ
    └── <id>.html         ゲームは 1 ファイルずつ
```

## 子供向けの決まり（必ず守る）

1. **文字は全部ひらがな・カタカナ。漢字は使わない。** ボタン、見出し、説明、alt、`<title>` も全部。
2. **分かち書き**にする。例:「ねこ を さわると ジャンプ するよ」「あそぶ ゲーム を えらんでね」
3. **読まなくても遊べる**ようにする。ボタンには絵文字やアイコンを付け、操作は「さわる」「なぞる」だけで分かるようにする。文字だけで説明しない。
4. **失敗しても怒られない。** 「ざんねん」「まちがい」「×」のような否定的な表現や、減点・ゲームオーバーの脅かしは無し。うまくいかなくても「もういっかい」で明るく続けられる。
5. **個人情報を入れない。** 名前・写真・位置情報などの入力欄を作らない。外部へ送信しない。
6. **保存は `localStorage`** だけ。キーは `haruneko.<ゲームid>` のように付ける。読み書きは `try/catch` で包み、失敗しても遊べるようにする。
7. **iPad の縦横両対応。** 固定サイズにせず、`resize` / `orientationchange` で描画サイズを合わせる。`viewport-fit=cover` と `env(safe-area-inset-*)` で端を避ける。
8. **ホーム画面に追加して全画面で遊べる**ようにする。全ページに次を入れる。

```html
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover, user-scalable=no">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="default">
<meta name="apple-mobile-web-app-title" content="（ひらがなの みじかい なまえ）">
<meta name="theme-color" content="#fbf6e9">
```

9. タップ対象は 64px 以上。`touch-action` を適切に設定し、ダブルタップ拡大・長押し選択・ゴムバンドスクロールを防ぐ（`shared/style.css` の `body` と `.stage` で対応済み）。
10. 音を出す場合は最初のタップの後に再生する（iOS の自動再生制限）。無音でも遊べるようにする。
11. 各ゲームには「もどる」ボタン（`../index.html` へのリンク）を必ず置く。

## 3 匹のネコ（見た目の決まり）

子供の絵の特徴を、3D でもそのまま守る。

- 横長の四角い体
- 右端に四角い頭（上が半円）
- 頭の上に三角の耳 2 つ
- 左端に丸いしっぽ
- 体の下に黒く短い足 4 本
- 顔はこちら向き。黒い点の目 2 つ、小さい鼻、「ω」の口
- **太い黒線のふちどり**。画用紙にマーカーで描いた雰囲気（紙色の背景、マーカーのむらのある塗り）

| id       | 名前（仮） | 色                 | 表情                     |
| -------- | ---------- | ------------------ | ------------------------ |
| `orange` | オレンジ   | `#f39a2b` (0xf39a2b) | 目を開けている           |
| `blue`   | あお       | `#2f88d8` (0x2f88d8) | 目を開けている           |
| `yellow` | きいろ     | `#e6c21c` (0xe6c21c) | 目を「><」のように閉じてにっこり |

紙色は `#fbf6e9`、線の黒は `#1c1a17`。

## `shared/neko.js` の使い方

```html
<script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>
<script src="../shared/neko.js"></script>
<script>
  var stage = NEKO.createStage(document.getElementById('stage'), {
    onResize: function (w, h, s) { NEKO.fitCamera(s.camera, w / h, 30, 12, 1); }
  });
  var neko = NEKO.create({ color: NEKO.COLORS.orange, eyes: 'open' }); // THREE.Group
  stage.scene.add(neko);
  stage.start(function (dt, t) { NEKO.idle(neko, t); });
</script>
```

- `NEKO.COLORS` … `{ orange, blue, yellow }`（数値の色）
- `NEKO.CATS` … 3 匹の定義 `[{ id, name, color, css, eyes }]`
- `NEKO.create({ color, eyes: 'open' | 'closed', name, id })` … ネコ 1 匹（`THREE.Group`）。原点は体の中心。
- `NEKO.createById('orange')` / `NEKO.createAll()`
- `NEKO.setEyes(neko, 'open' | 'closed')` … まばたきなどに
- `NEKO.idle(neko, t, phase)` … しっぽふりふり・ゆれる待機アニメ
- `neko.userData.parts` … `{ body, head, ears, tail, legs, eyesOpen, eyesClosed }` を個別に動かせる
- `NEKO.SIZE` … `{ width, height, floorY }`（原点から見た大きさ。床は `floorY`）
- `NEKO.createStage(container, { background, alpha, fov, onResize })` … renderer / scene / camera / ライトをまとめて用意。`start(fn)`, `stop()`, `resize()`, `pick(clientX, clientY, nekos)`（タップしたネコを返す）
- `NEKO.fitCamera(camera, aspect, width, height, centerY, margin)` … 指定範囲が画面に収まるようにカメラを引く

## `shared/style.css` の主なクラス

- `.btn`（`.btn--orange` / `.btn--blue` / `.btn--yellow` / `.btn--big` / `.btn--round` / `.is-active`）… 手描き風の大きなボタン
- `.card`（`.card--orange` など）… ひろばのゲームカード
- `.stage` … three.js の canvas を入れる枠
- `.page` / `.row` / `.grid` … レイアウト
- `.fullscreen` + `.hud .hud--top-left / --top-right / --bottom` … 全画面ゲームの UI 配置
- `.ink-title` / `.chip` … 見出し・小さなラベル

## 新しいゲームを作る手順

1. `games/<id>.html` を 1 ファイルで作る（`games/neko-viewer.html` をひな形にする）。
2. `index.html` の `GAMES` 配列に `{ id, title, desc, icon, color }` を足す。`title` と `desc` はひらがな・カタカナで分かち書き。
3. 縦・横の両方で表示を確認する。文字がすべてひらがな・カタカナか確認する。
4. コミットして push する。

## 動作確認について

この環境からは cdnjs に接続できないことがある。その場合は three.js r128 をローカルに置き、テスト用サーバーで cdnjs の URL をそのファイルへ差し替えて表示確認する（リポジトリの HTML 自体は cdnjs の URL のまま変えない）。
