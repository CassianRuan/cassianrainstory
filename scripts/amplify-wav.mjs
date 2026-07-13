import { readFileSync, writeFileSync } from 'node:fs'

const [path, gainText] = process.argv.slice(2)
const requestedGain = Number(gainText)

if (!path || !Number.isFinite(requestedGain) || requestedGain <= 0) {
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
  if (id === 'fmt ') {
    format = {
      audioFormat: wav.readUInt16LE(offset + 8),
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

if (!format || format.audioFormat !== 1 || format.bitsPerSample !== 16 || dataOffset === undefined || dataSize === undefined) {
  throw new Error('Only 16-bit PCM WAV files are supported')
}

let peak = 0
for (let index = dataOffset; index < dataOffset + dataSize; index += 2) {
  peak = Math.max(peak, Math.abs(wav.readInt16LE(index)))
}

const safePeak = Math.floor(32767 * 0.95)
const appliedGain = peak === 0 ? requestedGain : Math.min(requestedGain, safePeak / peak)

for (let index = dataOffset; index < dataOffset + dataSize; index += 2) {
  wav.writeInt16LE(Math.round(wav.readInt16LE(index) * appliedGain), index)
}

writeFileSync(path, wav)
console.log(JSON.stringify({ path, requestedGain, appliedGain, peakBefore: peak, peakAfter: Math.round(peak * appliedGain) }))
