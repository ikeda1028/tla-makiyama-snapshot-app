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

## Snapshot

現時点ではSnapshotへ直接投稿せず、アプリ内でPayloadを作成してコピーする方式です。次段階でWallet接続とSnapshot投稿APIを追加できます。
