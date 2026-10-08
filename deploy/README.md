# 本番デプロイ手順(Render)

このアプリは`node:sqlite`でファイルベースのDBを使うため、**永続ディスクが使える
プラン**でデプロイする必要がある(Renderの無料プランには永続ディスクが付かない
ので、Starterプラン以上が必要)。

## 1. GitHubと連携してBlueprintを作成(一度だけ)

1. Renderにサインアップし、このリポジトリ(GitHub)を連携する。
2. ダッシュボードで「New +」→「Blueprint」を選び、このリポジトリを選択する。
   リポジトリ直下の `render.yaml` の内容どおりに、Webサービスと永続ディスク
   (`/var/data`、1GB)が自動で作成される。
3. 作成されたサービスの「Environment」タブで `ANTHROPIC_API_KEY` を入力する
   (これだけはBlueprintに書けない秘密情報なので手動入力が必要)。
   `SESSION_SECRET` は自動生成される。
4. デプロイが完了したら、Renderが発行する `https://xxxx.onrender.com` のURLで
   アクセスできることを確認する。

## 2. 独自ドメインを使う場合

Renderのサービス設定の「Custom Domains」からドメインを追加し、案内される
CNAME(またはA)レコードを、ドメインのDNS設定側に追加する。Renderが自動で
HTTPS証明書を発行する。

## 3. 更新時

GitHubの `master` ブランチにpushするだけで、Renderが自動的に再ビルド・
再デプロイする(render.yamlの`buildCommand`がそのまま実行される)。

## 4. 動作確認

```bash
curl -I https://<RenderのURLまたは独自ドメイン>/login
```

Renderダッシュボードの「Logs」タブで起動ログやエラーを確認できる。

## データの場所とバックアップ

永続データ(SQLite DB等)は、Render上の永続ディスク `/var/data`(env: `DATA_DIR`)
にある。バックアップが必要な場合は、RenderのShell機能(ダッシュボードから
コンテナ内シェルに接続できる)経由で `/var/data/app.db` を取得する。

## アイコン元画像・プライバシーポリシー

- `deploy/icon/app-icon-1024.png` — App Store申請用アイコンのマスター画像
  (1024×1024、透過なし)。Mac側でCapacitorの `@capacitor/assets` 等に渡して
  各サイズを生成する。
- `/privacy` ページ — プライバシーポリシー。事業者名・連絡先など
  「［記入してください］」の部分は本番公開前に埋めること。
