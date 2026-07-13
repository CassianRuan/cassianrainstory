import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface AudioSettings {
  speech: number
  music: number
  sfx: number
  muted: boolean
}

interface GameState {
  saveVersion: 1
  storyId: string
  currentNodeId: string
  furthestNodeIndex: number
  completedGameNodeIds: string[]
  completedStoryIds: string[]
  hasStarted: boolean
  isPaused: boolean
  settings: AudioSettings
  voiceSelections: Record<string, string>
  startStory: (storyId: string, startNodeId: string) => void
  setCurrentNode: (nodeId: string) => void
  unlockNode: (nodeId: string, nodeIndex: number) => void
  completeGame: (nodeId: string) => void
  completeStory: (storyId: string) => void
  restartStory: (storyId: string, startNodeId: string) => void
  setPaused: (paused: boolean) => void
  setSettings: (settings: Partial<AudioSettings>) => void
  setVoiceSelection: (characterId: string, voiceName: string) => void
}

const defaultSettings: AudioSettings = { speech: 0.88, music: 0.32, sfx: 0.72, muted: false }

export const useGameStore = create<GameState>()(
  persist(
    (set) => ({
      saveVersion: 1,
      storyId: '',
      currentNodeId: '',
      furthestNodeIndex: 0,
      completedGameNodeIds: [],
      completedStoryIds: [],
      hasStarted: false,
      isPaused: false,
      settings: defaultSettings,
      voiceSelections: {},
      startStory: (storyId, startNodeId) => set((state) => {
        if (state.storyId === storyId && state.currentNodeId) return { hasStarted: true }
        return { storyId, currentNodeId: startNodeId, furthestNodeIndex: 0, completedGameNodeIds: [], hasStarted: true, isPaused: false }
      }),
      setCurrentNode: (currentNodeId) => set({ currentNodeId, isPaused: false }),
      unlockNode: (currentNodeId, nodeIndex) => set((state) => ({ currentNodeId, furthestNodeIndex: Math.max(state.furthestNodeIndex, nodeIndex), isPaused: false })),
      completeGame: (nodeId) => set((state) => ({
        completedGameNodeIds: state.completedGameNodeIds.includes(nodeId) ? state.completedGameNodeIds : [...state.completedGameNodeIds, nodeId],
      })),
      completeStory: (storyId) => set((state) => ({
        completedStoryIds: state.completedStoryIds.includes(storyId) ? state.completedStoryIds : [...state.completedStoryIds, storyId],
      })),
      restartStory: (storyId, startNodeId) => set({ storyId, currentNodeId: startNodeId, furthestNodeIndex: 0, completedGameNodeIds: [], hasStarted: true, isPaused: false }),
      setPaused: (isPaused) => set({ isPaused }),
      setSettings: (settings) => set((state) => ({ settings: { ...state.settings, ...settings } })),
      setVoiceSelection: (characterId, voiceName) => set((state) => ({ voiceSelections: { ...state.voiceSelections, [characterId]: voiceName } })),
    }),
    {
      name: 'pause-in-the-rain-save-v1',
      version: 1,
      partialize: (state) => ({
        saveVersion: state.saveVersion,
        storyId: state.storyId,
        currentNodeId: state.currentNodeId,
        furthestNodeIndex: state.furthestNodeIndex,
        completedGameNodeIds: state.completedGameNodeIds,
        completedStoryIds: state.completedStoryIds,
        hasStarted: state.hasStarted,
        settings: state.settings,
        voiceSelections: state.voiceSelections,
      }),
    },
  ),
)
