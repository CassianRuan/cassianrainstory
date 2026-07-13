# Seamless Rain Loop Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the rain asset's final fade-to-silence and create a smooth, peak-safe 30.5-second circular loop.

**Architecture:** Add a deterministic Node.js RIFF/PCM processor that trims at 32 seconds, rotates the loop start by 1.5 seconds, and blends the old tail into the old head with an equal-power crossfade. Prove the binary transformation with an automated temporary-file test before applying it to the production WAV.

**Tech Stack:** Node.js built-ins, TypeScript 5.8, Vitest, Howler, Vite.

## Global Constraints

- Modify only `ambience-rain.wav`; do not replace it with MP3 or another format.
- Preserve 16-bit PCM, stereo, and 22050 Hz.
- Trim the source at exactly 32 seconds and use an exactly 1.5-second equal-power crossfade.
- Keep peak magnitude at or below 95% PCM full scale without hard clipping.
- Keep story volume `0.85` and 55% narration ducking unchanged.
- Do not alter other music, ambience, SFX, or runner behavior.

---

### Task 1: Test and implement deterministic seamless-loop processing

**Files:**
- Create: `scripts/make-seamless-wav.mjs`
- Create: `scripts/make-seamless-wav.test.ts`

**Interfaces:**
- Consumes: `node scripts/make-seamless-wav.mjs <input.wav> <trim-end-sec> <crossfade-sec>`.
- Produces: an in-place 16-bit PCM WAV with the original metadata chunks, rewritten RIFF/data sizes, rotated content, equal-power crossfade, and optional uniform peak scaling.

- [ ] **Step 1: Write the failing integration test**

Create a Vitest test that writes a deterministic 34.01-second, 16-bit, 22050 Hz stereo synthetic WAV to a temporary directory. Its signal stays active through 32 seconds and fades to zero over the final 2.01 seconds. Invoke the missing script with `32` and `1.5`, parse its `fmt ` and `data` chunks, and assert:

```ts
expect(format).toEqual({ audioFormat: 1, channels: 2, sampleRate: 22050, bitsPerSample: 16 })
expect(durationSec).toBeCloseTo(30.5, 3)
expect(peak).toBeLessThanOrEqual(0.9501)
expect(lastQuarterSecondRmsDb).toBeGreaterThan(-35)
expect(Math.abs(boundaryBeforeRmsDb - boundaryAfterRmsDb)).toBeLessThanOrEqual(3)
```

The boundary windows are the last and first 100 ms of the processed circular audio.

- [ ] **Step 2: Run the test and verify red**

Run: `npm test -- scripts/make-seamless-wav.test.ts`

Expected: FAIL because `scripts/make-seamless-wav.mjs` does not exist.

- [ ] **Step 3: Implement RIFF parsing and validation**

The script must:

1. Validate CLI arguments and RIFF/WAVE signatures.
2. Walk chunks with even-byte padding.
3. Require PCM format 1, 16 bits, positive channel/sample-rate values, and an aligned data chunk.
4. Convert 32 seconds and 1.5 seconds to integer frame indices with `Math.round`.
5. Reject a trim point outside the source or a crossfade that is not shorter than half the trimmed material.

Use frame-based indexing so stereo channels stay aligned.

- [ ] **Step 4: Implement rotation and equal-power crossfade**

For crossfade frame `i` in `[0, crossfadeFrames)` use:

```js
const progress = (i + 1) / crossfadeFrames
const tailGain = Math.cos(progress * Math.PI / 2)
const headGain = Math.sin(progress * Math.PI / 2)
const mixed = tailSample * tailGain + headSample * headGain
```

Build output frames as:

```text
source[crossfadeFrames .. trimFrames-crossfadeFrames)
+ blend(source[trimFrames-crossfadeFrames .. trimFrames), source[0 .. crossfadeFrames))
```

Scan the floating-point output peak. If it exceeds `32767 * 0.95`, multiply every output sample by `safePeak / peak`; then round once to signed 16-bit integers.

- [ ] **Step 5: Rewrite the WAV safely**

Preserve all bytes before the data payload, replace the data payload, update the data chunk size and RIFF size, and retain even-byte padding. Write only after all validation and processing succeeds. Print JSON containing:

```json
{
  "sourceDurationSec": 34.0136,
  "trimEndSec": 32,
  "crossfadeSec": 1.5,
  "outputDurationSec": 30.5,
  "peakScale": 1
}
```

The measured values may contain additional precision.

- [ ] **Step 6: Run the test and commit**

Run: `npm test -- scripts/make-seamless-wav.test.ts`

Expected: 1 test PASS with no stderr warnings.

Commit:

```bash
git add scripts/make-seamless-wav.mjs scripts/make-seamless-wav.test.ts
git commit -m "Add seamless WAV loop processor"
```

### Task 2: Process and verify the production rain asset

**Files:**
- Modify: `public/stories/pause-in-the-rain/audio/ambience/ambience-rain.wav`
- Modify: `docs/ASSET_INVENTORY.md`
- Modify: `AI_USAGE_LOG.md`

**Interfaces:**
- Consumes: tested CLI from Task 1 and the current amplified production rain WAV.
- Produces: the final 30.5-second production loop at the existing public URL.

- [ ] **Step 1: Apply the tested processor once**

Run:

```bash
node scripts/make-seamless-wav.mjs public/stories/pause-in-the-rain/audio/ambience/ambience-rain.wav 32 1.5
```

Expected JSON: source duration about 34.0136 seconds, output duration 30.5 seconds, crossfade 1.5 seconds, and a peak scale no greater than 1.

- [ ] **Step 2: Run the binary integration test against a fresh temporary copy**

Run: `npm test -- scripts/make-seamless-wav.test.ts`

The test constructs its own deterministic 34.01-second stereo WAV, so it remains repeatable after the production asset has been processed and stores no duplicate production asset in Git.

Expected: PASS for format, duration, peak, tail RMS, and circular boundary RMS.

- [ ] **Step 3: Measure the production asset independently**

Use a read-only Node PCM analyzer to report format, frame count, duration, full-file RMS/peak, first/last 100 ms RMS, and last 250 ms RMS.

Expected:

- Duration: `30.500 ± 0.001` seconds.
- Peak: at or below `-0.44 dB` (95% full scale).
- Last 250 ms RMS: above `-35 dB`.
- First/last 100 ms RMS difference: at most 3 dB.

- [ ] **Step 4: Update documentation and commit**

Record the removed 2.01-second fade, 1.5-second equal-power crossfade, final duration, measured boundary/peak results, test results, and any correction made during processing. Do not record secrets or private links.

Commit:

```bash
git add public/stories/pause-in-the-rain/audio/ambience/ambience-rain.wav docs/ASSET_INVENTORY.md AI_USAGE_LOG.md
git commit -m "Make rain ambience loop seamless"
```

### Task 3: Full verification and production release

**Files:**
- Modify: `AI_USAGE_LOG.md`

**Interfaces:**
- Consumes: the final WAV and unchanged story configuration.
- Produces: merged `main`, GitHub publication, Vercel deployment, and production loop evidence.

- [ ] **Step 1: Run full local verification**

Run:

```bash
npm run typecheck
npm test
npm run build
git diff --check
```

Expected: all commands exit 0 and all tests pass.

- [ ] **Step 2: Check local story resources**

Start Vite and request all unique story asset URLs gathered recursively from `story.json`.

Expected: all 69 resources return HTTP 200, including the shortened rain WAV.

- [ ] **Step 3: Verify more than two loops in Chromium**

Use a trusted click on “开始故事”, set speech volume to zero for deterministic timing, and observe the active rain Howl for at least 62 seconds.

Expected:

- The same rain Howl remains in `playing: true` state throughout.
- Its playback position wraps from about 30.5 seconds to the beginning at least twice.
- No interval between observations reports paused/stopped state.
- No audio or resource request fails.

- [ ] **Step 4: Merge, push, and verify Vercel**

After branch completion, merge by the user-selected workflow, push `main`, wait until the production WAV reports the new byte length/duration, then repeat the resource check and two-loop Chromium observation on `https://cassianrainstory.vercel.app`.

Expected: production serves the shortened WAV, all resources return HTTP 200, and at least two loop wraps occur without playback interruption.

- [ ] **Step 5: Close the audit record**

Record the final commit, measured local and production loop wraps, test count, build status, resource count, and unresolved limitations. Commit and push the audit-only update, then verify `HEAD` equals `origin/main` and the worktree is clean.
