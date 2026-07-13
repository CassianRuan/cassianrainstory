import { useCallback, useEffect, useRef, useState } from 'react'
import { normalizedPoint, pointInRegion } from '../engine/gameRules'
import type { SpotDifferenceNode } from '../schemas/story'
import { audioManager } from '../audio/audioManager'
import { GameFrame } from './GameFrame'
import { useGameSession } from './useGameSession'

export function SpotDifferenceGame({ node, onComplete }: { node: SpotDifferenceNode; onComplete: () => void }) {
  const [found, setFound] = useState<string[]>([])
  const rightRef = useRef<HTMLImageElement>(null)
  const session = useGameSession(node.rules.timeLimitSec, node.rules.maxMistakes, onComplete)
  useEffect(() => setFound([]), [session.attempt])

  const handleClick = useCallback((event: React.MouseEvent<HTMLImageElement>) => {
    if (!rightRef.current || session.failure || session.completed) return
    const point = normalizedPoint(event, rightRef.current.getBoundingClientRect())
    const hit = node.regions.find((region) => !found.includes(region.id) && pointInRegion(point, region, 0.008))
    if (!hit) {
      session.makeMistake('那里没有变化')
      audioManager.playSfx('clock')
      return
    }
    const nextFound = [...found, hit.id]
    setFound(nextFound)
    audioManager.playSfx('piano-low')
    if (nextFound.length === node.regions.length) session.succeed()
  }, [found, node.regions, session])

  return (
    <GameFrame title={node.title} intro={node.intro} secondsLeft={session.secondsLeft} mistakes={session.mistakes}
      maxMistakes={node.rules.maxMistakes} progress={`${found.length} / ${node.regions.length}`}
      failure={session.failure} completed={session.completed} onRetry={session.retry}>
      <div className="difference-grid">
        <figure><img src={node.leftImage} alt="现场记忆" draggable={false} /><figcaption>进入时的记忆</figcaption></figure>
        <figure className="difference-right">
          <img ref={rightRef} src={node.rightImage} alt="当前现场，只能点击此图" draggable={false} onClick={handleClick} />
          {found.map((id) => {
            const region = node.regions.find((item) => item.id === id)!
            return <span key={id} className="difference-marker" style={{ left: `${(region.x + region.width / 2) * 100}%`, top: `${(region.y + region.height / 2) * 100}%` }} />
          })}
          <figcaption>当前现场 · 点击此图</figcaption>
        </figure>
      </div>
    </GameFrame>
  )
}
