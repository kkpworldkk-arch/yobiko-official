# iOSアプリ（App Store 一般公開）リリース手順

アプリは Render 上の本番サイト（https://takihara-app.onrender.com）を表示する作りです。
画面や機能の修正はウェブ側を更新すればアプリにもすぐ反映されます。App Store の再審査が必要なのは、
`ios/` フォルダ（ネイティブ部分）やアイコンを変えたときだけです。

- バンドルID: `jp.takiharajuku.app`
- アプリ名: 滝原塾
- ネイティブ機能: 音声入力（iOSの音声認識）、復習リマインド通知、Face ID ログイン（パスキー）

---

## 1. Apple Developer Program に登録（個人）

1. iPhone か Mac で「Apple Developer」アプリを入れ、Apple ID でサインイン
2. 「今すぐ登録」→ 個人として登録（年額 12,980円 / 99米ドル）
3. 登録完了メールが届くまで待つ（通常 即日〜2日）
4. https://developer.apple.com/account の「メンバーシップの詳細」で **チームID**（10桁の英数字）を控える

> 個人名義の場合、App Store の「販売元」にはあなたの本名（Apple に登録した氏名）が表示されます。

## 2. Mac の準備（初回のみ）

1. App Store から **Xcode** をインストールし、一度起動して追加コンポーネントを入れる
2. https://nodejs.org から **Node.js（LTS 版）** をインストール
3. ターミナルで次を実行（リポジトリを取得して、Xcode で開くところまで自動）

```bash
git clone https://github.com/kkpworldkk-arch/yobiko-official.git && cd yobiko-official && bash scripts/ios-open-on-mac.sh
```

リポジトリが非公開の場合、途中で GitHub のユーザー名とパスワード（個人用アクセストークン）を聞かれます。

2回目以降（コードを更新したとき）は、リポジトリのフォルダで次の1行です。

```bash
git pull && bash scripts/ios-open-on-mac.sh
```

## 3. Xcode での設定（初回のみ）

1. 左のファイル一覧の一番上「App」→ 中央の TARGETS「App」→「Signing & Capabilities」
2. **Team** に自分の名前（Personal Team ではなく、有料登録したチーム）を選ぶ
3. 「Associated Domains」が表示されていて、`webcredentials:takihara-app.onrender.com` が入っていることを確認
4. 上部の「+ Capability」から **Push Notifications は追加しない**（ローカル通知だけなので不要）

## 4. チームID（設定済み）

チームID `8XQPA6UJ83` は `src/app/.well-known/apple-app-site-association/route.ts` に既定値として入っている。
別のチーム・バンドルIDで出し直すときだけ、Render の環境変数 `APPLE_APP_ID` で上書きする。

## 5. 実機で試す

1. iPhone を USB で Mac につなぎ、iPhone 側で「このコンピュータを信頼」
2. iPhone の「設定」→「プライバシーとセキュリティ」→「デベロッパモード」をオン（再起動あり）
3. Xcode 上部の実行先で自分の iPhone を選び、▶ ボタン
4. 確認すること
   - ログインできる（講師・ゲスト生徒）
   - AI口頭試問で「AI機能のご利用について」が出て、同意後に使える
   - 音声入力タブ →「録音を開始」でマイクと音声認識の許可が出て、話した内容が文字になる
   - 設定 →「復習リマインド」で時刻を選ぶと通知の許可が出る
   - 設定 → 生体認証 で Face ID を登録し、ログアウト後に Face ID でログインできる
   - 機内モードで起動すると「接続できませんでした」画面が出る

## 6. App Store Connect にアプリを登録

https://appstoreconnect.apple.com →「アプリ」→「＋」→「新規アプリ」

| 項目 | 入力 |
|---|---|
| プラットフォーム | iOS |
| 名前 | 滝原塾（使えなければ「滝原塾 医学部受験」など） |
| プライマリ言語 | 日本語 |
| バンドルID | jp.takiharajuku.app |
| SKU | takiharajuku-app |
| ユーザアクセス | フルアクセス |

説明文・審査メモ・プライバシーの回答は `docs/app-store-listing.md` をそのまま貼り付けてください。

## 7. アップロードと TestFlight

1. Xcode 上部の実行先を **Any iOS Device (arm64)** にする
2. メニュー「Product」→「Archive」
3. 完了すると Organizer が開く →「Distribute App」→「App Store Connect」→「Upload」
4. 10〜30分後、App Store Connect の「TestFlight」タブにビルドが出る
5. 自分を内部テスターに追加し、iPhone の「TestFlight」アプリから入れて最終確認

## 8. 審査に提出

1. App Store Connect →「配信」タブ → バージョン 1.0 の画面でビルドを選択
2. スクリーンショット（`docs/app-store-listing.md` の「スクリーンショット」参照）をアップロード
3. 「審査用に追加」→「審査へ提出」

審査は通常 1〜3日。指摘が来たら、内容をそのまま貼ってもらえれば対応します。

## アップデートのとき

- **ウェブ側だけの変更**（画面・機能・文言）: GitHub に push → Render が自動デプロイ → アプリにも即反映。審査不要。
- **ネイティブ部分の変更**（`ios/`、アイコン、プラグイン追加）: Xcode で「General」→ Version / Build を上げて、7〜8 をやり直す。
