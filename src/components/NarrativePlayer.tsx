import { useEffect, useRef, useState } from 'react'
import type { NarrativeNode, Story } from '../schemas/story'
import { audioManager } from '../audio/audioManager'
import { cancelSpeech, pauseSpeech, resumeSpeech, speakLine } from '../speech/speechEngine'
import { useGameStore } from '../stores/gameStore'

export function NarrativePlayer({ story, node, onComplete }: { story: Story; node: NarrativeNode; onComplete: () => void }) {
  const [lineIndex, setLineIndex] = useState(0)
  const isPaused = useGameStore((state) => state.isPaused)
  const setPaused = useGameStore((state) => state.setPaused)
  const settings = useGameStore((state) => state.settings)
  const voiceSelections = useGameStore((state) => state.voiceSelections)
  const runId = useRef(0)

  useEffect(() => {
    runId.current += 1
    const currentRun = runId.current
    const restoreAmbience = () => audioManager.setAmbienceDuck(1)
    setLineIndex(0)
    setPaused(false)
    audioManager.setAmbienceDuck(0.55)
    const play = async () => {
      for (let index = 0; index < node.lines.length; index += 1) {
        if (currentRun !== runId.current) return
        const line = node.lines[index]
        setLineIndex(index)
        if (line.sfx) audioManager.playSfx(line.sfx)
        await speakLine({
          text: line.text,
          characterId: line.character,
          story,
          volume: settings.muted ? 0 : settings.speech,
          selectedVoice: voiceSelections[line.character],
        })
        if (currentRun !== runId.current) return
        await new Promise((resolve) => window.setTimeout(resolve, line.pauseAfterMs))
      }
      if (currentRun === runId.current) {
        restoreAmbience()
        onComplete()
      }
    }
    void play()
    return () => { runId.current += 1; cancelSpeech(); restoreAmbience() }
  }, [node.id]) // node change intentionally restarts the sequence

  const togglePause = () => {
    if (isPaused) resumeSpeech()
    else pauseSpeech()
    setPaused(!isPaused)
  }

  const skip = () => {
    runId.current += 1
    cancelSpeech()
    audioManager.setAmbienceDuck(1)
    onComplete()
  }

  const line = node.lines[lineIndex]
  const character = story.characters[line?.character]

  return (
    <div className="narrative-layer">
      <div className="chapter-label"><span>{node.title}</span><b>{String(story.nodes.findIndex((item) => item.id === node.id) + 1).padStart(2, '0')}</b></div>
      <div className="subtitle-panel" aria-live="polite">
        <div className="speaker">{character?.name ?? '旁白'}</div>
        <p>{line?.text}</p>
        <div className="line-progress">{node.lines.map((_, index) => <span key={index} className={index <= lineIndex ? 'active' : ''} />)}</div>
      </div>
      <div className="playback-controls">
        <button onClick={togglePause}>{isPaused ? '▶ 继续' : 'Ⅱ 暂停'}</button>
        <button onClick={skip}>跳过朗诵 ›</button>
      </div>
    </div>
  )
}
