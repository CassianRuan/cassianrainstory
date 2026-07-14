import { useCallback, useEffect, useMemo, useState } from 'react'
import { loadStory, loadStoryIndex, nodeIndex } from '../engine/storyLoader'
import type { Story, StoryIndex, StoryNode } from '../schemas/story'
import { useGameStore } from '../stores/gameStore'
import { audioManager } from '../audio/audioManager'
import { cancelSpeech, pauseSpeech } from '../speech/speechEngine'
import { SceneBackdrop } from '../components/SceneBackdrop'
import { NarrativePlayer } from '../components/NarrativePlayer'
import { StoryMenu } from '../components/StoryMenu'
import { SettingsPanel } from '../components/SettingsPanel'
import { StartScreen } from '../components/StartScreen'
import { EndingScreen } from '../components/EndingScreen'
import { ObjectHuntGame } from '../games/ObjectHuntGame'
import { SpotDifferenceGame } from '../games/SpotDifferenceGame'
import { QteGame } from '../games/QteGame'
import { RoadRunnerGame } from '../games/RoadRunnerGame'
import { QuizGame } from '../games/QuizGame'

export function App() {
  const [storyIndex, setStoryIndex] = useState<StoryIndex | null>(null)
  const [story, setStory] = useState<Story | null>(null)
  const [error, setError] = useState('')
  const [menuOpen, setMenuOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const store = useGameStore()

  useEffect(() => {
    const init = async () => {
      try {
        const index = await loadStoryIndex()
        const loadedStory = await loadStory(index.stories[0].config)
        setStoryIndex(index)
        setStory(loadedStory)
        if (store.storyId === loadedStory.id && store.currentNodeId && nodeIndex(loadedStory, store.currentNodeId) < 0) {
          store.restartStory(loadedStory.id, loadedStory.startNodeId)
        }
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : '故事加载失败')
      }
    }
    void init()
  }, [])

  const currentNode = useMemo<StoryNode | null>(() => {
    if (!story) return null
    return story.nodes.find((node) => node.id === (store.currentNodeId || story.startNodeId)) ?? story.nodes[0]
  }, [story, store.currentNodeId])

  useEffect(() => {
    if (story) audioManager.prepare(story, store.settings)
  }, [story])

  useEffect(() => {
    if (!story || !currentNode || !store.hasStarted) return
    audioManager.configure(story, store.settings)
    audioManager.playLoop('music', currentNode.music)
    audioManager.playLoop('ambience', currentNode.ambience)
    audioManager.syncEffectLoops(currentNode.loopSfx)
    const isVideoScene = currentNode.scene.endsWith('.mp4') || currentNode.scene.endsWith('.webm')
    currentNode.enterSfx
      .filter((id) => !(isVideoScene && id === 'thunder-strike'))
      .forEach((id, index) => window.setTimeout(() => audioManager.playSfx(id), index * 320))
    return () => { cancelSpeech() }
  }, [story, currentNode?.id, store.hasStarted])

  useEffect(() => audioManager.updateSettings(store.settings), [store.settings])

  useEffect(() => {
    const onVisibility = () => {
      if (document.hidden) { pauseSpeech(); store.setPaused(true) }
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [])

  const advance = useCallback(() => {
    if (!story || !currentNode?.nextNodeId) return
    const nextIndex = nodeIndex(story, currentNode.nextNodeId)
    store.unlockNode(currentNode.nextNodeId, nextIndex)
  }, [currentNode, story, store.unlockNode])

  const completeGame = useCallback(() => {
    if (!currentNode) return
    store.completeGame(currentNode.id)
    advance()
  }, [advance, currentNode, store.completeGame])

  if (error) return <main className="fatal-error"><span>配置错误</span><h1>故事无法开始</h1><p>{error}</p><button onClick={() => location.reload()}>重新加载</button></main>
  if (!story || !storyIndex || !currentNode) return <main className="loading-screen"><div className="loader" /><p>正在点亮木屋里的灯……</p></main>

  if (!store.hasStarted) {
    return <StartScreen story={story} index={storyIndex} hasSave={Boolean(store.currentNodeId)} onStart={() => {
      audioManager.unlock()
      store.startStory(story.id, story.startNodeId)
    }} />
  }

  return (
    <main className="game-app">
      <SceneBackdrop node={currentNode} />
      <div className="top-actions">
        <button onClick={() => setSettingsOpen(true)} aria-label="声音设置">⚙ <span>设置</span></button>
      </div>
      <StoryMenu open={menuOpen} index={storyIndex} story={story} currentNodeId={currentNode.id} furthestNodeIndex={store.furthestNodeIndex}
        onToggle={() => setMenuOpen((value) => !value)} onSelectNode={(id) => { cancelSpeech(); store.setCurrentNode(id); setMenuOpen(false) }} />
      {currentNode.type === 'narrative' && <NarrativePlayer key={currentNode.id} story={story} node={currentNode} onComplete={advance} />}
      {currentNode.type === 'object-hunt' && <ObjectHuntGame key={currentNode.id} node={currentNode} onComplete={completeGame} />}
      {currentNode.type === 'spot-difference' && <SpotDifferenceGame key={currentNode.id} node={currentNode} onComplete={completeGame} />}
      {currentNode.type === 'keyboard-qte' && <QteGame key={currentNode.id} node={currentNode} onComplete={completeGame} />}
      {currentNode.type === 'road-runner' && <RoadRunnerGame key={currentNode.id} node={currentNode} onComplete={completeGame} />}
      {currentNode.type === 'quiz' && <QuizGame key={currentNode.id} node={currentNode} onComplete={completeGame} />}
      {currentNode.type === 'ending' && <EndingScreen key={currentNode.id} story={story} node={currentNode} onRestart={() => store.restartStory(story.id, story.startNodeId)} />}
      <SettingsPanel story={story} open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </main>
  )
}
