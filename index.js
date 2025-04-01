// Discord.js v13に完全対応したindex.js
require('dotenv').config();

// fetchポリフィルを追加
global.fetch = require('node-fetch');

const { Client, Intents } = require('discord.js');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const character = require('./config/character');
const express = require('express');

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
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ 
  model: "gemini-2.0-flash",
  generationConfig: {
    temperature: 0.7,
    topK: 40,
    topP: 0.95,
    maxOutputTokens: 1024,
  }
});

// 会話履歴を管理するクラス
class ConversationHistory {
  constructor() {
    this.histories = new Map();
    this.maxHistoryLength = 15;
    this.contextWindow = 5;
    this.lastInteractionTime = new Map();
    this.INTERACTION_TIMEOUT = 15 * 60 * 1000;
  }

  addMessage(channelId, role, content) {
    if (!this.histories.has(channelId)) {
      this.histories.set(channelId, []);
    }
    this.lastInteractionTime.set(channelId, Date.now());
    const history = this.histories.get(channelId);
    history.push({ role, content, timestamp: Date.now() });
    while (history.length > this.maxHistoryLength) history.shift();
  }

  getFormattedHistory(channelId) {
    const lastInteraction = this.lastInteractionTime.get(channelId) || 0;
    if (Date.now() - lastInteraction > this.INTERACTION_TIMEOUT) {
      this.clearHistory(channelId);
    }
    const history = this.histories.get(channelId) || [];
    return history.slice(-this.contextWindow).map(message => {
      const role = message.role === 'user' ? 'ユーザー' : 'アシスタント';
      return `${role}: ${message.content}`;
    }).join('\n');
  }

  clearHistory(channelId) {
    this.histories.delete(channelId);
  }
}

const conversationHistory = new ConversationHistory();

// Expressサーバー設定
const app = express();
app.get('/', (req, res) => res.send('Bot is running!'));
app.listen(process.env.PORT || 3000);

// ボットが準備できたときの処理
client.once('ready', () => console.log(`Logged in as ${client.user.tag}!`));

// メッセージ処理
client.on('messageCreate', async message => {
  if (message.author.bot) return;

  const botMention = `<@${client.user.id}>`;
  const prefix = process.env.PREFIX || '!';

  let prompt = '';

  if (message.content.startsWith(prefix)) {
    const args = message.content.slice(prefix.length).trim().split(/ +/);
    const commandName = args.shift().toLowerCase();

    if (commandName === 'clear') {
      conversationHistory.clearHistory(message.channel.id);
      return message.reply('会話履歴をクリアしました！');
    } else if (commandName === 'help') {
      return message.reply(`
# ボッチーのヘルプ
- DMまたはサーバー内でメンションするとAIが応答
- スレッド内ではメンション不要
- コマンド一覧:
  - !clear: 履歴クリア
  - !help: ヘルプ表示
`);
    }
  }

  if (!message.guildId) {
    prompt = message.content.trim();
  } else if (
    message.channel.isThread() || 
    message.content.includes(botMention) || 
    message.mentions.users.has(client.user.id)
  ) {
    prompt = message.content.replace(/<@!?\d+>/g, '').trim();
  } else {
    return;
  }

  if (!prompt) return;

  try {
    message.channel.sendTyping().catch(console.error);

    const history = conversationHistory.getFormattedHistory(message.channel.id);

    const fullPrompt = `
${character.systemPrompt}

以下の会話履歴を参考に、質問に答えてください。

会話履歴:
${history}

質問: ${prompt}

回答:`;

    const result = await model.generateContent(fullPrompt);
    const response = result.response.text();

    conversationHistory.addMessage(message.channel.id, 'user', prompt);
    conversationHistory.addMessage(message.channel.id, 'assistant', response);

    if (response.length > 2000) {
      splitMessage(response).forEach(chunk => message.reply(chunk));
    } else {
      message.reply(response);
    }
  } catch (error) {
    console.error('Error:', error);
    message.reply('申し訳ありません。エラーが発生しました。');
  }
});

// ログイン
client.login(process.env.DISCORD_TOKEN);

// メッセージ分割関数
function splitMessage(text, maxLength = 2000) {
  const chunks = [];
  for (let i = 0; i < text.length; i += maxLength) {
    chunks.push(text.substring(i, i + maxLength));
  }
  return chunks;
}
