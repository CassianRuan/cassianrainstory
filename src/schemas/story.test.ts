import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { storySchema } from './story'

const config = JSON.parse(readFileSync('public/stories/pause-in-the-rain/story.json', 'utf8'))

describe('story schema', () => {
  it('accepts the production story and all referenced next nodes', () => {
    const result = storySchema.safeParse(config)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.nodes).toHaveLength(16)
      expect(result.data.nodes.some((node) => node.type === 'road-runner')).toBe(true)
      expect(result.data.nodes.some((node) => node.type === 'quiz')).toBe(true)
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
