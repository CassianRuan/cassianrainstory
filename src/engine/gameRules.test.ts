import { describe, expect, it } from 'vitest'
import { nextMistakeCount, normalizedPoint, pointInRegion, qteJudgement } from './gameRules'

describe('game rules', () => {
  const region = { id: 'clue', x: 0.2, y: 0.3, width: 0.1, height: 0.2, label: '线索' }

  it('normalizes click coordinates independently of rendered size', () => {
    expect(normalizedPoint({ clientX: 300, clientY: 200 }, { left: 100, top: 100, width: 400, height: 200 })).toEqual({ x: 0.5, y: 0.5 })
  })

  it('detects region hits and optional tolerance', () => {
    expect(pointInRegion({ x: 0.25, y: 0.4 }, region)).toBe(true)
    expect(pointInRegion({ x: 0.19, y: 0.4 }, region)).toBe(false)
    expect(pointInRegion({ x: 0.19, y: 0.4 }, region, 0.02)).toBe(true)
  })

  it('fails exactly on the third mistake', () => {
    expect(nextMistakeCount(1, 3)).toEqual({ mistakes: 2, failed: false })
    expect(nextMistakeCount(2, 3)).toEqual({ mistakes: 3, failed: true })
  })

  it('judges qte input around a symmetric hit window', () => {
    expect(qteJudgement(4800, 5000, 600)).toBe('hit')
    expect(qteJudgement(4500, 5000, 600)).toBe('early')
    expect(qteJudgement(5400, 5000, 600)).toBe('late')
  })
})
