import { useEffect, useRef } from 'react'
import { audioManager } from '../audio/audioManager'
import type { StoryNode } from '../schemas/story'

export function SceneBackdrop({ node }: { node: StoryNode }) {
  const isVideo = node.scene.endsWith('.mp4') || node.scene.endsWith('.webm')
  const previousTimeRef = useRef(0)
  const delayedStrikeTimersRef = useRef<number[]>([])
  const loopSfxId = isVideo && node.enterSfx.includes('thunder-strike') ? 'thunder-strike' : undefined

  const playDelayedStrikePair = () => {
    if (!loopSfxId) return
    audioManager.playSfx(loopSfxId)
    delayedStrikeTimersRef.current.push(window.setTimeout(() => {
      audioManager.playSfx(loopSfxId)
    }, 1500))
  }

  useEffect(() => {
    previousTimeRef.current = 0
    delayedStrikeTimersRef.current.forEach((timerId) => window.clearTimeout(timerId))
    delayedStrikeTimersRef.current = []
    if (!loopSfxId) return
    playDelayedStrikePair()
    return () => {
      delayedStrikeTimersRef.current.forEach((timerId) => window.clearTimeout(timerId))
      delayedStrikeTimersRef.current = []
    }
  }, [node.id, loopSfxId])

  return (
    <div className={`scene-backdrop transition-${node.transition}`} key={node.id}>
      {isVideo ? (
        <video
          src={node.scene}
          autoPlay
          loop={node.sceneLoop}
          playsInline
          aria-hidden="true"
          onTimeUpdate={(event) => {
            if (!loopSfxId) return
            const currentTime = event.currentTarget.currentTime
            if (currentTime + 0.25 < previousTimeRef.current) {
              playDelayedStrikePair()
            }
            previousTimeRef.current = currentTime
          }}
        />
      ) : (
        <img src={node.scene} alt="" aria-hidden="true" />
      )}
      <div className="scene-vignette" />
      {(node.transition === 'flash' || node.transition === 'blackout') && <span className="lightning-flash" />}
    </div>
  )
}
