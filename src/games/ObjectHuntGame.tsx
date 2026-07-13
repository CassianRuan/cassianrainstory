import { useCallback, useEffect, useRef, useState } from 'react'
import { normalizedPoint, pointInRegion } from '../engine/gameRules'
import type { ObjectHuntNode } from '../schemas/story'
import { audioManager } from '../audio/audioManager'
import { GameFrame } from './GameFrame'
import { useGameSession } from './useGameSession'

export function ObjectHuntGame({ node, onComplete }: { node: ObjectHuntNode; onComplete: () => void }) {
  const [found, setFound] = useState<string[]>([])
  const [feedback, setFeedback] = useState('仔细观察房间，点击可疑物品。')
  const imageRef = useRef<HTMLImageElement>(null)
  const session = useGameSession(node.rules.timeLimitSec, node.rules.maxMistakes, onComplete)

  useEffect(() => { setFound([]); setFeedback('仔细观察房间，点击可疑物品。') }, [session.attempt])

  const handleClick = useCallback((event: React.MouseEvent<HTMLImageElement>) => {
    if (session.failure || session.completed || !imageRef.current) return
    const point = normalizedPoint(event, imageRef.current.getBoundingClientRect())
    const hit = node.regions.find((region) => !found.includes(region.id) && pointInRegion(point, region, 0.008))
    if (!hit) {
      session.makeMistake('这里只是无关的陈设')
      audioManager.playSfx('clock')
      setFeedback('不是这里。误判会消耗一次机会。')
      return
    }
    const nextFound = [...found, hit.id]
    setFound(nextFound)
    setFeedback(hit.feedback ?? `发现：${hit.label}`)
    const soundByRegion: Record<string, string> = { clock: 'clock', teapot: 'tea', bow: 'bow', score: 'paper' }
    audioManager.playSfx(soundByRegion[hit.id])
    if (nextFound.length === node.regions.length) session.succeed()
  }, [found, node.regions, session])

  return (
    <GameFrame title={node.title} intro={node.intro} secondsLeft={session.secondsLeft} mistakes={session.mistakes}
      maxMistakes={node.rules.maxMistakes} progress={`${found.length} / ${node.regions.length}`}
      failure={session.failure} completed={session.completed} onRetry={session.retry}>
      <div className="object-stage">
        <img ref={imageRef} src={node.scene} alt="木屋调查场景" draggable={false} onClick={handleClick} />
        {found.map((id) => {
          const region = node.regions.find((item) => item.id === id)!
          return <span key={id} className="found-region" style={{ left: `${region.x * 100}%`, top: `${region.y * 100}%`, width: `${region.width * 100}%`, height: `${region.height * 100}%` }} />
        })}
        <div className="clue-feedback">{feedback}</div>
      </div>
    </GameFrame>
  )
}
