import { readFileSync } from 'node:fs'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { storySchema } from '../schemas/story'

const howlerMocks = vi.hoisted(() => ({
  instances: [] as Array<{
    fade: ReturnType<typeof vi.fn>
    once: ReturnType<typeof vi.fn>
    play: ReturnType<typeof vi.fn>
    stop: ReturnType<typeof vi.fn>
    volume: ReturnType<typeof vi.fn>
  }>,
  mute: vi.fn(),
  resume: vi.fn(() => Promise.resolve()),
}))

vi.mock('howler', () => {
  class MockHowl {
    private volumeValue: number
    fade = vi.fn((_from: number, to: number) => { this.volumeValue = to })
    once = vi.fn()
    play = vi.fn(() => 1)
    stop = vi.fn()
    unload = vi.fn()

    constructor(options: { volume?: number }) {
      this.volumeValue = options.volume ?? 1
      howlerMocks.instances.push(this)
    }

    volume = vi.fn((value?: number) => {
      if (value === undefined) return this.volumeValue
      this.volumeValue = value
      return this
    })
  }

  return {
    Howl: MockHowl,
    Howler: {
      ctx: { state: 'suspended', resume: howlerMocks.resume },
      mute: howlerMocks.mute,
    },
  }
})

import { AudioManager, calculateLoopVolume } from './audioManager'

const settings = { speech: 0.88, music: 0.32, sfx: 0.72, muted: false }
const story = storySchema.parse(JSON.parse(readFileSync('public/stories/pause-in-the-rain/story.json', 'utf8')))

beforeEach(() => {
  howlerMocks.instances.length = 0
  vi.clearAllMocks()
})

describe('calculateLoopVolume', () => {
  it('uses the effects control for ambience', () => {
    expect(calculateLoopVolume('ambience', settings, 0.85, 1)).toBeCloseTo(0.612)
  })

  it('ducks ambience to 55 percent without changing music', () => {
    expect(calculateLoopVolume('ambience', settings, 0.85, 0.55)).toBeCloseTo(0.3366)
    expect(calculateLoopVolume('music', settings, 0.7, 0.55)).toBeCloseTo(0.224)
  })
})

describe('AudioManager', () => {
  it('fades active ambience to the requested duck multiplier', () => {
    const manager = new AudioManager()
    manager.configure(story, settings)
    manager.playLoop('ambience', 'rain')

    manager.setAmbienceDuck(0.55)

    expect(howlerMocks.instances[0].fade).toHaveBeenLastCalledWith(0.612, 0.3366, 300)
  })

  it('prepares before start and unlocks from the user gesture', () => {
    const manager = new AudioManager()
    manager.prepare(story, settings)

    manager.unlock()

    expect(howlerMocks.resume).toHaveBeenCalledOnce()
    expect(howlerMocks.instances[0].play).toHaveBeenCalledOnce()
    expect(howlerMocks.instances[0].once).toHaveBeenCalledWith('play', expect.any(Function), 1)
  })

  it('retries a loop after Howler reports that audio was unlocked', () => {
    const manager = new AudioManager()
    manager.configure(story, settings)
    manager.playLoop('ambience', 'rain')
    const ambience = howlerMocks.instances[0]

    const playError = ambience.once.mock.calls.find(([event]) => event === 'playerror')?.[1]
    expect(playError).toEqual(expect.any(Function))
    playError()
    const unlocked = ambience.once.mock.calls.find(([event]) => event === 'unlock')?.[1]
    expect(unlocked).toEqual(expect.any(Function))
    unlocked()

    expect(ambience.play).toHaveBeenCalledTimes(2)
  })
})
