import { describe, expect, it } from 'vitest'
import { createObstacleWave, runnerDifficulty } from './roadRunnerLogic'

describe('road runner generation', () => {
  it('always leaves at least one of the three lanes open', () => {
    for (let index = 0; index < 100; index += 1) {
      const values = [index / 100, 0.99, 0.6, 0.2]
      let cursor = 0
      const wave = createObstacleWave(index / 99, () => values[cursor++ % values.length])
      expect(new Set(wave.map((item) => item.lane)).size).toBeLessThanOrEqual(2)
    }
  })

  it('ramps speed up and spawn intervals down without exceeding configured limits', () => {
    const start = runnerDifficulty(0)
    const middle = runnerDifficulty(0.5)
    const end = runnerDifficulty(1)
    expect(start).toEqual({ speedMultiplier: 1, spawnIntervalMs: 1400 })
    expect(middle.speedMultiplier).toBeGreaterThan(start.speedMultiplier)
    expect(middle.spawnIntervalMs).toBeLessThan(start.spawnIntervalMs)
    expect(end).toEqual({ speedMultiplier: 1.35, spawnIntervalMs: 900 })
  })
})
