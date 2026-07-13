import { Howl, Howler } from 'howler'
import type { Story } from '../schemas/story'
import type { AudioSettings } from '../stores/gameStore'

type Channel = 'music' | 'ambience' | 'sfx'

class AudioManager {
  private story: Story | null = null
  private settings: AudioSettings = { speech: 1, music: 0.3, sfx: 0.7, muted: false }
  private active: Partial<Record<Channel, { id: string; howl: Howl }>> = {}

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
    howl.play()
    howl.fade(0, this.channelVolume(channel) * entry.volume, 500)
  }

  playSfx(id?: string): void {
    if (!id || !this.story) return
    const entry = this.story.audio.sfx.find((item) => item.id === id)
    if (!entry) return
    new Howl({ src: [entry.src], volume: this.channelVolume('sfx') * entry.volume }).play()
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
  }

  private channelVolume(channel: Channel): number {
    return channel === 'music' ? this.settings.music : this.settings.sfx
  }

  private applyVolumes(): void {
    ;(['music', 'ambience'] as const).forEach((channel) => {
      const current = this.active[channel]
      if (!current || !this.story) return
      const entry = this.story.audio[channel].find((item) => item.id === current.id)
      current.howl.volume(this.channelVolume(channel) * (entry?.volume ?? 1))
    })
  }
}

export const audioManager = new AudioManager()
