import { readFileSync } from 'node:fs'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { storySchema, type EndingNode, type NarrativeNode } from '../schemas/story'
import { useGameStore } from '../stores/gameStore'

const audioMocks = vi.hoisted(() => ({
  setAmbienceDuck: vi.fn(),
  playSfx: vi.fn(),
}))
const speechMocks = vi.hoisted(() => ({
  speakLine: vi.fn<() => Promise<void>>(),
  cancelSpeech: vi.fn(),
  pauseSpeech: vi.fn(),
  resumeSpeech: vi.fn(),
}))

vi.mock('../audio/audioManager', () => ({
  audioManager: audioMocks,
}))
vi.mock('../speech/speechEngine', () => speechMocks)

import { EndingScreen } from './EndingScreen'
import { NarrativePlayer } from './NarrativePlayer'

const story = storySchema.parse(JSON.parse(readFileSync('public/stories/pause-in-the-rain/story.json', 'utf8')))
const narrative = story.nodes.find((node): node is NarrativeNode => node.type === 'narrative')
const ending = story.nodes.find((node): node is EndingNode => node.type === 'ending')

if (!narrative || !ending) throw new Error('Test story requires narrative and ending nodes')

const oneLineNarrative: NarrativeNode = {
  ...narrative,
  lines: [{ character: 'narrator', text: '测试台词', pauseAfterMs: 0 }],
}
const oneLineEnding: EndingNode = {
  ...ending,
  lines: [{ character: 'narrator', text: '结尾台词', pauseAfterMs: 0 }],
}

beforeEach(() => {
  vi.clearAllMocks()
  speechMocks.speakLine.mockResolvedValue()
  useGameStore.setState({
    isPaused: false,
    settings: { speech: 0.88, music: 0.32, sfx: 0.72, muted: false },
    voiceSelections: {},
  })
})

afterEach(cleanup)

describe('narration ambience ducking', () => {
  it('ducks for narrative playback and restores before completion', async () => {
    const onComplete = vi.fn()
    render(<NarrativePlayer story={story} node={oneLineNarrative} onComplete={onComplete} />)

    expect(audioMocks.setAmbienceDuck).toHaveBeenCalledWith(0.55)
    await waitFor(() => expect(onComplete).toHaveBeenCalledOnce())
    expect(audioMocks.setAmbienceDuck).toHaveBeenLastCalledWith(1)
  })

  it('restores ambience when narrative playback is skipped', () => {
    speechMocks.speakLine.mockReturnValue(new Promise(() => undefined))
    const onComplete = vi.fn()
    render(<NarrativePlayer story={story} node={oneLineNarrative} onComplete={onComplete} />)

    fireEvent.click(screen.getByRole('button', { name: '跳过朗诵 ›' }))

    expect(audioMocks.setAmbienceDuck).toHaveBeenLastCalledWith(1)
    expect(onComplete).toHaveBeenCalledOnce()
  })

  it('restores ambience when ending narration is skipped', () => {
    speechMocks.speakLine.mockReturnValue(new Promise(() => undefined))
    render(<EndingScreen story={story} node={oneLineEnding} onRestart={vi.fn()} />)

    fireEvent.click(screen.getByRole('button', { name: '跳过朗诵 ›' }))

    expect(audioMocks.setAmbienceDuck).toHaveBeenLastCalledWith(1)
    expect(screen.getByText('THE END')).toBeInTheDocument()
  })
})
