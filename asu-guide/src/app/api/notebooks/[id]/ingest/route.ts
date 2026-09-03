/**
 * Sequential page ingest for notebooks. Pages are read one at a time in order
 * so each OCR call can lean on the digest of the pages that came before it,
 * giving the vision model cross-page context for abbreviations and continued
 * lists. After every successful read the running digest is rewritten by the
 * chat model rather than appended to once at the end, so a partial upload
 * (network drop, gateway error) still leaves a coherent notebook state.
 */
import { NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { featureGate } from '@/lib/features'
import { safeError } from '@/lib/api-error'
import { airFetch, callAir } from '@/lib/air/call'
import { THINKING_OFF } from '@/lib/air/models'
import { addPage, getNotebook, nextPosition, setDigest } from '@/lib/notebooks'
import {
  DIGEST_MAX_TOKENS,
  PAGE_READER_MAX_TOKENS,
  digestMergePrompt,
  pageReaderPrompt,
} from '@/lib/notebook-prompts'

export const runtime = 'nodejs'
export const maxDuration = 300

const MAX_PAGES = 20
// The gateway 413s above roughly 3MB of base64 (~2.2MB of bytes). The client
// downscales first; this is the backstop, applied per page so one oversized
// photo does not sink the whole upload.
const AIR_SAFE_BYTES = 2_200_000

export type IngestEvent =
  | { type: 'page_start'; position: number; name: string }
  | {
      type: 'page_read'
      position: number
      status: 'read' | 'failed'
      reading: string
      model: string
      ms: number
      error?: string
    }
  | { type: 'digest'; position: number; digest: string; model: string; ms: number }
  | { type: 'done'; pages: number; digest: string }
  | { type: 'error'; error: string }

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const gate = featureGate('notebooks')
  if (gate) return gate
  const { id } = await params

  const session = await getSession()
  if (!session?.asurite) {
    return NextResponse.json({ error: 'Sign in to add pages.' }, { status: 401 })
  }

  const found = await getNotebook(id, session.asurite)
  if (!found) {
    return NextResponse.json({ error: 'No such notebook.' }, { status: 404 })
  }

  let form: FormData
  try {
    form = await req.formData()
  } catch {
    return NextResponse.json({ error: 'Expected multipart/form-data.' }, { status: 400 })
  }

  const files = form
    .getAll('pages')
    .filter((f): f is File => f instanceof File && f.size > 0 && f.type.startsWith('image/'))
  if (files.length === 0) {
    return NextResponse.json({ error: 'No page images supplied.' }, { status: 400 })
  }
  if (files.length > MAX_PAGES) {
    return NextResponse.json({ error: `At most ${MAX_PAGES} pages per upload.` }, { status: 400 })
  }

  const encoder = new TextEncoder()
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const emit = (ev: IngestEvent) =>
        controller.enqueue(encoder.encode(JSON.stringify(ev) + '\n'))
      try {
        await ingest(id, files, found.notebook.digest, emit)
      } catch (err) {
        emit({
          type: 'error',
          error: safeError(
            'notebooks/ingest',
            err,
            'Reading the pages failed partway. The pages already read are saved.',
          ),
        })
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'application/x-ndjson; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Accel-Buffering': 'no',
    },
  })
}

async function ingest(
  notebookId: string,
  files: File[],
  startingDigest: string,
  emit: (ev: IngestEvent) => void,
) {
  let digest = startingDigest
  let position = await nextPosition(notebookId)

  for (const file of files) {
    emit({ type: 'page_start', position, name: file.name })

    // Per-page size gate
    if (file.size > AIR_SAFE_BYTES) {
      await addPage({
        notebookId,
        position,
        imageName: file.name,
        reading: '',
        status: 'failed',
        model: '',
        ms: 0,
      })
      emit({
        type: 'page_read',
        position,
        status: 'failed',
        reading: '',
        model: '',
        ms: 0,
        error: 'Too large for the AIR gateway even after downscaling.',
      })
      position++
      continue
    }

    const dataUrl = `data:${file.type};base64,${Buffer.from(await file.arrayBuffer()).toString('base64')}`

    // Read the page
    let reading = ''
    let readStatus: 'read' | 'failed' = 'failed'
    let readModel = ''
    let readMs = 0
    let readError: string | undefined

    try {
      const read = await callAir('ocr', async (m) => {
        const res = await airFetch(
          '/chat/completions',
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              model: m,
              max_tokens: PAGE_READER_MAX_TOKENS,
              temperature: 0.1,
              ...(THINKING_OFF.has(m) ? { chat_template_kwargs: { enable_thinking: false } } : {}),
              messages: [
                {
                  role: 'user',
                  content: [
                    { type: 'text', text: pageReaderPrompt(position, digest) },
                    { type: 'image_url', image_url: { url: dataUrl } },
                  ],
                },
              ],
            }),
          },
          90_000,
        )
        const data = (await res.json()) as { choices?: { message?: { content?: string | null } }[] }
        const text = (data.choices?.[0]?.message?.content ?? '').trim()
        if (!text) throw new Error(`${m} returned an empty reading`)
        return text
      })

      reading = read.value
      readStatus = 'read'
      readModel = read.model
      readMs = read.ms
    } catch (err) {
      readError = safeError(
        'notebooks/ingest/read',
        err,
        'No vision model on AIR could read this page.',
      )
    }

    await addPage({
      notebookId,
      position,
      imageName: file.name,
      reading,
      status: readStatus,
      model: readModel,
      ms: readMs,
    })
    emit({
      type: 'page_read',
      position,
      status: readStatus,
      reading,
      model: readModel,
      ms: readMs,
      error: readError,
    })

    // Merge into the digest — failure here does NOT stop the loop
    if (readStatus === 'read') {
      try {
        const { system, user } = digestMergePrompt(digest, reading, position)
        const merged = await callAir('chat', async (m) => {
          const gptOss = m.startsWith('gpt-oss')
          const res = await airFetch(
            '/chat/completions',
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                model: m,
                max_tokens: gptOss ? DIGEST_MAX_TOKENS + 600 : DIGEST_MAX_TOKENS,
                temperature: 0.2,
                ...(gptOss ? { reasoning_effort: 'low' } : {}),
                ...(THINKING_OFF.has(m)
                  ? { chat_template_kwargs: { enable_thinking: false } }
                  : {}),
                messages: [
                  { role: 'system', content: system },
                  { role: 'user', content: user },
                ],
              }),
            },
            90_000,
          )
          const data = (await res.json()) as {
            choices?: { message?: { content?: string | null } }[]
          }
          const text = (data.choices?.[0]?.message?.content ?? '').trim()
          if (!text) throw new Error(`${m} returned an empty digest`)
          return text
        })

        digest = merged.value
        await setDigest(notebookId, digest, merged.model)
        emit({ type: 'digest', position, digest, model: merged.model, ms: merged.ms })
      } catch (err) {
        console.warn(`[notebooks/ingest] digest merge failed at page ${position}: ${err}`)
      }
    }

    position++
  }

  emit({ type: 'done', pages: files.length, digest })
}
