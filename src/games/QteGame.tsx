import { useEffect, useMemo, useRef, useState } from 'react'
import type { QteNode } from '../schemas/story'
import { qteJudgement } from '../engine/gameRules'
import { audioManager } from '../audio/audioManager'
import { GameFrame } from './GameFrame'
import { useGameSession } from './useGameSession'

export function QteGame({ node, onComplete }: { node: QteNode; onComplete: () => void }) {
  const [elapsed, setElapsed] = useState(0)
  const [noteIndex, setNoteIndex] = useState(0)
  const startRef = useRef(performance.now())
  const session = useGameSession(node.rules.timeLimitSec, node.rules.maxMistakes, onComplete)
  const currentNote = node.notes[noteIndex]

  useEffect(() => {
    startRef.current = performance.now()
    setElapsed(0)
    setNoteIndex(0)
  }, [session.attempt])

  useEffect(() => {
    if (session.failure || session.completed) return
    let frame = 0
    const tick = () => {
      const value = performance.now() - startRef.current
      setElapsed(value)
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [session.attempt, session.completed, session.failure])

  useEffect(() => {
    if (!currentNote || session.failure || session.completed) return
    if (elapsed > currentNote.atMs + node.hitWindowMs / 2) {
      const failed = session.makeMistake('错过了音符')
      if (!failed) setNoteIndex((index) => index + 1)
    }
  }, [currentNote, elapsed, node.hitWindowMs, session])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!currentNote || session.failure || session.completed || event.repeat) return
      const key = event.key.toUpperCase()
      if (key !== currentNote.key.toUpperCase()) {
        session.makeMistake(`按错了 ${key}`)
        audioManager.playSfx('clock')
        return
      }
      const result = qteJudgement(performance.now() - startRef.current, currentNote.atMs, node.hitWindowMs)
      if (result !== 'hit') {
        session.makeMistake(result === 'early' ? '按得太早' : '按得太晚')
        return
      }
      audioManager.playSfx(noteIndex === node.notes.length - 1 ? 'piano-chord' : 'piano-low')
      if (noteIndex === node.notes.length - 1) session.succeed()
      else setNoteIndex((index) => index + 1)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [currentNote, node.hitWindowMs, node.notes.length, noteIndex, session])

  const notePosition = useMemo(() => {
    if (!currentNote) return 18
    const progress = Math.max(0, Math.min(1, (elapsed - (currentNote.atMs - node.travelMs)) / node.travelMs))
    return 100 - progress * 82
  }, [currentNote, elapsed, node.travelMs])

  return (
    <GameFrame title={node.title} intro={node.intro} secondsLeft={session.secondsLeft} mistakes={session.mistakes}
      maxMistakes={node.rules.maxMistakes} progress={`${noteIndex} / ${node.notes.length}`}
      failure={session.failure} completed={session.completed} onRetry={session.retry}>
      <div className="qte-stage" style={{ backgroundImage: `linear-gradient(rgba(5,4,3,.45), rgba(5,4,3,.75)), url(${node.scene})` }}>
        <div className="qte-track">
          <span className="judge-zone" />
          {currentNote && elapsed >= currentNote.atMs - node.travelMs && (
            <span className="qte-note" style={{ left: `${notePosition}%` }}>{currentNote.key.toUpperCase()}</span>
          )}
        </div>
        <div className="keyboard-row">
          {[...new Set(node.notes.map((note) => note.key.toUpperCase()))].map((key) => <kbd key={key} className={currentNote?.key.toUpperCase() === key ? 'active' : ''}>{key}</kbd>)}
        </div>
        <p className="qte-hint">等待音符进入左侧金色区域，再按下对应按键</p>
      </div>
    </GameFrame>
  )
}
