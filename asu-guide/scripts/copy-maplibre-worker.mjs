import { copyFile, mkdir } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const dist = join(root, 'node_modules', 'maplibre-gl', 'dist')
const out = join(root, 'public', 'maplibre')

await mkdir(out, { recursive: true })

await Promise.all([
  copyFile(join(dist, 'maplibre-gl-worker.mjs'), join(out, 'maplibre-gl-worker.mjs')),
  copyFile(join(dist, 'maplibre-gl-worker.mjs.map'), join(out, 'maplibre-gl-worker.mjs.map')),
  copyFile(join(dist, 'maplibre-gl-shared.mjs'), join(out, 'maplibre-gl-shared.mjs')),
  copyFile(join(dist, 'maplibre-gl-shared.mjs.map'), join(out, 'maplibre-gl-shared.mjs.map')),
  copyFile(join(dist, 'maplibre-gl-worker-dev.mjs'), join(out, 'maplibre-gl-worker-dev.mjs')),
  copyFile(
    join(dist, 'maplibre-gl-worker-dev.mjs.map'),
    join(out, 'maplibre-gl-worker-dev.mjs.map'),
  ),
  copyFile(join(dist, 'maplibre-gl-shared-dev.mjs'), join(out, 'maplibre-gl-shared-dev.mjs')),
  copyFile(
    join(dist, 'maplibre-gl-shared-dev.mjs.map'),
    join(out, 'maplibre-gl-shared-dev.mjs.map'),
  ),
])
