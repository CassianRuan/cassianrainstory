import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'

const sampleRate = 22050
const channels = 2
const sourceFrames = 750000
const bytesPerFrame = channels * 2
const temporaryDirectories: string[] = []

function writeSyntheticRain(path: string): void {
  const dataSize = sourceFrames * bytesPerFrame
  const wav = Buffer.alloc(44 + dataSize)
  wav.write('RIFF', 0)
  wav.writeUInt32LE(wav.length - 8, 4)
  wav.write('WAVE', 8)
  wav.write('fmt ', 12)
  wav.writeUInt32LE(16, 16)
  wav.writeUInt16LE(1, 20)
  wav.writeUInt16LE(channels, 22)
  wav.writeUInt32LE(sampleRate, 24)
  wav.writeUInt32LE(sampleRate * bytesPerFrame, 28)
  wav.writeUInt16LE(bytesPerFrame, 32)
  wav.writeUInt16LE(16, 34)
  wav.write('data', 36)
  wav.writeUInt32LE(dataSize, 40)

  let seed = 0x12345678
  for (let frame = 0; frame < sourceFrames; frame += 1) {
    const seconds = frame / sampleRate
    const fade = seconds <= 32 ? 1 : Math.max(0, (sourceFrames / sampleRate - seconds) / (sourceFrames / sampleRate - 32))
    for (let channel = 0; channel < channels; channel += 1) {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0
      const noise = (seed / 0xffffffff) * 2 - 1
      const signal = (
        Math.sin(2 * Math.PI * (137 + channel * 11) * seconds) * 0.16
        + Math.sin(2 * Math.PI * (311 + channel * 17) * seconds) * 0.11
        + noise * 0.08
      ) * fade
      wav.writeInt16LE(Math.round(signal * 32767), 44 + (frame * channels + channel) * 2)
    }
  }
  writeFileSync(path, wav)
}

function parsePcm(path: string) {
  const wav = readFileSync(path)
  let offset = 12
  let format: { audioFormat: number; channels: number; sampleRate: number; bitsPerSample: number } | undefined
  let dataOffset = 0
  let dataSize = 0
  while (offset + 8 <= wav.length) {
    const id = wav.toString('ascii', offset, offset + 4)
    const size = wav.readUInt32LE(offset + 4)
    if (id === 'fmt ') {
      format = {
        audioFormat: wav.readUInt16LE(offset + 8),
        channels: wav.readUInt16LE(offset + 10),
        sampleRate: wav.readUInt32LE(offset + 12),
        bitsPerSample: wav.readUInt16LE(offset + 22),
      }
    }
    if (id === 'data') {
      dataOffset = offset + 8
      dataSize = size
      break
    }
    offset += 8 + size + (size % 2)
  }
  if (!format || !dataOffset || !dataSize) throw new Error('Invalid test WAV')
  const frames = dataSize / (format.channels * 2)
  const samples = Array.from({ length: dataSize / 2 }, (_, index) => wav.readInt16LE(dataOffset + index * 2) / 32768)
  return { format, frames, samples }
}

function rmsDb(samples: number[]): number {
  const rms = Math.sqrt(samples.reduce((sum, sample) => sum + sample * sample, 0) / samples.length)
  return 20 * Math.log10(rms || 1e-12)
}

afterEach(() => {
  temporaryDirectories.splice(0).forEach((directory) => rmSync(directory, { recursive: true, force: true }))
})

describe('make-seamless-wav', () => {
  it('trims, rotates and crossfades a fading stereo WAV into a safe circular loop', () => {
    const directory = mkdtempSync(join(tmpdir(), 'rain-loop-'))
    temporaryDirectories.push(directory)
    const path = join(directory, 'rain.wav')
    writeSyntheticRain(path)

    execFileSync(process.execPath, ['scripts/make-seamless-wav.mjs', path, '32', '1.5'], { stdio: 'pipe' })

    const { format, frames, samples } = parsePcm(path)
    const windowSamples = Math.round(sampleRate * 0.1) * channels
    const lastQuarterSamples = Math.round(sampleRate * 0.25) * channels
    const peak = samples.reduce((maximum, sample) => Math.max(maximum, Math.abs(sample)), 0)
    const firstBoundaryRmsDb = rmsDb(samples.slice(0, windowSamples))
    const lastBoundaryRmsDb = rmsDb(samples.slice(-windowSamples))

    expect(format).toEqual({ audioFormat: 1, channels: 2, sampleRate: 22050, bitsPerSample: 16 })
    expect(frames / sampleRate).toBeCloseTo(30.5, 3)
    expect(peak).toBeLessThanOrEqual(0.9501)
    expect(rmsDb(samples.slice(-lastQuarterSamples))).toBeGreaterThan(-35)
    expect(Math.abs(lastBoundaryRmsDb - firstBoundaryRmsDb)).toBeLessThanOrEqual(3)
  })
})
