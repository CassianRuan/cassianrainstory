import { useEffect, useRef, useState } from 'react'
import type { EndingNode, Story } from '../schemas/story'
import { audioManager } from '../audio/audioManager'
import { cancelSpeech, speakLine } from '../speech/speechEngine'
import { useGameStore } from '../stores/gameStore'

export function EndingScreen({ story, node, onRestart }: { story: Story; node: EndingNode; onRestart: () => void }) {
  const [ready, setReady] = useState(false)
  const [lineIndex, setLineIndex] = useState(0)
  const settings = useGameStore((state) => state.settings)
  const selections = useGameStore((state) => state.voiceSelections)
  const completeStory = useGameStore((state) => state.completeStory)
  const run = useRef(0)

  useEffect(() => {
    run.current += 1
    const id = run.current
    const restoreAmbience = () => audioManager.setAmbienceDuck(1)
    audioManager.setAmbienceDuck(0.55)
    const play = async () => {
      for (let index = 0; index < node.lines.length; index += 1) {
        if (id !== run.current) return
        setLineIndex(index)
        const line = node.lines[index]
        await speakLine({ text: line.text, characterId: line.character, story, volume: settings.muted ? 0 : settings.speech, selectedVoice: selections[line.character] })
        await new Promise((resolve) => window.setTimeout(resolve, line.pauseAfterMs))
      }
      if (id === run.current) { restoreAmbience(); completeStory(story.id); setReady(true) }
    }
    void play()
    return () => { run.current += 1; cancelSpeech(); restoreAmbience() }
  }, [node.id])

  const line = node.lines[lineIndex]
  const character = story.characters[line?.character]

  return (
    <div className="ending-layer">
      {!ready ? (
        <div className="subtitle-panel ending-subtitle"><div className="speaker">{character?.name ?? '旁白'}</div><p>{line?.text}</p><button onClick={() => { run.current += 1; cancelSpeech(); audioManager.setAmbienceDuck(1); completeStory(story.id); setReady(true) }}>跳过朗诵 ›</button></div>
      ) : (
        <div className="ending-card"><span>THE END</span><h1>{node.message}</h1><div className="ornament">◆</div><p>暴雨终会停下，但有些声音，会永远留在黑暗里。</p><button className="primary-button" onClick={onRestart}>重新开始</button></div>
      )}
    </div>
  )
}
