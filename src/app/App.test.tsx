import { readFileSync } from 'node:fs'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { storyIndexSchema, storySchema } from '../schemas/story'
import { useGameStore } from '../stores/gameStore'

const loaderMocks = vi.hoisted(() => ({
  loadStory: vi.fn(),
  loadStoryIndex: vi.fn(),
}))
const audioMocks = vi.hoisted(() => ({
  configure: vi.fn(),
  playLoop: vi.fn(),
  syncEffectLoops: vi.fn(),
  playSfx: vi.fn(),
  updateSettings: vi.fn(),
  prepare: vi.fn(),
  unlock: vi.fn(),
  setAmbienceDuck: vi.fn(),
}))

vi.mock('../engine/storyLoader', async (importOriginal) => ({
  ...await importOriginal<typeof import('../engine/storyLoader')>(),
  loadStory: loaderMocks.loadStory,
  loadStoryIndex: loaderMocks.loadStoryIndex,
}))
vi.mock('../audio/audioManager', () => ({ audioManager: audioMocks }))

import { App } from './App'

const index = storyIndexSchema.parse(JSON.parse(readFileSync('public/stories/index.json', 'utf8')))
const story = storySchema.parse(JSON.parse(readFileSync('public/stories/pause-in-the-rain/story.json', 'utf8')))

beforeEach(() => {
  vi.clearAllMocks()
  loaderMocks.loadStoryIndex.mockResolvedValue(index)
  loaderMocks.loadStory.mockResolvedValue(story)
  useGameStore.setState({
    storyId: '',
    currentNodeId: '',
    furthestNodeIndex: 0,
    completedGameNodeIds: [],
    completedStoryIds: [],
    hasStarted: false,
    isPaused: false,
    settings: { speech: 0.88, music: 0.32, sfx: 0.72, muted: false },
    voiceSelections: {},
  })
})

afterEach(cleanup)

describe('App audio startup', () => {
  it('prepares before the start screen and unlocks inside the start click', async () => {
    render(<App />)
    const start = await screen.findByRole('button', { name: '开始故事' })

    expect(audioMocks.prepare).toHaveBeenCalledWith(story, useGameStore.getState().settings)
    fireEvent.click(start)

    expect(audioMocks.unlock).toHaveBeenCalledOnce()
    await waitFor(() => expect(audioMocks.playLoop).toHaveBeenCalledWith('ambience', 'rain'))
    expect(audioMocks.unlock.mock.invocationCallOrder[0]).toBeLessThan(audioMocks.playLoop.mock.invocationCallOrder[0])
  })
})
