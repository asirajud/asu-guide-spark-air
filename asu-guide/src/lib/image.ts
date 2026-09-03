'use client'

const MAX_EDGE = 1536
const QUALITY = 0.85

/**
 * Shrink an image in the browser before it goes to /api/vision.
 *
 * The AIR gateway rejects large request bodies with a 413 (measured: ~3MB of
 * base64 passes, ~5MB does not — and base64 inflates bytes by a third). A phone
 * photo or a retina screenshot clears that easily, so we cap the long edge and
 * re-encode as JPEG. Also cuts upload time and model latency.
 */
export async function downscaleImage(file: File): Promise<File> {
  if (!file.type.startsWith('image/') || file.type === 'image/gif') return file

  const url = URL.createObjectURL(file)
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image()
      el.onload = () => resolve(el)
      el.onerror = () => reject(new Error('Could not decode that image.'))
      el.src = url
    })

    const longEdge = Math.max(img.naturalWidth, img.naturalHeight)
    // Small enough already, and small enough on the wire — leave it alone.
    if (longEdge <= MAX_EDGE && file.size <= 1_500_000) return file

    const scale = Math.min(1, MAX_EDGE / longEdge)
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(img.naturalWidth * scale)
    canvas.height = Math.round(img.naturalHeight * scale)

    const ctx = canvas.getContext('2d')
    if (!ctx) return file
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height)

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/jpeg', QUALITY),
    )
    if (!blob || blob.size >= file.size) return file

    const name = file.name.replace(/\.[^.]+$/, '') + '.jpg'
    return new File([blob], name, { type: 'image/jpeg' })
  } catch {
    return file
  } finally {
    URL.revokeObjectURL(url)
  }
}
