require('dotenv').config();
const { Client, GatewayIntentBits, Partials } = require('discord.js');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const character = require('./config/character');
const ConversationHistory = require('./utils/conversationHistory');
const WebSearch = require('./utils/webSearch');

// 環境変数の確認
console.log('Environment variables:');
console.log('PREFIX:', process.env.PREFIX);
console.log('CHANNEL_ID:', process.env.CHANNEL_ID);
console.log('GUILD_ID:', process.env.GUILD_ID);
console.log('GEMINI_API_KEY:', process.env.GEMINI_API_KEY ? '設定されています' : '未設定です');

// Discordクライアントの初期化
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages
  ],
  partials: [Partials.Message, Partials.Channel, Partials.GuildMember]
});

// Gemini APIの初期化
let model;
try {
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  model = genAI.getGenerativeModel({ 
    model: "gemini-2.0-flash-lite",
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

// 会話履歴の初期化
const conversationHistory = new ConversationHistory(10);

// WebSearchの初期化
const webSearch = new WebSearch();

// Glitch用の設定
const port = process.env.PORT || 3000;
const express = require('express');
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

  console.log('Checking message content...');
  console.log(`Message mentions bot? ${message.mentions.users.has(client.user.id)}`);

  // DMの場合はメンションなしでも応答
  if (!message.guildId) {
    prompt = message.content.trim();
    console.log('DM detected, prompt:', prompt);
  } else if (message.mentions.users.has(client.user.id)) {
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
    // 検索を実行
    const searchResults = await webSearch.search(prompt);
    const formattedSearchResults = webSearch.formatResults(searchResults);

    // 会話履歴を取得
    const history = conversationHistory.getFormattedHistory(message.channel.id);
    
    // Gemini APIに送信するプロンプトを構築
    const fullPrompt = `
以下の会話履歴と検索結果を参考に、質問に答えてください。
検索結果に基づいて、できるだけ具体的な情報を提供してください。

会話履歴:
${history}

検索結果:
${formattedSearchResults}

質問: ${prompt}

回答:`;

    // Gemini APIにリクエスト
    const result = await model.generateContent(fullPrompt);
    const response = result.response.text();

    // 会話履歴に追加
    conversationHistory.addMessage(message.channel.id, 'user', prompt);
    conversationHistory.addMessage(message.channel.id, 'assistant', response);

    await message.reply(response);
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

async function processPrompt(prompt, channelId) {
  try {
    // 検索を実行
    const searchResults = await webSearch.search(prompt);
    const formattedSearchResults = webSearch.formatResults(searchResults);

    // 会話履歴を取得
    const history = conversationHistory.getFormattedHistory(channelId);
    
    // Gemini APIに送信するプロンプトを構築
    const fullPrompt = `
以下の会話履歴と検索結果を参考に、質問に答えてください。
検索結果に基づいて、できるだけ具体的な情報を提供してください。

会話履歴:
${history}

検索結果:
${formattedSearchResults}

質問: ${prompt}

回答:`;

    // Gemini APIにリクエスト
    const result = await model.generateContent(fullPrompt);
    const response = result.response.text();

    // 会話履歴に追加
    conversationHistory.addMessage(channelId, 'user', prompt);
    conversationHistory.addMessage(channelId, 'assistant', response);

    return response;
  } catch (error) {
    console.error('Error processing prompt:', error);
    return '申し訳ありません。エラーが発生しました。';
  }
} 