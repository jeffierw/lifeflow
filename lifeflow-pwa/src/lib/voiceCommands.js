const commands = {
  next: ['下一步', '下一个', '好了', '完成了'],
  prev: ['上一步', '上一个', '退回'],
  repeat: ['重复', '再说一遍', '再说', '重听'],
  pause: ['暂停', '停一下', '等一下', '停下来'],
  resume: ['继续', '继续播放', '继续说', '接着说'],
  skip: ['跳过', '不要这步'],
}

export function normalizeVoiceText(text) {
  return String(text || '').trim().replace(/[。！？!?，,\s]/g, '')
}

export function parseVoiceCommand(transcript, customKeywords = []) {
  const text = normalizeVoiceText(transcript)
  for (const [command, phrases] of Object.entries(commands)) {
    if (phrases.includes(text)) return command
  }
  return customKeywords.some(keyword => normalizeVoiceText(keyword) === text && text) ? 'next' : null
}
