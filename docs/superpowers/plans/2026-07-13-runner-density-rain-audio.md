# Runner Density and Rain Audio Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the opening rain clearly audible with reliable browser startup and speech ducking, while reducing runner obstacle density to a 2500→1800 ms curve.

**Architecture:** Keep story-specific tuning in `story.json`, add deterministic WAV gain processing as a reusable Node script, and centralize browser unlock plus ambience ducking in `AudioManager`. Narrative components only signal the beginning and end of narration; they do not manipulate Howler instances directly.

**Tech Stack:** React 19, TypeScript 5.8, Howler 2.2, Zustand, Vitest, Testing Library, Vite, Node.js.

## Global Constraints

- Keep `ambience-rain.wav`; do not replace it with MP3.
- Set the rain asset volume to exactly `0.85`.
- Set runner spawn intervals to exactly `2500` ms at the start and `1800` ms at the end.
- Preserve three lanes, at least one open lane, runner speed, collision rules, invulnerability, duration, and obstacle types.
- Use the enhanced rain on every node that already references ambience id `rain`; do not change fireplace nodes to rain.
- Duck only the ambience channel to exactly `55%` during narration.
- Preserve saved effect volume and mute preferences.
- Do not add a new ambience settings slider or alter other music/SFX volumes.

---

### Task 1: Story tuning and deterministic WAV gain

**Files:**
- Create: `scripts/amplify-wav.mjs`
- Modify: `public/stories/pause-in-the-rain/story.json`
- Modify: `public/stories/pause-in-the-rain/audio/ambience/ambience-rain.wav`
- Modify: `src/schemas/story.test.ts`

**Interfaces:**
- Consumes: 16-bit little-endian PCM WAV input and a numeric linear gain CLI argument.
- Produces: in-place WAV sample amplification with saturation protection; story configuration values `volume: 0.85`, `spawnIntervalStartMs: 2500`, and `spawnIntervalEndMs: 1800`.

- [ ] **Step 1: Change the configuration assertions first**

Replace the existing runner interval assertion and add a rain-volume assertion in `src/schemas/story.test.ts`:

```ts
expect(runner).toEqual(expect.objectContaining({
  spawnIntervalStartMs: 2500,
  spawnIntervalEndMs: 1800,
}))
expect(story.audio.ambience.find((entry) => entry.id === 'rain')).toEqual(
  expect.objectContaining({
    src: '/stories/pause-in-the-rain/audio/ambience/ambience-rain.wav',
    loop: true,
    volume: 0.85,
  }),
)
```

- [ ] **Step 2: Run the focused test and verify red**

Run: `npm test -- src/schemas/story.test.ts`

Expected: FAIL because the current values are `1800`, `1250`, and `0.62`.

- [ ] **Step 3: Add the deterministic WAV utility**

Create `scripts/amplify-wav.mjs` with exact validation and clipping protection:

```js
import { readFileSync, writeFileSync } from 'node:fs'

const [path, gainText] = process.argv.slice(2)
const gain = Number(gainText)
if (!path || !Number.isFinite(gain) || gain <= 0) {
  throw new Error('Usage: node scripts/amplify-wav.mjs <16-bit-pcm.wav> <linear-gain>')
}

const wav = readFileSync(path)
if (wav.toString('ascii', 0, 4) !== 'RIFF' || wav.toString('ascii', 8, 12) !== 'WAVE') {
  throw new Error('Input is not a RIFF/WAVE file')
}

let offset = 12
let format
let dataOffset
let dataSize
while (offset + 8 <= wav.length) {
  const id = wav.toString('ascii', offset, offset + 4)
  const size = wav.readUInt32LE(offset + 4)
  if (id === 'fmt ') format = { audioFormat: wav.readUInt16LE(offset + 8), bitsPerSample: wav.readUInt16LE(offset + 22) }
  if (id === 'data') { dataOffset = offset + 8; dataSize = size; break }
  offset += 8 + size + (size % 2)
}
if (!format || format.audioFormat !== 1 || format.bitsPerSample !== 16 || dataOffset === undefined || dataSize === undefined) {
  throw new Error('Only 16-bit PCM WAV files are supported')
}

for (let index = dataOffset; index < dataOffset + dataSize; index += 2) {
  const amplified = Math.round(wav.readInt16LE(index) * gain)
  wav.writeInt16LE(Math.max(-32768, Math.min(32767, amplified)), index)
}
writeFileSync(path, wav)
```

- [ ] **Step 4: Amplify the rain once and verify its measured level**

Run: `node scripts/amplify-wav.mjs public/stories/pause-in-the-rain/audio/ambience/ambience-rain.wav 2`

Then run the existing Node PCM measurement snippet used during diagnosis. Expected: RMS rises from about `-28.7 dB` to about `-22.7 dB`, peak remains at or below `0 dB`, and the file remains RIFF PCM 16-bit stereo 22050 Hz.

- [ ] **Step 5: Update story configuration**

Change only these values in `story.json`:

```json
{ "id": "rain", "src": "/stories/pause-in-the-rain/audio/ambience/ambience-rain.wav", "loop": true, "volume": 0.85 }
```

```json
"spawnIntervalStartMs": 2500,
"spawnIntervalEndMs": 1800
```

- [ ] **Step 6: Run focused tests and commit**

Run: `npm test -- src/schemas/story.test.ts src/games/roadRunnerLogic.test.ts`

Expected: both files PASS and fairness tests still prove at least one open lane.

Commit:

```bash
git add scripts/amplify-wav.mjs public/stories/pause-in-the-rain/story.json public/stories/pause-in-the-rain/audio/ambience/ambience-rain.wav src/schemas/story.test.ts
git commit -m "Tune runner density and rain loudness"
```

### Task 2: Audio unlock and ambience gain model

**Files:**
- Create: `src/audio/audioManager.test.ts`
- Modify: `src/audio/audioManager.ts`

**Interfaces:**
- Produces: `calculateLoopVolume(channel: 'music' | 'ambience', settings: AudioSettings, entryVolume: number, ambienceDuck: number): number`.
- Produces: `AudioManager.prepare(story: Story, settings: AudioSettings): void`, `AudioManager.unlock(): void`, and `AudioManager.setAmbienceDuck(multiplier: number): void`.
- Preserves: `configure`, `updateSettings`, `playLoop`, SFX loop behavior, and the exported singleton `audioManager`.

- [ ] **Step 1: Write failing pure gain tests**

Create `src/audio/audioManager.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { calculateLoopVolume } from './audioManager'

const settings = { speech: 0.88, music: 0.32, sfx: 0.72, muted: false }

describe('calculateLoopVolume', () => {
  it('uses the effects control for ambience', () => {
    expect(calculateLoopVolume('ambience', settings, 0.85, 1)).toBeCloseTo(0.612)
  })

  it('ducks ambience to 55 percent without changing music', () => {
    expect(calculateLoopVolume('ambience', settings, 0.85, 0.55)).toBeCloseTo(0.3366)
    expect(calculateLoopVolume('music', settings, 0.7, 0.55)).toBeCloseTo(0.224)
  })
})
```

- [ ] **Step 2: Run the focused test and verify red**

Run: `npm test -- src/audio/audioManager.test.ts`

Expected: FAIL because `calculateLoopVolume` is not exported.

- [ ] **Step 3: Implement the gain helper and duck state**

Add the pure function and state:

```ts
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
  private ambienceDuck = 1
  private unlockProbe: Howl | null = null
  // existing fields and methods remain
}
```

Route `playLoop` and `applyVolumes` through `calculateLoopVolume`. Add:

```ts
setAmbienceDuck(multiplier: number): void {
  this.ambienceDuck = Math.max(0, Math.min(1, multiplier))
  const current = this.active.ambience
  const entry = this.story?.audio.ambience.find((item) => item.id === current?.id)
  if (current && entry) {
    current.howl.fade(current.howl.volume(), calculateLoopVolume('ambience', this.settings, entry.volume, this.ambienceDuck), 300)
  }
}
```

- [ ] **Step 4: Implement pre-start preparation and user-gesture unlock**

Add preparation that creates Howler's audio context and installs its HTML5 unlock handlers before the first click:

```ts
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
```

For every main loop `play()`, register a one-time `playerror` handler that retries on Howler's `unlock` event. Do not throw into the story UI.

- [ ] **Step 5: Run audio tests and commit**

Run: `npm test -- src/audio/audioManager.test.ts`

Expected: 2 tests PASS.

Commit:

```bash
git add src/audio/audioManager.ts src/audio/audioManager.test.ts
git commit -m "Add reliable ambience playback controls"
```

### Task 3: Connect unlock and narration ducking

**Files:**
- Modify: `src/app/App.tsx`
- Modify: `src/components/NarrativePlayer.tsx`
- Modify: `src/components/EndingScreen.tsx`
- Create: `src/components/NarrativePlayer.test.tsx`

**Interfaces:**
- Consumes: `audioManager.prepare`, `audioManager.unlock`, and `audioManager.setAmbienceDuck` from Task 2.
- Produces: pre-start Howler preparation, same-click unlock, and balanced duck/reset calls across every narration exit path.

- [ ] **Step 1: Write a failing narration lifecycle test**

Mock `audioManager.setAmbienceDuck`, `speakLine`, and the game store, render a one-line `NarrativePlayer`, and assert:

```ts
expect(setAmbienceDuck).toHaveBeenCalledWith(0.55)
await waitFor(() => expect(setAmbienceDuck).toHaveBeenLastCalledWith(1))
```

Add a second case that clicks `跳过朗诵 ›` and asserts the final call is `1` before `onComplete`.

- [ ] **Step 2: Run the focused component test and verify red**

Run: `npm test -- src/components/NarrativePlayer.test.tsx`

Expected: FAIL because narration does not yet control ambience ducking.

- [ ] **Step 3: Prepare and unlock audio from App**

Add a pre-start effect once `story` is loaded:

```ts
useEffect(() => {
  if (story) audioManager.prepare(story, store.settings)
}, [story])
```

Change the start callback to keep unlock in the click stack:

```tsx
onStart={() => {
  audioManager.unlock()
  store.startStory(story.id, story.startNodeId)
}}
```

Keep settings updates in the existing effect so persisted user preferences remain authoritative.

- [ ] **Step 4: Add balanced narration ducking**

At the start of each narrative/ending playback effect call:

```ts
audioManager.setAmbienceDuck(0.55)
```

Create one local reset function and call it before normal completion, skip completion, and effect cleanup:

```ts
const restoreAmbience = () => audioManager.setAmbienceDuck(1)
```

Import `audioManager` into `EndingScreen` and apply the same start/reset behavior there. Ensure cancellation and component unmount cannot leave the duck active.

- [ ] **Step 5: Run component and full tests, then commit**

Run: `npm test -- src/components/NarrativePlayer.test.tsx src/audio/audioManager.test.ts`

Expected: all focused tests PASS.

Run: `npm test`

Expected: all repository tests PASS.

Commit:

```bash
git add src/app/App.tsx src/components/NarrativePlayer.tsx src/components/EndingScreen.tsx src/components/NarrativePlayer.test.tsx
git commit -m "Duck rain during narration"
```

### Task 4: Verification, documentation, and release

**Files:**
- Modify: `README.md`
- Modify: `docs/ASSET_INVENTORY.md`
- Modify: `AI_USAGE_LOG.md`

**Interfaces:**
- Consumes: completed behavior from Tasks 1–3.
- Produces: verified local build, browser evidence, audit record, GitHub commits, and Vercel production deployment.

- [ ] **Step 1: Run static and automated verification**

Run:

```bash
npm run typecheck
npm test
npm run build
git diff --check
```

Expected: TypeScript exits 0, all Vitest tests pass, Vite production build succeeds, and `git diff --check` prints nothing.

- [ ] **Step 2: Verify all story resources locally**

Start Vite, collect every unique `scene`, music, ambience, SFX, loop SFX, sprite, and quiz image URL from `story.json`, then request each URL.

Expected: every unique story resource returns HTTP 200, including the amplified `ambience-rain.wav`.

- [ ] **Step 3: Perform desktop browser acceptance**

At 1440×900 in Chromium:

1. Clear the story save and load the start screen.
2. Click “开始故事” and verify the rain media enters the playing state in the first office node.
3. Verify rain is clearly audible, drops to 55% target gain during narration, and returns to the normal target after narration/skip.
4. Open `night-drive`, observe multiple spawn cycles, and confirm the configured 2500→1800 ms density is visibly lower while at least one lane remains open.

Expected: all four checks pass with no failed audio or asset requests.

- [ ] **Step 4: Update project documentation and AI record**

Document the new runner interval, rain volume, WAV amplification, startup unlock, ducking behavior, measured test count, browser result, and any browser automation limitation. Do not record private links, extraction codes, tokens, or credentials.

- [ ] **Step 5: Commit, push, and verify production**

Commit:

```bash
git add README.md docs/ASSET_INVENTORY.md AI_USAGE_LOG.md
git commit -m "Document rain audio improvements"
git push origin main
```

Wait for Vercel production to update, then repeat configuration, resource, and Chromium checks against `https://cassianrainstory.vercel.app`.

Expected: production serves the new config and WAV, all resources return HTTP 200, and the opening rain plus runner density checks pass.
