#!/bin/bash
# Glitchプロジェクト再構築スクリプト

# Node.jsバージョンを出力
echo "現在のNode.jsバージョン:"
node -v

# 古いnode_modulesを削除
echo "node_modulesを削除しています..."
rm -rf node_modules

# パッケージ再インストール
echo "パッケージを再インストールしています..."
npm install

# Node.jsが18未満の場合は互換性のあるバージョンを使用
NODE_VERSION=$(node -v | cut -d "v" -f 2 | cut -d "." -f 1)
if [ "$NODE_VERSION" -lt "18" ]; then
  echo "Node.js 18未満を検出しました。互換性のあるパッケージをインストールします..."
  npm uninstall discord.js @google/generative-ai
  npm install discord.js@13.16.0 @google/generative-ai@0.1.3
fi

# Web Streamsポリフィルを確実にインストール
npm install web-streams-polyfill@4.1.0

# 完了
echo "セットアップが完了しました。"
echo "現在のNode.jsバージョン:"
node -v
