module.exports = {
  name: 'clear',
  description: '会話履歴をクリアします',
  /**
   * 会話履歴をクリアするコマンド
   */
  async execute(message, args, client, conversationHistory) {
    // 会話履歴をクリア
    conversationHistory.clearHistory(message.channel.id);
    
    await message.reply('会話履歴をクリアしました！新しい会話を始めましょう。');
  }
};