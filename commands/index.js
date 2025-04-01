const fs = require('fs');
const path = require('path');

// コマンドを格納するコレクション
const commands = new Map();

// コマンドファイルの読み込み
const commandFiles = fs.readdirSync(__dirname)
  .filter(file => file.endsWith('.js') && file !== 'index.js');

// コマンドをロード
for (const file of commandFiles) {
  const command = require(path.join(__dirname, file));
  if (command.name) {
    commands.set(command.name.toLowerCase(), command);
    console.log(`Command loaded: ${command.name}`);
  }
}

/**
 * コマンドハンドラー
 * @param {string} commandName - コマンド名
 * @param {Object} message - Discordメッセージオブジェクト
 * @param {Array} args - コマンド引数
 * @param {Object} client - Discordクライアント
 * @param {Object} conversationHistory - 会話履歴
 * @param {Object} model - Gemini AIモデル
 * @returns {Promise<boolean>} コマンドが実行されたかどうか
 */
async function handleCommand(commandName, message, args, client, conversationHistory, model) {
  // コマンド名が登録されているか確認
  if (commands.has(commandName)) {
    try {
      await commands.get(commandName).execute(message, args, client, conversationHistory, model);
      return true;
    } catch (error) {
      console.error(`Command execution error: ${commandName}`, error);
      await message.reply('コマンドの実行中にエラーが発生しました。');
      return true;
    }
  }
  
  return false;
}

// コマンド一覧表示用の関数
function getCommandList() {
  return Array.from(commands.values()).map(cmd => {
    return {
      name: cmd.name,
      description: cmd.description
    };
  });
}

module.exports = {
  handleCommand,
  getCommandList
};