import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Story } from '../schemas/story'
import { cancelSpeech, speakLine } from './speechEngine'

class MockSpeechSynthesisUtterance {
  text: string
  lang = ''
  rate = 1
  pitch = 1
  volume = 1
  voice: SpeechSynthesisVoice | null = null
  onend: (() => void) | null = null
  onerror: (() => void) | null = null

  constructor(text: string) {
    this.text = text
  }
}

const story: Story = {
  schemaVersion: 1,
  id: 'test-story',
  title: '测试故事',
  subtitle: '测试副标题',
  cover: '/cover.jpg',
  startNodeId: 'node-1',
  characters: {
    narrator: { name: '旁白', voiceHints: ['zh-CN'], rate: 0.84, pitch: 0.86 },
  },
  audio: {
    music: [],
    ambience: [],
    sfx: [],
  },
  nodes: [{
    id: 'node-1',
    type: 'narrative',
    title: '测试节点',
    nextNodeId: null,
    scene: '/scene.jpg',
    sceneLoop: true,
    transition: 'fade',
    enterSfx: [],
    loopSfx: [],
    lines: [],
  }],
}

describe('speechEngine', () => {
  const speechSynthesisMock = {
    getVoices: vi.fn(() => []),
    speak: vi.fn(),
    cancel: vi.fn(),
    pause: vi.fn(),
    resume: vi.fn(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
    Object.defineProperty(window, 'speechSynthesis', {
      configurable: true,
      value: speechSynthesisMock,
    })
    Object.defineProperty(globalThis, 'SpeechSynthesisUtterance', {
      configurable: true,
      value: MockSpeechSynthesisUtterance,
    })
  })

  afterEach(() => {
    cancelSpeech()
  })

  it('resolves pending narration immediately when skipped', async () => {
    const playback = speakLine({
      text: '测试台词',
      characterId: 'narrator',
      story,
      volume: 1,
    })

    expect(speechSynthesisMock.speak).toHaveBeenCalledOnce()

    cancelSpeech()

    await expect(playback).resolves.toBeUndefined()
    expect(speechSynthesisMock.cancel).toHaveBeenCalled()
  })
})
