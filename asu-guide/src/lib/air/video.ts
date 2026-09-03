import 'server-only'
import { spawn } from 'node:child_process'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const FFMPEG = process.env.FFMPEG_PATH ?? 'ffmpeg'
const FFPROBE = process.env.FFPROBE_PATH ?? 'ffprobe'

/** Below this mean volume the audio track is treated as silent. */
const SILENCE_FLOOR_DB = -45
/** Clips shorter than this aren't worth transcribing. */
const MIN_SPEECH_SECONDS = 0.8

function run(bin: string, args: string[]): Promise<{ code: number; stderr: string; stdout: string }> {
  return new Promise((resolve, reject) => {
    const p = spawn(bin, args)
    let stderr = ''
    let stdout = ''
    p.stderr.on('data', (d) => (stderr += d.toString()))
    p.stdout.on('data', (d) => (stdout += d.toString()))
    p.on('error', reject)
    p.on('close', (code) => resolve({ code: code ?? -1, stderr, stdout }))
  })
}

export type PreparedVideo = {
  dir: string
  /** Downscaled, silent MP4 small enough for the gateway's body limit. */
  videoPath: string
  /** Extracted audio, or null when the track is missing or effectively silent. */
  audioPath: string | null
  durationSeconds: number
  meanVolumeDb: number | null
  silenceReason: string | null
  cleanup: () => Promise<void>
}

/**
 * Turn an uploaded clip into the two inputs the models need.
 *
 * The gateway 413s around 3MB of base64, and phone video is far bigger than
 * that, so the visual track is downscaled hard (640px, 8fps, no audio). The
 * audio track is checked for actual signal first: ASR models hallucinate
 * confident text on silence, so a quiet clip is reported as having no speech
 * rather than transcribed.
 */
export async function prepareVideo(file: File): Promise<PreparedVideo> {
  const dir = await mkdtemp(join(tmpdir(), 'asu-guide-video-'))
  const cleanup = () => rm(dir, { recursive: true, force: true })

  try {
    const srcPath = join(dir, 'source')
    await writeFile(srcPath, Buffer.from(await file.arrayBuffer()))

    const probe = await run(FFPROBE, [
      '-v', 'error',
      '-show_entries', 'format=duration',
      '-show_entries', 'stream=codec_type',
      '-of', 'default=noprint_wrappers=1',
      srcPath,
    ])
    if (probe.code !== 0) throw new Error('That file could not be read as a video.')

    const durationSeconds = Number(/duration=([\d.]+)/.exec(probe.stdout)?.[1] ?? 0)
    const hasAudio = /codec_type=audio/.test(probe.stdout)

    const videoPath = join(dir, 'small.mp4')
    const shrink = await run(FFMPEG, [
      '-v', 'error', '-y',
      '-i', srcPath,
      '-vf', 'scale=-2:640,fps=8',
      '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '30',
      '-an',
      videoPath,
    ])
    if (shrink.code !== 0) throw new Error('Could not process that video.')

    let audioPath: string | null = null
    let meanVolumeDb: number | null = null
    let silenceReason: string | null = null

    if (!hasAudio) {
      silenceReason = 'This clip has no audio track.'
    } else if (durationSeconds < MIN_SPEECH_SECONDS) {
      silenceReason = 'This clip is too short to contain speech.'
    } else {
      const wavPath = join(dir, 'audio.wav')
      const extract = await run(FFMPEG, [
        '-v', 'error', '-y',
        '-i', srcPath,
        '-vn', '-ac', '1', '-ar', '16000', '-c:a', 'pcm_s16le',
        wavPath,
      ])

      if (extract.code !== 0) {
        silenceReason = 'The audio track could not be read.'
      } else {
        // volumedetect prints to stderr; null muxer keeps it cheap.
        const vol = await run(FFMPEG, ['-v', 'info', '-i', wavPath, '-af', 'volumedetect', '-f', 'null', '-'])
        const mean = Number(/mean_volume:\s*(-?[\d.]+) dB/.exec(vol.stderr)?.[1] ?? NaN)
        meanVolumeDb = Number.isFinite(mean) ? mean : null

        if (meanVolumeDb !== null && meanVolumeDb < SILENCE_FLOOR_DB) {
          silenceReason = `No audible speech (mean volume ${meanVolumeDb.toFixed(1)} dB).`
        } else {
          audioPath = wavPath
        }
      }
    }

    return { dir, videoPath, audioPath, durationSeconds, meanVolumeDb, silenceReason, cleanup }
  } catch (err) {
    await cleanup()
    throw err
  }
}

export async function readAsFile(path: string, name: string, type: string) {
  const buf = await readFile(path)
  return new File([new Uint8Array(buf)], name, { type })
}

export async function fileSize(path: string) {
  return (await readFile(path)).byteLength
}
