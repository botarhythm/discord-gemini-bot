// Discord.js v13に完全対応したindex.js
require('dotenv').config();
const { Client, Intents, MessageEmbed, Message } = require('discord.js');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const character = require('./config/character');
const fs = require('fs');
const path = require('path');
const express = require('express');

// 環境変数の確認
console.log('Environment variables:');
console.log('PREFIX:', process.env.PREFIX);
console.log('CHANNEL_ID:', process.env.CHANNEL_ID);
console.log('GUILD_ID:', process.env.GUILD_ID);
console.log('GEMINI_API_KEY:', process.env.GEMINI_API_KEY ? '設定されています' : '未設定です');

// Discordクライアントの初期化
const client = new Client({
  intents: [
    Intents.FLAGS.GUILDS,
    Intents.FLAGS.GUILD_MESSAGES,
    Intents.FLAGS.DIRECT_MESSAGES
  ],
  partials: ['MESSAGE', 'CHANNEL', 'GUILD_MEMBER']
});

// Gemini APIの初期化
let model;
try {
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  model = genAI.getGenerativeModel({ 
    model: "gemini-pro",
    generationConfig: {
      temperature: 0.7,
      topK: 40,
      topP: 0.95,
      maxOutputTokens: 1024,
    }
  });
  console.log('Gemini API initialized successfully');
} catch (error) {
  console.error('Gemini API initialization error:', error);
}

// 会話履歴を管理するクラス
class ConversationHistory {
  constructor() {
    this.histories = new Map();
    this.maxHistoryLength = 15;
    this.contextWindow = 5;
  }

  addMessage(channelId, role, content) {
    if (!this.histories.has(channelId)) {
      this.histories.set(channelId, []);
    }

    const history = this.histories.get(channelId);
    
    history.push({ 
      role, 
      content, 
      timestamp: Date.now() 
    });

    while (history.length > this.maxHistoryLength) {
      history.shift();
    }

    console.log(`Added message to history for channel ${channelId}`);
    console.log(`Current history length: ${history.length}`);
  }

  getFormattedHistory(channelId) {
    const history = this.histories.get(channelId) || [];
    const recentHistory = history.slice(-this.contextWindow);
    
    let formattedHistory = '';
    
    recentHistory.forEach((message, index) => {
      const timeAgo = this.getTimeAgo(message.timestamp);
      formattedHistory += `${message.role === 'user' ? 'ユーザー' : 'アシスタント'}: ${message.content} (${timeAgo})\n`;
      
      if (index < recentHistory.length - 1) {
        formattedHistory += '\n';
      }
    });

    return formattedHistory;
  }

  getTimeAgo(timestamp) {
    const now = Date.now();
    const diff = now - timestamp;
    
    const minutes = Math.floor(diff / (1000 * 60));
    
    if (minutes < 1) {
      return '今';
    } else if (minutes < 60) {
      return `${minutes}分前`;
    } else {
      const hours = Math.floor(minutes / 60);
      return `${hours}時間前`;
    }
  }

  clearHistory(channelId) {
    if (this.histories.has(channelId)) {
      this.histories.delete(channelId);
      console.log(`Cleared history for channel ${channelId}`);
    }
  }

  getHistory(channelId) {
    return this.histories.get(channelId) || [];
  }

  getHistoryLength(channelId) {
    return (this.histories.get(channelId) || []).length;
  }
}

// 会話履歴の初期化
const conversationHistory = new ConversationHistory();

// Glitch用の設定
const port = process.env.PORT || 3000;
const app = express();

// ヘルスチェック用のエンドポイント
app.get('/', (req, res) => {
  res.send('Bot is running!');
});

// サーバーを起動
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});

// ボットが準備できたときの処理
client.once('ready', async () => {
  console.log(`Logged in as ${client.user.tag}!`);
  console.log(`Bot is running in Guild: ${process.env.GUILD_ID}`);
  console.log(`Listening in Channel: ${process.env.CHANNEL_ID}`);
  
  try {
    // ボットの状態を確認
    const guild = await client.guilds.fetch(process.env.GUILD_ID);
    if (guild) {
      console.log(`Found guild: ${guild.name}`);
      const channel = await guild.channels.fetch(process.env.CHANNEL_ID);
      if (channel) {
        console.log(`Found channel: ${channel.name}`);
      } else {
        console.log('Target channel not found!');
      }
    } else {
      console.log('Target guild not found!');
    }
  } catch (error) {
    console.error('Error fetching guild or channel:', error);
  }
});

// メッセージを受信したときの処理
client.on('messageCreate', async message => {
  console.log('=== New Message ===');
  console.log(`Content: ${message.content}`);
  console.log(`Channel ID: ${message.channelId}`);
  console.log(`Author: ${message.author.tag}`);
  console.log(`Is Bot: ${message.author.bot}`);
  console.log(`Guild ID: ${message.guildId}`);
  console.log(`Is DM: ${!message.guildId}`);

  // ボットのメッセージは無視
  if (message.author.bot) {
    console.log('Ignoring bot message');
    return;
  }

  // DMまたは特定のチャンネルでのみ動作するように設定
  if (message.guildId && message.channelId !== process.env.CHANNEL_ID) {
    console.log('Message not in target channel');
    return;
  }

  let prompt = '';
  const botMention = `<@${client.user.id}>`;
  const prefix = process.env.PREFIX || '!';

  console.log('Checking message content...');

  // コマンド処理（プレフィックスで始まるメッセージ）
  if (message.content.startsWith(prefix)) {
    console.log('Command detected');
    const args = message.content.slice(prefix.length).trim().split(/ +/);
    const commandName = args.shift().toLowerCase();
    
    // 簡易コマンド処理
    if (commandName === 'clear') {
      conversationHistory.clearHistory(message.channel.id);
      await message.reply('会話履歴をクリアしました！');
      return;
    } else if (commandName === 'help') {
      await message.reply(`
# ボッチーのヘルプ

## 基本的な使い方
- DMでメッセージを送るか、サーバー内でメンションするとAIが応答します
- 例: <@${client.user.id}> こんにちは

## コマンド一覧
- **!clear**: 会話履歴をクリアします
- **!help**: このヘルプメッセージを表示します

## 特徴
- フレンドリーで親しみやすい
- 知的で賢明
- 的確な回答
- 好奇心旺盛
- お役立ち情報を提供
      `);
      return;
    }
  }

  // DMの場合はメンションなしでも応答
  if (!message.guildId) {
    prompt = message.content.trim();
    console.log('DM detected, prompt:', prompt);
  } else if (message.content.includes(botMention) || message.mentions.users.has(client.user.id)) {
    // メンションを除去してプロンプトを取得
    prompt = message.content.replace(/<@!?\d+>/g, '').trim();
    console.log('Mention detected, prompt:', prompt);
  } else {
    console.log('No mention detected');
    return;
  }

  if (!prompt) {
    console.log('Empty prompt, ignoring');
    return;
  }

  console.log('Processing prompt:', prompt);
  
  try {
    // タイピングインジケーターを表示
    message.channel.sendTyping().catch(console.error);

    // 会話履歴を取得
    const history = conversationHistory.getFormattedHistory(message.channel.id);
    
    // Gemini APIに送信するキャラクター情報とプロンプトを構築
    const fullPrompt = `
${character.systemPrompt}

以下の会話履歴を参考に、質問に答えてください。

会話履歴:
${history}

質問: ${prompt}

回答:`;

    // Gemini APIにリクエスト
    const result = await model.generateContent(fullPrompt);
    const response = result.response.text();

    // 会話履歴に追加
    conversationHistory.addMessage(message.channel.id, 'user', prompt);
    conversationHistory.addMessage(message.channel.id, 'assistant', response);

    // 長い応答は分割して送信
    if (response.length > 2000) {
      // 応答を2000文字ずつに分割
      const chunks = splitMessage(response);
      for (const chunk of chunks) {
        await message.reply(chunk);
      }
    } else {
      await message.reply(response);
    }
  } catch (error) {
    console.error('Error processing prompt:', error);
    await message.reply('申し訳ありません。エラーが発生しました。');
  }
});

// エラーハンドリング
client.on('error', error => {
  console.error('Discord client error:', error);
});

// ボットをログイン
client.login(process.env.DISCORD_TOKEN);

/**
 * 長いメッセージをDiscordの文字数制限に合わせて分割する
 * @param {string} text - 分割するテキスト
 * @param {number} maxLength - 最大文字数（デフォルト：2000）
 * @returns {string[]} 分割されたテキスト配列
 */
function splitMessage(text, maxLength = 2000) {
  const chunks = [];
  
  // コードブロックやマークダウンの整合性を維持するため、行単位で分割
  const lines = text.split('\n');
  let currentChunk = '';
  
  for (const line of lines) {
    // 現在のチャンクに行を追加した場合の長さを確認
    const testChunk = currentChunk + (currentChunk ? '\n' : '') + line;
    
    // 最大長を超える場合、新しいチャンクを開始
    if (testChunk.length > maxLength) {
      // 現在のチャンクが空でない場合は追加
      if (currentChunk) {
        chunks.push(currentChunk);
        currentChunk = line;
      } else {
        // 単一の行が最大長を超える場合は分割
        const parts = splitLongLine(line, maxLength);
        chunks.push(...parts.slice(0, -1));
        currentChunk = parts[parts.length - 1] || '';
      }
    } else {
      currentChunk = testChunk;
    }
  }
  
  // 最後のチャンクを追加
  if (currentChunk) {
    chunks.push(currentChunk);
  }
  
  return chunks;
}

/**
 * 長い行を分割する
 * @param {string} line - 分割する行
 * @param {number} maxLength - 最大文字数
 * @returns {string[]} 分割された行の配列
 */
function splitLongLine(line, maxLength) {
  const chunks = [];
  
  for (let i = 0; i < line.length; i += maxLength) {
    chunks.push(line.substring(i, i + maxLength));
  }
  
  return chunks;
}