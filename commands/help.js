const { getCommandList } = require('./index');
const character = require('../config/character');

module.exports = {
  name: 'help',
  description: 'コマンド一覧と使い方を表示します',
  /**
   * ヘルプコマンドを実行
   */
  async execute(message, args, client) {
    const commands = getCommandList();
    
    // 埋め込みメッセージを作成
    let helpText = `# ${character.name}のヘルプ\n\n`;
    helpText += `## 基本的な使い方\n`;
    helpText += `- DMでメッセージを送るか、サーバー内でメンションするとAIが応答します\n`;
    helpText += `- 例: <@${client.user.id}> こんにちは\n\n`;
    
    helpText += `## コマンド一覧\n`;
    commands.forEach(cmd => {
      helpText += `- **!${cmd.name}**: ${cmd.description}\n`;
    });
    
    helpText += `\n## 特徴\n`;
    character.traits.forEach(trait => {
      helpText += `- ${trait}\n`;
    });
    
    await message.reply(helpText);
  }
};