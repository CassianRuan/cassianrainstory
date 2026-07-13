import { readFileSync, writeFileSync } from 'node:fs'

const [path, trimEndText, crossfadeText] = process.argv.slice(2)
const trimEndSec = Number(trimEndText)
const crossfadeSec = Number(crossfadeText)

if (!path || !Number.isFinite(trimEndSec) || trimEndSec <= 0 || !Number.isFinite(crossfadeSec) || crossfadeSec <= 0) {
  throw new Error('Usage: node scripts/make-seamless-wav.mjs <16-bit-pcm.wav> <trim-end-sec> <crossfade-sec>')
}

const wav = readFileSync(path)
if (wav.length < 12 || wav.toString('ascii', 0, 4) !== 'RIFF' || wav.toString('ascii', 8, 12) !== 'WAVE') {
  throw new Error('Input is not a RIFF/WAVE file')
}

let offset = 12
let format
let dataHeaderOffset
let dataOffset
let dataSize

while (offset + 8 <= wav.length) {
  const id = wav.toString('ascii', offset, offset + 4)
  const size = wav.readUInt32LE(offset + 4)
  const payloadOffset = offset + 8
  if (payloadOffset + size > wav.length) throw new Error(`Invalid ${id} chunk size`)
  if (id === 'fmt ') {
    if (size < 16) throw new Error('Invalid fmt chunk')
    format = {
      audioFormat: wav.readUInt16LE(payloadOffset),
      channels: wav.readUInt16LE(payloadOffset + 2),
      sampleRate: wav.readUInt32LE(payloadOffset + 4),
      blockAlign: wav.readUInt16LE(payloadOffset + 12),
      bitsPerSample: wav.readUInt16LE(payloadOffset + 14),
    }
  }
  if (id === 'data') {
    dataHeaderOffset = offset
    dataOffset = payloadOffset
    dataSize = size
    break
  }
  offset = payloadOffset + size + (size % 2)
}

if (!format || format.audioFormat !== 1 || format.bitsPerSample !== 16 || format.channels <= 0 || format.sampleRate <= 0) {
  throw new Error('Only 16-bit PCM WAV files with valid channels and sample rate are supported')
}
const bytesPerFrame = format.channels * 2
if (format.blockAlign !== bytesPerFrame || dataHeaderOffset === undefined || dataOffset === undefined || dataSize === undefined || dataSize % bytesPerFrame !== 0) {
  throw new Error('Invalid or unaligned PCM data chunk')
}

const sourceFrames = dataSize / bytesPerFrame
const trimFrames = Math.round(trimEndSec * format.sampleRate)
const crossfadeFrames = Math.round(crossfadeSec * format.sampleRate)
if (trimFrames <= 0 || trimFrames > sourceFrames) throw new Error('Trim point must be inside the source audio')
if (crossfadeFrames <= 0 || crossfadeFrames * 2 >= trimFrames) throw new Error('Crossfade must be shorter than half of the trimmed audio')

const outputFrames = trimFrames - crossfadeFrames
const outputSamples = new Float64Array(outputFrames * format.channels)
const middleEnd = trimFrames - crossfadeFrames
let outputIndex = 0

for (let frame = crossfadeFrames; frame < middleEnd; frame += 1) {
  for (let channel = 0; channel < format.channels; channel += 1) {
    outputSamples[outputIndex] = wav.readInt16LE(dataOffset + (frame * format.channels + channel) * 2)
    outputIndex += 1
  }
}

for (let frame = 0; frame < crossfadeFrames; frame += 1) {
  const progress = (frame + 1) / crossfadeFrames
  const tailGain = Math.cos(progress * Math.PI / 2)
  const headGain = Math.sin(progress * Math.PI / 2)
  for (let channel = 0; channel < format.channels; channel += 1) {
    const tail = wav.readInt16LE(dataOffset + ((middleEnd + frame) * format.channels + channel) * 2)
    const head = wav.readInt16LE(dataOffset + (frame * format.channels + channel) * 2)
    outputSamples[outputIndex] = tail * tailGain + head * headGain
    outputIndex += 1
  }
}

let outputPeak = 0
for (const sample of outputSamples) outputPeak = Math.max(outputPeak, Math.abs(sample))
const safePeak = 32767 * 0.95
const peakScale = outputPeak > safePeak ? safePeak / outputPeak : 1
const outputDataSize = outputSamples.length * 2
const outputData = Buffer.alloc(outputDataSize)
for (let index = 0; index < outputSamples.length; index += 1) {
  outputData.writeInt16LE(Math.round(outputSamples[index] * peakScale), index * 2)
}

const beforeData = Buffer.from(wav.subarray(0, dataOffset))
beforeData.writeUInt32LE(outputDataSize, dataHeaderOffset + 4)
const oldPadding = dataSize % 2
const suffix = wav.subarray(dataOffset + dataSize + oldPadding)
const newPadding = outputDataSize % 2 ? Buffer.alloc(1) : Buffer.alloc(0)
const outputWav = Buffer.concat([beforeData, outputData, newPadding, suffix])
outputWav.writeUInt32LE(outputWav.length - 8, 4)
writeFileSync(path, outputWav)

console.log(JSON.stringify({
  path,
  sourceDurationSec: sourceFrames / format.sampleRate,
  trimEndSec: trimFrames / format.sampleRate,
  crossfadeSec: crossfadeFrames / format.sampleRate,
  outputDurationSec: outputFrames / format.sampleRate,
  peakBeforeScale: outputPeak / 32768,
  peakScale,
  peakAfterScale: outputPeak * peakScale / 32768,
}))
