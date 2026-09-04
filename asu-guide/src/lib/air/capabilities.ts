import type { AirService } from './models'

/**
 * How the admin dashboard groups the services.
 *
 * The code thinks in services — one per call site, each with its own fallback
 * chain. An admin thinks in capabilities: what the assistant can do. These are
 * the five, and each names the services it actually controls so nothing is
 * configured invisibly.
 */
export type Capability = {
  id: string
  name: string
  summary: string
  slots: { service: AirService; label: string; hint: string }[]
}

export const CAPABILITIES: Capability[] = [
  {
    id: 'reasoning',
    name: 'Reasoning',
    summary:
      'Owns the conversation. Decides which tools to call, reads what they return, and writes the answer.',
    slots: [
      {
        service: 'chat',
        label: 'Conversation model',
        hint: 'Every turn a student sends runs here. Latency shows up directly in the reply.',
      },
      {
        service: 'deep',
        label: 'Deep thinking',
        hint: 'Opt-in from the + menu. A reasoning model with its budget turned up; slower by design.',
      },
    ],
  },
  {
    id: 'workhorse',
    name: 'Workhorse',
    summary:
      'The small, fast jobs that run alongside a turn. Nobody waits on these, so cheap beats capable.',
    slots: [
      {
        service: 'title',
        label: 'Conversation titles',
        hint: 'Names a chat from its opening message, about a second after the first exchange.',
      },
      {
        service: 'summarize',
        label: 'Media summaries',
        hint: 'Fuses a visual description and a transcript into one answer.',
      },
    ],
  },
  {
    id: 'images',
    name: 'Images',
    summary: 'Reading what a student uploads, and generating new artwork.',
    slots: [
      {
        service: 'vision',
        label: 'Image reading',
        hint: 'Describes flyers and photos. Vision is disabled on some models even when the catalog lists them.',
      },
      {
        service: 'ocr',
        label: 'Page transcription',
        hint: 'Reads pages uploaded into a Notebook one at a time. Fidelity matters more than speed here.',
      },
      {
        service: 'image',
        label: 'Image generation',
        hint: 'Diffusion only. Most models in the catalog cannot do this at all.',
      },
    ],
  },
  {
    id: 'audio',
    name: 'Audio',
    summary: 'Turning speech into text for the voice composer.',
    slots: [
      {
        service: 'asr',
        label: 'Speech to text',
        hint: 'Runs on every voice message before the conversation model sees a word of it.',
      },
    ],
  },
  {
    id: 'video',
    name: 'Video',
    summary: 'Watching an uploaded clip.',
    slots: [
      {
        service: 'video',
        label: 'Video understanding',
        hint: 'Needs a model that accepts a video content part — most reject it outright.',
      },
    ],
  },
]

export const ALL_SLOTS = CAPABILITIES.flatMap((c) => c.slots)
export const CONFIGURABLE = new Set<AirService>(ALL_SLOTS.map((s) => s.service))
