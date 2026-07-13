import { describe, expect, it } from 'vitest'
import type { Story } from '../schemas/story'
import { canVisitNode, nodeIndex } from './storyLoader'

const story = { nodes: [{ id: 'one' }, { id: 'two' }, { id: 'three' }] } as Story

describe('story navigation', () => {
  it('allows replaying unlocked nodes but blocks forward skipping', () => {
    expect(canVisitNode(story, 'one', 1)).toBe(true)
    expect(canVisitNode(story, 'two', 1)).toBe(true)
    expect(canVisitNode(story, 'three', 1)).toBe(false)
  })

  it('returns -1 for unknown nodes', () => {
    expect(nodeIndex(story, 'unknown')).toBe(-1)
  })
})
