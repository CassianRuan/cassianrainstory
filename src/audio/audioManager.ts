import { Howl, Howler } from 'howler'
import type { Story } from '../schemas/story'
import type { AudioSettings } from '../stores/gameStore'

type Channel = 'music' | 'ambience' | 'sfx'

export function calculateLoopVolume(
  channel: 'music' | 'ambience',
  settings: AudioSettings,
  entryVolume: number,
  ambienceDuck: number,
): number {
  const channelVolume = channel === 'music' ? settings.music : settings.sfx
  return channelVolume * entryVolume * (channel === 'ambience' ? ambienceDuck : 1)
}

export class AudioManager {
  private story: Story | null = null
  private settings: AudioSettings = { speech: 1, music: 0.3, sfx: 0.7, muted: false }
  private active: Partial<Record<Channel, { id: string; howl: Howl }>> = {}
  private effectLoops = new Map<string, Howl>()
  private ambienceDuck = 1
  private unlockProbe: Howl | null = null

  prepare(story: Story, settings: AudioSettings): void {
    this.configure(story, settings)
    if (this.unlockProbe) return
    const rain = story.audio.ambience.find((entry) => entry.id === 'rain')
    if (!rain) return
    this.unlockProbe = new Howl({ src: [rain.src], html5: true, preload: true, volume: 0 })
  }

  unlock(): void {
    if (Howler.ctx?.state === 'suspended') void Howler.ctx.resume().catch(() => undefined)
    const probe = this.unlockProbe
    if (!probe) return
    const id = probe.play()
    probe.once('play', () => probe.stop(id), id)
    probe.once('playerror', () => undefined, id)
  }

  configure(story: Story, settings: AudioSettings): void {
    this.story = story
    this.settings = settings
    Howler.mute(settings.muted)
    this.applyVolumes()
  }

  updateSettings(settings: AudioSettings): void {
    this.settings = settings
    Howler.mute(settings.muted)
    this.applyVolumes()
  }

  playLoop(channel: 'music' | 'ambience', id?: string): void {
    if (!id || !this.story) { this.stop(channel); return }
    if (this.active[channel]?.id === id) return
    this.stop(channel)
    const entry = this.story.audio[channel].find((item) => item.id === id)
    if (!entry) return
    const howl = new Howl({ src: [entry.src], loop: true, volume: 0, html5: true })
    this.active[channel] = { id, howl }
    const playId = howl.play()
    howl.once('playerror', () => {
      howl.once('unlock', () => howl.play())
    }, playId)
    howl.fade(0, calculateLoopVolume(channel, this.settings, entry.volume, this.ambienceDuck), 500)
  }

  playSfx(id?: string): void {
    if (!id || !this.story) return
    const entry = this.story.audio.sfx.find((item) => item.id === id)
    if (!entry) return
    new Howl({ src: [entry.src], volume: this.channelVolume('sfx') * entry.volume }).play()
  }

  syncEffectLoops(ids: string[]): void {
    if (!this.story) return
    const wanted = new Set(ids)
    this.effectLoops.forEach((howl, id) => {
      if (wanted.has(id)) return
      howl.fade(howl.volume(), 0, 250)
      window.setTimeout(() => howl.unload(), 280)
      this.effectLoops.delete(id)
    })
    wanted.forEach((id) => {
      if (this.effectLoops.has(id)) return
      const entry = this.story?.audio.sfx.find((item) => item.id === id)
      if (!entry) return
      const howl = new Howl({ src: [entry.src], loop: true, volume: 0, html5: true })
      this.effectLoops.set(id, howl)
      howl.play()
      howl.fade(0, this.channelVolume('sfx') * entry.volume, 400)
    })
  }

  stop(channel: Channel): void {
    const active = this.active[channel]
    if (!active) return
    active.howl.fade(active.howl.volume(), 0, 250)
    window.setTimeout(() => active.howl.unload(), 280)
    delete this.active[channel]
  }

  stopAll(): void {
    this.stop('music')
    this.stop('ambience')
    this.stop('sfx')
    this.syncEffectLoops([])
  }

  setAmbienceDuck(multiplier: number): void {
    this.ambienceDuck = Math.max(0, Math.min(1, multiplier))
    const current = this.active.ambience
    const entry = this.story?.audio.ambience.find((item) => item.id === current?.id)
    if (!current || !entry) return
    current.howl.fade(
      current.howl.volume(),
      calculateLoopVolume('ambience', this.settings, entry.volume, this.ambienceDuck),
      300,
    )
  }

  private channelVolume(channel: Channel): number {
    return channel === 'music' ? this.settings.music : this.settings.sfx
  }

  private applyVolumes(): void {
    ;(['music', 'ambience'] as const).forEach((channel) => {
      const current = this.active[channel]
      if (!current || !this.story) return
      const entry = this.story.audio[channel].find((item) => item.id === current.id)
      current.howl.volume(calculateLoopVolume(channel, this.settings, entry?.volume ?? 1, this.ambienceDuck))
    })
    this.effectLoops.forEach((howl, id) => {
      const entry = this.story?.audio.sfx.find((item) => item.id === id)
      howl.volume(this.channelVolume('sfx') * (entry?.volume ?? 1))
    })
  }
}

export const audioManager = new AudioManager()
