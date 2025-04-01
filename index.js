require('dotenv').config();
global.fetch = require('node-fetch');

const { Client, Intents } = require('discord.js');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const character = require('./config/character');
const express = require('express');

const client = new Client({
  intents: [
    Intents.FLAGS.GUILDS,
    Intents.FLAGS.GUILD_MESSAGES,
    Intents.FLAGS.DIRECT_MESSAGES
  ],
  partials: ['MESSAGE', 'CHANNEL', 'GUILD_MEMBER']
});

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

const app = express();
app.get('/', (req, res) => res.send('Bot is running!'));
app.listen(process.env.PORT || 3000);

client.once('ready', () => console.log(`Logged in as ${client.user.tag}!`));

async function braveSearch(query) {
  console.log(`[検索処理] Brave APIにアクセスします: ${query}`);
  const response = await fetch(`https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}`, {
    headers: {
      'Accept': 'application/json',
      'X-Subscription-Token': process.env.BRAVE_API_KEY
    }
  });

  console.log(`[検索処理] Brave APIステータス: ${response.status}`);
  if (!response.ok) throw new Error(`Brave API error: ${response.statusText}`);
  const data = await response.json();

  const results = data.web?.results?.slice(0, 3) || [];
  console.log('[検索処理] Brave Search 結果取得完了:', JSON.stringify(results, null, 2));
  return results;
}

async function braveSearchAndSummarize(message, query) {
  try {
    const results = await braveSearch(query);
    if (!results.length) return message.reply('検索結果が見つかりませんでした。');

    const summaryPrompt = `
以下は「${query}」に関するWebページです。
各記事を日本語で約200文字以内に要約してください。リンクは不要です。

${results.map((r, i) => `【${i + 1}】${r.title}\n${r.description || r.snippet || ''}`).join('\n\n')}
`;

    console.log('[検索処理] 要約プロンプト生成完了。Geminiへ送信中...');
    const result = await model.generateContent(summaryPrompt);
    const summary = result.response.text();

    console.log('[検索処理] Gemini要約完了');
    console.log('[検索処理] Gemini応答内容:\n', summary);

    // 各要約ブロックをURLとマージ
    const blocks = summary.split(/\n\s*\n/);
    const withLinks = blocks.map((block, i) => {
      const url = results[i]?.url || '';
      return `${block.trim()}\n▶︎ 続きを読む: ${url}`;
    }).join('\n\n');

    if (withLinks.length > 2000) {
      const chunks = splitMessage(withLinks);
      for (const chunk of chunks) {
        await message.reply(chunk);
      }
      console.log('[送信] 要約を分割して返信完了');
    } else {
      await message.reply(withLinks);
      console.log('[送信] 要約を返信完了');
    }
  } catch (error) {
    console.error('[送信エラー] 要約の返信中にエラー:', error);
    await message.reply('検索結果の要約中にエラーが発生しました。ごめんね。');
  }
}

client.on('messageCreate', async message => {
  if (message.author.bot) return;

  const botMention = `<@${client.user.id}>`;
  const prefix = process.env.PREFIX || '!';
  const rawContent = message.content;

  console.log(`[受信] ${message.author.tag}#${message.channel.id}: ${rawContent}`);

  if (rawContent.startsWith(prefix)) {
    const args = rawContent.slice(prefix.length).trim().split(/ +/);
    const commandName = args.shift().toLowerCase();

    if (commandName === 'clear') {
      conversationHistory.clearHistory(message.channel.id);
      return message.reply('会話履歴をクリアしました！');
    } else if (commandName === 'help') {
      return message.reply(`
# ボッチーのヘルプ
- メンション or DM で会話
- スレッド内ではメンション不要
- 「検索して〜」などの自然な言い方でWeb検索＋要約
- コマンド一覧:
  - !clear: 履歴クリア
  - !help: ヘルプ表示
`);
    }
  }

  // 「検索」キーワードが含まれていればトリガー
  let query = null;
  if (/検索|調べて/.test(rawContent)) {
    query = rawContent.replace(/.*(検索して|検索|調べて)/i, '').trim();
  }

  if (query) {
    console.log(`[検索要求] トリガー検出、検索へ進行: ${query}`);
    return braveSearchAndSummarize(message, query);
  } else {
    console.log('[検索要求] トリガー未検出、通常対話へ移行');
  }

  // 通常のGemini対話
  let prompt = '';
  if (!message.guildId) {
    prompt = rawContent.trim();
  } else if (
    message.channel.isThread() ||
    rawContent.includes(botMention) ||
    message.mentions.users.has(client.user.id)
  ) {
    prompt = rawContent.replace(/<@!?\d+>/g, '').trim();
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

    console.log('[対話処理] Geminiへ送信するプロンプト: \n', fullPrompt);
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
    console.error('通常対話中にエラー:', error);
    message.reply('申し訳ありません、応答中にエラーが発生しました。');
  }
});

client.login(process.env.DISCORD_TOKEN);

function splitMessage(text, maxLength = 2000) {
  const chunks = [];
  for (let i = 0; i < text.length; i += maxLength) {
    chunks.push(text.substring(i, i + maxLength));
  }
  return chunks;
}
