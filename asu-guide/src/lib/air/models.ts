/**
 * Which AIR model each service uses, in preference order.
 *
 * The first entry is the primary; the rest are fallbacks, tried in order when a
 * model is *rejected* (unknown model, modality unsupported, deployment gone).
 * They are NOT tried because a model is slow — see ./call.ts for that
 * distinction. Latencies below were measured against the live gateway.
 */
export type AirService = 'title' | 'vision' | 'asr' | 'chat' | 'video' | 'summarize' | 'image'

export const AIR_BASE = process.env.AIR_BASE_URL ?? 'https://openai.rc.asu.edu/v1'

/** How long a model stays benched after the gateway refuses it. */
export const DISABLE_TTL_MS = 24 * 60 * 60 * 1000

export const MODELS: Record<AirService, string[]> = {
  // Naming a conversation. Cheap and tiny is the whole point.
  // qwen3-30b-a3b has only 3.3B active params and answered in 0.29s.
  title: [
    'qwen3-30b-a3b-instruct-2507',
    'llama4-scout-17b',
    'olmo3-7b-instruct',
    'granite41-30b',
    'qwen35-27b',
  ],

  // Describing an uploaded image. gemma4-31b-it was 1.78s vs 6.5s for qwen3-vl.
  // gemma3-27b-it is deliberately absent: vision is disabled on it (HTTP 400).
  vision: ['gemma4-31b-it', 'qwen3-vl-32b-instruct', 'llama4-scout-17b', 'qwen35-27b'],

  // Speech to text. qwen3-asr is ~3x faster than whisper at equal accuracy on
  // short utterances; whisper is the fallback and adds timestamps.
  asr: ['qwen3-asr-1p7b', 'whisper-large-v3'],

  // The reasoning model that owns the /api/chat conversation. Measured on a
  // 4-turn cross-modal prompt against the live gateway: qwen35-27b with
  // thinking off answered in 1.7s, gpt-oss-120b in 3.4s (and only once its
  // reasoning budget was raised — at 400 tokens it spent the lot thinking and
  // returned one word), qwen3-235b in 21s. All three cited events correctly, so
  // the fastest wins and the other two are fallbacks.
  chat: ['qwen35-27b', 'gpt-oss-120b', 'qwen3-235b-a22b-instruct-2507'],

  // Watching a clip. qwen3-vl is the only family on AIR that accepts a
  // video_url content part — gemma4 and glm-4-5v reject it outright.
  video: ['qwen3-vl-32b-instruct', 'qwen3-vl-32b-thinking'],

  // Fusing the visual description and the transcript into one answer. Tiny and
  // fast — this call should not dominate the pipeline.
  summarize: ['qwen3-30b-a3b-instruct-2507', 'llama4-scout-17b', 'qwen35-27b'],

  // Text to image. Only flux-2 and wan-2-2 are diffusion models on AIR.
  image: ['flux-2', 'wan-2-2'],
}

/** Models that need thinking explicitly switched off to answer promptly. */
export const THINKING_OFF = new Set(['qwen35-27b', 'qwen3-30b-a3b-instruct-2507'])
