/**
 * 统一 ID 生成器
 * 
 * 提供一致的 ID 生成策略，避免多层 ID 管理导致的同步问题
 */

/**
 * 生成玩家 ID
 * 格式：player_<timestamp>_<random>
 */
export function generatePlayerId(): string {
  return `player_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * 生成卡牌 ID
 * 格式：card_<timestamp>_<random>
 */
export function generateCardId(): string {
  return `card_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * 生成房间 ID
 * 格式：<adjective>_<noun>_<random>
 * 例如：brave_knight_7x9k2
 */
export function generateRoomId(): string {
  const adjectives = ['brave', 'clever', 'happy', 'lucky', 'mysterious', 'mighty', 'swift', 'fierce'];
  const nouns = ['knight', 'wizard', 'dragon', 'phoenix', 'tiger', 'eagle', 'wolf', 'lion'];
  const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
  const noun = nouns[Math.floor(Math.random() * nouns.length)];
  const random = Math.random().toString(36).substring(2, 7);
  return `${adj}_${noun}_${random}`;
}

/**
 * 生成随机玩家名称（中文）
 */
export function generatePlayerName(): string {
  const adjectives = ['勇敢的', '聪明的', '快乐的', '幸运的', '神秘的', '无敌的', '闪电', '火焰'];
  const nouns = ['玩家', '战士', '法师', '骑士', '猎人', '忍者', '侠客', '王者'];
  const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
  const noun = nouns[Math.floor(Math.random() * nouns.length)];
  const num = Math.floor(Math.random() * 100);
  return `${adj}${noun}${num}`;
}

/**
 * 验证玩家 ID 格式
 */
export function isValidPlayerId(id: string): boolean {
  return /^player_\d+_[a-z0-9]+$/.test(id);
}

/**
 * 验证房间 ID 格式
 */
export function isValidRoomId(id: string): boolean {
  return /^[a-z]+_[a-z]+_[a-z0-9]+$/.test(id);
}
