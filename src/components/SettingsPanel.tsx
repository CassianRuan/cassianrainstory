import { useEffect, useState } from 'react'
import type { Story } from '../schemas/story'
import { getVoices, speakLine } from '../speech/speechEngine'
import { useGameStore } from '../stores/gameStore'

export function SettingsPanel({ story, open, onClose }: { story: Story; open: boolean; onClose: () => void }) {
  const settings = useGameStore((state) => state.settings)
  const setSettings = useGameStore((state) => state.setSettings)
  const voiceSelections = useGameStore((state) => state.voiceSelections)
  const setVoiceSelection = useGameStore((state) => state.setVoiceSelection)
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([])

  useEffect(() => {
    if (!('speechSynthesis' in window)) return
    const update = () => setVoices(getVoices())
    update()
    window.speechSynthesis.addEventListener('voiceschanged', update)
    return () => window.speechSynthesis.removeEventListener('voiceschanged', update)
  }, [])

  if (!open) return null
  const chineseVoices = voices.filter((voice) => voice.lang.toLowerCase().startsWith('zh'))
  const voiceOptions = chineseVoices.length ? chineseVoices : voices

  return (
    <div className="settings-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="settings-panel" role="dialog" aria-modal="true" aria-label="声音设置">
        <button className="close-button" onClick={onClose}>×</button>
        <span className="eyebrow">声音与演出</span><h2>设置</h2>
        {(['speech', 'sfx', 'music'] as const).map((channel) => (
          <label className="volume-row" key={channel}>
            <span>{channel === 'speech' ? '朗诵' : channel === 'sfx' ? '音效' : '音乐'}</span>
            <input type="range" min="0" max="1" step="0.01" value={settings[channel]} onChange={(event) => setSettings({ [channel]: Number(event.target.value) })} />
            <b>{Math.round(settings[channel] * 100)}</b>
          </label>
        ))}
        <label className="mute-row"><input type="checkbox" checked={settings.muted} onChange={(event) => setSettings({ muted: event.target.checked })} /> 全部静音</label>
        <div className="voice-settings">
          <h3>角色声音</h3>
          {Object.entries(story.characters).map(([id, character]) => (
            <div className="voice-row" key={id}>
              <label><span>{character.name}</span>
                <select value={voiceSelections[id] ?? ''} onChange={(event) => setVoiceSelection(id, event.target.value)}>
                  <option value="">自动选择中文声音</option>
                  {voiceOptions.map((voice) => <option key={`${voice.name}-${voice.lang}`} value={voice.name}>{voice.name} · {voice.lang}</option>)}
                </select>
              </label>
              <button onClick={() => void speakLine({ text: `${character.name}，声音测试。暴雨正在逼近。`, characterId: id, story, volume: settings.muted ? 0 : settings.speech, selectedVoice: voiceSelections[id] })}>试听</button>
            </div>
          ))}
          {!voices.length && <p className="settings-note">暂未检测到本机语音。仍可使用字幕继续游戏。</p>}
        </div>
      </section>
    </div>
  )
}
