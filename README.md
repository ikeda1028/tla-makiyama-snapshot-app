# TLA・牧山 Snapshot Governance

TLA・牧山チームのプロジェクト設計、Asana実行管理、成果承認、Snapshot向け意思決定をつなぐプロトタイプです。

## 公開

静的アプリは次のパスにあります。

```text
outputs/tla-makiyama-snapshot-app/
```

GitHub Pagesでは、このリポジトリを公開し、以下のURLでアクセスします。

```text
https://<github-user>.github.io/<repository>/
```

Vercelでは、リポジトリをインポートして環境変数 `ASANA_ACCESS_TOKEN` を設定すると、同じ公開URLでアプリとAsana APIを使えます。

```text
https://<project>.vercel.app/
```

Vercel公開URLで使う場合、アプリの `Asana連携` にある `APIサーバーURL` は空欄のままで動きます。

## ローカル起動

Asana APIを使う場合は、`.env.example` を参考に `.env.local` を作り、`ASANA_ACCESS_TOKEN` を設定します。

```bash
export ASANA_ACCESS_TOKEN="pat_xxx"
npm start
```

起動後、アプリの `Asana連携` で APIサーバーURL に以下を入れます。

```text
http://127.0.0.1:8787
```

## Asana APIでできること

- API接続確認
- Asanaプロジェクト作成
- PPMタスクをAsanaへ直接作成
- Asana側の完了状態・メモをアプリへ同期

APIトークンはブラウザに保存せず、サーバーの環境変数だけに置きます。

## Vercel設定

1. VercelでこのGitHubリポジトリをImportします。
2. Framework Presetは `Other` のままで使えます。
3. Environment Variablesに `ASANA_ACCESS_TOKEN` を追加します。
4. Deployします。
5. アプリ上で `API接続確認` を押します。

必要に応じて `ASANA_WORKSPACE_GID` も環境変数に置けます。その場合、アプリ側のWorkspace GID入力を省略できます。

## Snapshot

現時点ではSnapshotへ直接投稿せず、アプリ内でPayloadを作成してコピーする方式です。次段階でWallet接続とSnapshot投稿APIを追加できます。
