#!/bin/bash
# クリーンインストールスクリプト

echo "クリーンインストールを開始します..."

# 現在のNode.jsバージョンを確認
NODE_VERSION=$(node -v)
echo "現在のNode.jsバージョン: $NODE_VERSION"

# 古いnode_modulesを削除
echo "node_modulesとpackage-lock.jsonを削除しています..."
rm -rf node_modules
rm -f package-lock.json

# 最初にdiscord.jsを明示的にインストール
echo "discord.js v13.16.0をインストールしています..."
npm install discord.js@13.16.0 --save-exact

# 残りのパッケージをインストール
echo "その他のパッケージをインストールしています..."
npm install

echo "セットアップが完了しました。"
echo "現在のNode.jsバージョン: $(node -v)"
echo "'refresh'コマンドを実行してアプリケーションを再起動してください。"
