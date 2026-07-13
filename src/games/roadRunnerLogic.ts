export type RunnerLane = 0 | 1 | 2
export type RunnerObstacleKind = 'barrel' | 'rock' | 'warning' | 'crate'

export interface ObstacleWaveItem {
  lane: RunnerLane
  kind: RunnerObstacleKind
}

const kinds: RunnerObstacleKind[] = ['barrel', 'rock', 'warning', 'crate']

export function runnerDifficulty(progress: number, intervalStartMs = 1400, intervalEndMs = 900, maxSpeed = 1.35) {
  const normalized = Math.max(0, Math.min(1, progress))
  const eased = normalized * normalized * (3 - 2 * normalized)
  return {
    speedMultiplier: 1 + (maxSpeed - 1) * eased,
    spawnIntervalMs: intervalStartMs + (intervalEndMs - intervalStartMs) * eased,
  }
}

export function createObstacleWave(progress: number, random: () => number = Math.random): ObstacleWaveItem[] {
  const twoObstacleChance = 0.22 + Math.max(0, Math.min(1, progress)) * 0.4
  const count = random() < twoObstacleChance ? 2 : 1
  const lanes: RunnerLane[] = [0, 1, 2]
  for (let index = lanes.length - 1; index > 0; index -= 1) {
    const target = Math.floor(random() * (index + 1))
    ;[lanes[index], lanes[target]] = [lanes[target], lanes[index]]
  }
  return lanes.slice(0, count).map((lane) => ({
    lane,
    kind: kinds[Math.min(kinds.length - 1, Math.floor(random() * kinds.length))],
  }))
}
