import type { Story } from '../schemas/story'

let activeUtterance: SpeechSynthesisUtterance | null = null

export function getVoices(): SpeechSynthesisVoice[] {
  return typeof window !== 'undefined' && 'speechSynthesis' in window ? window.speechSynthesis.getVoices() : []
}

export function chooseVoice(characterId: string, story: Story, selectedName?: string): SpeechSynthesisVoice | undefined {
  const voices = getVoices()
  if (selectedName) {
    const selected = voices.find((voice) => voice.name === selectedName)
    if (selected) return selected
  }
  const character = story.characters[characterId]
  const hints = character?.voiceHints ?? ['zh-CN']
  return voices.find((voice) => hints.some((hint) => voice.lang.toLowerCase().startsWith(hint.toLowerCase())))
    ?? voices.find((voice) => voice.lang.toLowerCase().startsWith('zh'))
    ?? voices[0]
}

export function speakLine(options: {
  text: string
  characterId: string
  story: Story
  volume: number
  selectedVoice?: string
}): Promise<void> {
  cancelSpeech()
  if (!('speechSynthesis' in window) || options.volume <= 0) {
    return new Promise((resolve) => window.setTimeout(resolve, Math.max(1200, options.text.length * 115)))
  }
  return new Promise((resolve) => {
    const character = options.story.characters[options.characterId]
    const utterance = new SpeechSynthesisUtterance(options.text)
    utterance.lang = 'zh-CN'
    utterance.rate = character?.rate ?? 0.92
    utterance.pitch = character?.pitch ?? 1
    utterance.volume = options.volume
    utterance.voice = chooseVoice(options.characterId, options.story, options.selectedVoice) ?? null
    utterance.onend = () => { activeUtterance = null; resolve() }
    utterance.onerror = () => { activeUtterance = null; resolve() }
    activeUtterance = utterance
    window.speechSynthesis.speak(utterance)
  })
}

export function pauseSpeech(): void {
  if ('speechSynthesis' in window) window.speechSynthesis.pause()
}

export function resumeSpeech(): void {
  if ('speechSynthesis' in window) window.speechSynthesis.resume()
}

export function cancelSpeech(): void {
  if ('speechSynthesis' in window) window.speechSynthesis.cancel()
  activeUtterance = null
}
