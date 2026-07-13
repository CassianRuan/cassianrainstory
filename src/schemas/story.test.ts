import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { storySchema } from './story'

const config = JSON.parse(readFileSync('public/stories/pause-in-the-rain/story.json', 'utf8'))

describe('story schema', () => {
  it('accepts the production story and all referenced next nodes', () => {
    const result = storySchema.safeParse(config)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.nodes).toHaveLength(21)
      expect(result.data.nodes.some((node) => node.type === 'road-runner')).toBe(true)
      expect(result.data.nodes.some((node) => node.type === 'quiz')).toBe(true)
      const quiz = result.data.nodes.find((node) => node.type === 'quiz')
      expect(quiz?.questionImage).toContain('bridge-quiz-question.jpg')
      expect(quiz?.correctOptionId).toBe('d')
      const firstInvestigationNode = result.data.nodes.find((node) => node.music === 'investigation')
      expect(firstInvestigationNode?.id).toBe('arrival')
      const firstConfrontationNode = result.data.nodes.find((node) => node.music === 'confrontation')
      expect(firstConfrontationNode?.id).toBe('rees-enters')
      const arrivalIndex = result.data.nodes.findIndex((node) => node.id === 'arrival')
      expect(result.data.nodes.slice(0, arrivalIndex).filter((node) => node.music)).toEqual([
        expect.objectContaining({ id: 'night-drive', music: 'run-bg' }),
      ])
      const runnerMusic = result.data.audio.music.find((entry) => entry.id === 'run-bg')
      expect(runnerMusic).toEqual(expect.objectContaining({ loop: true, src: expect.stringContaining('runBg.wav') }))
      const runner = result.data.nodes.find((node) => node.type === 'road-runner')
      expect(runner).toEqual(expect.objectContaining({ spawnIntervalStartMs: 2500, spawnIntervalEndMs: 1800 }))
      const rain = result.data.audio.ambience.find((entry) => entry.id === 'rain')
      expect(rain).toEqual(expect.objectContaining({
        src: '/stories/pause-in-the-rain/audio/ambience/ambience-rain.wav',
        loop: true,
        volume: 0.85,
      }))
      const ending = result.data.nodes.find((node) => node.type === 'ending')
      expect(ending?.lines.some((line) => line.character === 'rees' && line.text.includes('真相留下的回声'))).toBe(true)
    }
  })

  it('rejects a missing next node with a useful path', () => {
    const broken = structuredClone(config)
    broken.nodes[0].nextNodeId = 'missing-node'
    const result = storySchema.safeParse(broken)
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error.issues[0].path.join('.')).toContain('nextNodeId')
  })

  it('rejects a quiz whose correct answer is absent', () => {
    const broken = structuredClone(config)
    broken.nodes.find((node: { type: string }) => node.type === 'quiz').correctOptionId = 'missing'
    const result = storySchema.safeParse(broken)
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error.issues.some((issue) => issue.path.includes('correctOptionId'))).toBe(true)
  })
})
