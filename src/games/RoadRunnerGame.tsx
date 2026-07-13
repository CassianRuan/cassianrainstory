import { useEffect, useMemo, useRef, useState } from 'react'
import type { RunnerNode } from '../schemas/story'
import { audioManager } from '../audio/audioManager'
import { GameFrame } from './GameFrame'
import { useGameSession } from './useGameSession'

export function RoadRunnerGame({ node, onComplete }: { node: RunnerNode; onComplete: () => void }) {
  const [lane, setLane] = useState(1)
  const [distance, setDistance] = useState(0)
  const [hitIds, setHitIds] = useState<string[]>([])
  const session = useGameSession(node.rules.timeLimitSec, node.rules.maxMistakes, onComplete)
  const stateRef = useRef({ lane, distance, hitIds })
  stateRef.current = { lane, distance, hitIds }

  useEffect(() => {
    setLane(1)
    setDistance(0)
    setHitIds([])
  }, [session.attempt])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (session.failure || session.completed) return
      if (event.key === 'ArrowLeft' || event.key.toLowerCase() === 'a') {
        event.preventDefault()
        setLane((value) => Math.max(0, value - 1))
      }
      if (event.key === 'ArrowRight' || event.key.toLowerCase() === 'd') {
        event.preventDefault()
        setLane((value) => Math.min(2, value + 1))
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [session.completed, session.failure])

  useEffect(() => {
    if (session.failure || session.completed) return
    const timer = window.setInterval(() => {
      setDistance((current) => {
        const next = Math.min(node.goalDistance, current + 6)
        if (next >= node.goalDistance) session.succeed()
        const obstacle = node.obstacles.find((item) =>
          !stateRef.current.hitIds.includes(item.id)
          && item.lane === stateRef.current.lane
          && current < item.at + 9
          && next >= item.at - 9,
        )
        if (obstacle) {
          setHitIds((ids) => [...ids, obstacle.id])
          session.makeMistake('车辆撞上了障碍')
          audioManager.playSfx('obstacle-hit')
        }
        return next
      })
    }, 50)
    return () => window.clearInterval(timer)
  }, [node.goalDistance, node.obstacles, session.attempt, session.completed, session.failure, session.makeMistake, session.succeed])

  const visibleObstacles = useMemo(() => node.obstacles.filter((item) => item.at - distance > -20 && item.at - distance < 260), [distance, node.obstacles])
  const percent = Math.min(100, Math.round(distance / node.goalDistance * 100))

  return (
    <GameFrame title={node.title} intro={node.intro} secondsLeft={session.secondsLeft} mistakes={session.mistakes}
      maxMistakes={node.rules.maxMistakes} progress={`${percent}%`}
      failure={session.failure} completed={session.completed} onRetry={session.retry}>
      <div className="runner-stage" style={{ backgroundImage: `linear-gradient(#07101aaa, #05040366), url(${node.scene})` }}>
        <div className="rain-lines" />
        <div className="road-perspective"><span /><span /></div>
        {visibleObstacles.map((obstacle) => {
          const delta = obstacle.at - distance
          const depth = Math.max(0, Math.min(1, 1 - delta / 260))
          return <div key={obstacle.id} className={`road-obstacle ${obstacle.kind} ${hitIds.includes(obstacle.id) ? 'hit' : ''}`}
            style={{ left: `${25 + obstacle.lane * 25}%`, top: `${12 + depth * 66}%`, transform: `translate(-50%,-50%) scale(${0.35 + depth * 0.9})`, zIndex: Math.round(depth * 20) }}>
            {obstacle.kind === 'rock' ? '◆' : obstacle.kind === 'fallen-tree' ? '━' : '▥'}
          </div>
        })}
        <div className="runner-car" style={{ left: `${25 + lane * 25}%` }}><span className="car-light left" /><span className="car-light right" /><b /></div>
        <div className="runner-distance"><span style={{ width: `${percent}%` }} /><b>{Math.round(distance)} / {node.goalDistance} m</b></div>
        <div className="runner-controls"><kbd>←</kbd><span>变换车道</span><kbd>→</kbd></div>
      </div>
    </GameFrame>
  )
}
