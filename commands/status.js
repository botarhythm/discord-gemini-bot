const os = require('os');
const { version } = require('../package.json');

module.exports = {
  name: 'status',
  description: 'ボットの状態を表示します',
  /**
   * ボットのステータスを表示
   */
  async execute(message, args, client, conversationHistory) {
    // システム情報
    const uptime = formatUptime(client.uptime);
    const memoryUsage = process.memoryUsage().heapUsed / 1024 / 1024;
    const systemMemory = os.totalmem() / 1024 / 1024 / 1024;
    const freeMemory = os.freemem() / 1024 / 1024 / 1024;
    
    // 会話履歴の情報
    const historyLength = conversationHistory.getHistoryLength(message.channel.id);
    
    // ステータスメッセージを構築
    let statusText = `# ボットのステータス\n\n`;
    statusText += `## システム情報\n`;
    statusText += `- **稼働時間**: ${uptime}\n`;
    statusText += `- **メモリ使用量**: ${memoryUsage.toFixed(2)} MB\n`;
    statusText += `- **システムメモリ**: ${systemMemory.toFixed(2)} GB (空き: ${freeMemory.toFixed(2)} GB)\n`;
    statusText += `- **実行環境**: Node.js ${process.version}\n`;
    statusText += `- **ボットバージョン**: ${version}\n\n`;
    
    statusText += `## 会話情報\n`;
    statusText += `- **このチャンネルでの会話数**: ${historyLength}\n`;
    statusText += `- **接続サーバー数**: ${client.guilds.cache.size}\n`;
    
    await message.reply(statusText);
  }
};

/**
 * アップタイムを読みやすい形式にフォーマット
 */
function formatUptime(ms) {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  
  return `${days}日 ${hours % 24}時間 ${minutes % 60}分 ${seconds % 60}秒`;
}