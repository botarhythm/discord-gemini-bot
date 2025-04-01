#!/bin/bash
# Node.js 16環境向けセットアップスクリプト

echo "Node.js 16環境向けセットアップを開始します..."

# 現在のNode.jsバージョンを確認
NODE_VERSION=$(node -v)
echo "現在のNode.jsバージョン: $NODE_VERSION"

# 古いnode_modulesを削除
echo "node_modulesを削除しています..."
rm -rf node_modules

# Discord.js v13をインストール
echo "Discord.js v13をインストールしています..."
npm install discord.js@13.16.0

# その他の依存パッケージを再インストール
echo "その他のパッケージをインストールしています..."
npm install

echo "セットアップが完了しました。"
echo "現在のNode.jsバージョン: $(node -v)"
echo "'refresh'コマンドを実行してアプリケーションを再起動してください。"
