import { useCallback, useEffect, useRef, useState } from 'react'
import type { RunnerNode } from '../schemas/story'
import { audioManager } from '../audio/audioManager'
import { GameFrame } from './GameFrame'
import { useGameSession } from './useGameSession'
import { createObstacleWave, runnerDifficulty, type RunnerLane, type RunnerObstacleKind } from './roadRunnerLogic'

interface ActiveObstacle {
  id: number
  lane: RunnerLane
  kind: RunnerObstacleKind
  y: number
  hit: boolean
}

const laneCenters = [16.667, 50, 83.333]
const worldSpeed = 38
const finishTriggerProgress = 0.96
const carCollisionTop = 73
const carCollisionBottom = 91

export function RoadRunnerGame({ node, onComplete }: { node: RunnerNode; onComplete: () => void }) {
  const [lane, setLane] = useState<RunnerLane>(1)
  const [steering, setSteering] = useState<-1 | 0 | 1>(0)
  const [roadOffset, setRoadOffset] = useState(0)
  const [obstacles, setObstacles] = useState<ActiveObstacle[]>([])
  const [progress, setProgress] = useState(0)
  const [finishLineY, setFinishLineY] = useState<number | null>(null)
  const [invincible, setInvincible] = useState(false)
  const [impact, setImpact] = useState(false)
  const session = useGameSession(node.rules.timeLimitSec, node.rules.maxMistakes, onComplete)

  const laneRef = useRef<RunnerLane>(1)
  const progressRef = useRef(0)
  const roadOffsetRef = useRef(0)
  const obstaclesRef = useRef<ActiveObstacle[]>([])
  const finishLineRef = useRef<number | null>(null)
  const startTimeRef = useRef(0)
  const lastFrameRef = useRef(0)
  const nextSpawnRef = useRef(0)
  const obstacleIdRef = useRef(0)
  const invincibleUntilRef = useRef(0)
  const slowUntilRef = useRef(0)
  const steeringTimerRef = useRef<number | null>(null)
  const feedbackTimerRef = useRef<number | null>(null)

  useEffect(() => {
    const now = performance.now()
    laneRef.current = 1
    progressRef.current = 0
    roadOffsetRef.current = 0
    obstaclesRef.current = []
    finishLineRef.current = null
    startTimeRef.current = now
    lastFrameRef.current = now
    nextSpawnRef.current = now + node.gracePeriodSec * 1000
    obstacleIdRef.current = 0
    invincibleUntilRef.current = 0
    slowUntilRef.current = 0
    setLane(1)
    setSteering(0)
    setRoadOffset(0)
    setObstacles([])
    setProgress(0)
    setFinishLineY(null)
    setInvincible(false)
    setImpact(false)
  }, [node.gracePeriodSec, session.attempt])

  const moveLane = useCallback((direction: -1 | 1) => {
    if (session.failure || session.completed) return
    const target = Math.max(0, Math.min(2, laneRef.current + direction)) as RunnerLane
    if (target === laneRef.current) return
    laneRef.current = target
    setLane(target)
    setSteering(direction)
    if (steeringTimerRef.current) window.clearTimeout(steeringTimerRef.current)
    steeringTimerRef.current = window.setTimeout(() => setSteering(0), 180)
  }, [session.completed, session.failure])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'ArrowLeft' || event.key.toLowerCase() === 'a') {
        event.preventDefault()
        moveLane(-1)
      }
      if (event.key === 'ArrowRight' || event.key.toLowerCase() === 'd') {
        event.preventDefault()
        moveLane(1)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [moveLane])

  useEffect(() => {
    if (session.failure || session.completed) return
    let frameId = 0
    const tick = (now: number) => {
      const deltaSec = Math.min(0.05, Math.max(0, (now - lastFrameRef.current) / 1000))
      lastFrameRef.current = now
      const difficulty = runnerDifficulty(progressRef.current, node.spawnIntervalStartMs, node.spawnIntervalEndMs, node.maxSpeedMultiplier)
      const collisionSlowdown = now < slowUntilRef.current ? 0.6 : 1
      const effectiveSpeed = difficulty.speedMultiplier * collisionSlowdown
      const averageSpeed = (1 + node.maxSpeedMultiplier) / 2

      roadOffsetRef.current = (roadOffsetRef.current + worldSpeed * effectiveSpeed * deltaSec) % 100
      setRoadOffset(roadOffsetRef.current)

      if (finishLineRef.current === null) {
        const nextProgress = Math.min(finishTriggerProgress, progressRef.current + deltaSec * effectiveSpeed / (node.goalDurationSec * averageSpeed))
        progressRef.current = nextProgress
        setProgress(nextProgress)
        if (nextProgress >= finishTriggerProgress) {
          finishLineRef.current = -10
          setFinishLineY(-10)
        }
      }

      let nextObstacles = obstaclesRef.current
        .map((obstacle) => ({ ...obstacle, y: obstacle.y + worldSpeed * effectiveSpeed * deltaSec }))
        .filter((obstacle) => obstacle.y < 116)

      if (now >= nextSpawnRef.current && finishLineRef.current === null) {
        const wave = createObstacleWave(progressRef.current)
        nextObstacles = [
          ...nextObstacles,
          ...wave.map((item) => ({ id: ++obstacleIdRef.current, lane: item.lane, kind: item.kind, y: -12, hit: false })),
        ]
        nextSpawnRef.current = now + difficulty.spawnIntervalMs * (0.9 + Math.random() * 0.2)
      }

      if (now >= invincibleUntilRef.current) {
        const collision = nextObstacles.find((obstacle) => !obstacle.hit && obstacle.lane === laneRef.current && obstacle.y >= carCollisionTop && obstacle.y <= carCollisionBottom)
        if (collision) {
          nextObstacles = nextObstacles.map((obstacle) => obstacle.id === collision.id ? { ...obstacle, hit: true } : obstacle)
          invincibleUntilRef.current = now + 1500
          slowUntilRef.current = now + 800
          setInvincible(true)
          setImpact(true)
          audioManager.playSfx('obstacle-hit')
          session.makeMistake('车辆撞上了障碍')
          if (feedbackTimerRef.current) window.clearTimeout(feedbackTimerRef.current)
          feedbackTimerRef.current = window.setTimeout(() => {
            setInvincible(false)
            setImpact(false)
          }, 1500)
        }
      }
      obstaclesRef.current = nextObstacles
      setObstacles(nextObstacles)

      if (finishLineRef.current !== null) {
        finishLineRef.current += worldSpeed * effectiveSpeed * deltaSec
        setFinishLineY(finishLineRef.current)
        if (finishLineRef.current >= 82) {
          progressRef.current = 1
          setProgress(1)
          session.succeed()
          return
        }
      }
      frameId = window.requestAnimationFrame(tick)
    }
    frameId = window.requestAnimationFrame(tick)
    return () => window.cancelAnimationFrame(frameId)
  }, [node.goalDurationSec, node.maxSpeedMultiplier, node.spawnIntervalEndMs, node.spawnIntervalStartMs, session.attempt, session.completed, session.failure, session.makeMistake, session.succeed])

  useEffect(() => () => {
    if (steeringTimerRef.current) window.clearTimeout(steeringTimerRef.current)
    if (feedbackTimerRef.current) window.clearTimeout(feedbackTimerRef.current)
  }, [])

  return (
    <GameFrame eyebrow="暴雨驾驶模式" title={node.title} intro={node.intro} secondsLeft={session.secondsLeft} mistakes={session.mistakes}
      maxMistakes={node.rules.maxMistakes} progress={`${Math.round(progress * 100)}%`}
      failure={session.failure} completed={session.completed} onRetry={session.retry}>
      <div className={`runner-stage runner-topdown ${impact ? 'impact' : ''}`} style={{ backgroundImage: `linear-gradient(#07101abb, #050403aa), url(${node.scene})` }}>
        <div className="runner-road">
          <img className="runner-road-tile" src={node.roadImage} alt="" aria-hidden="true" style={{ transform: `translateY(${roadOffset - 100}%)` }} />
          <img className="runner-road-tile" src={node.roadImage} alt="" aria-hidden="true" style={{ transform: `translateY(${roadOffset}%)` }} />
          {finishLineY !== null && <div className="runner-finish-line" style={{ top: `${finishLineY}%` }}><span>FINISH</span></div>}
          {obstacles.map((obstacle) => <img key={obstacle.id}
            className={`runner-obstacle-sprite ${obstacle.kind} ${obstacle.hit ? 'hit' : ''}`}
            src={node.obstacleImages[obstacle.kind]} alt="" aria-hidden="true"
            style={{ left: `${laneCenters[obstacle.lane]}%`, top: `${obstacle.y}%` }} />)}
          <img className={`runner-player-car steer-${steering} ${invincible ? 'invincible' : ''}`}
            src={node.carImage} alt="玩家汽车" style={{ left: `${laneCenters[lane]}%` }} />
        </div>
        <div className="rain-lines" />
        <div className="runner-distance"><span style={{ width: `${progress * 100}%` }} /><b>{finishLineY === null ? '距离终点' : '终点就在前方'}</b></div>
        <div className="runner-controls"><kbd>←</kbd><span>快速切换车道</span><kbd>→</kbd></div>
      </div>
    </GameFrame>
  )
}
