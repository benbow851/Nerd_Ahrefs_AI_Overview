import { existsSync, readFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

/**
 * Read AHREFS_API_KEY from the nearest .env.local (walk up from cwd + repo dir).
 * Next sometimes omits server-only vars in the API route process; setting here is early & reliable.
 */
function injectAhrefsApiKeyFromEnvLocal() {
  if (process.env.AHREFS_API_KEY?.trim()) return

  const roots = new Set()
  let dir = process.cwd()
  for (let i = 0; i < 12; i++) {
    roots.add(dir)
    const parent = dirname(dir)
    if (parent === dir) break
    dir = parent
  }
  roots.add(__dirname)

  for (const root of roots) {
    const envPath = join(root, '.env.local')
    if (!existsSync(envPath)) continue
    try {
      const text = readFileSync(envPath, 'utf8')
      for (const line of text.split(/\r?\n/)) {
        const trimmed = line.trim()
        if (!trimmed || trimmed.startsWith('#')) continue
        const eq = trimmed.indexOf('=')
        if (eq === -1) continue
        const key = trimmed.slice(0, eq).trim().replace(/^\uFEFF/, '')
        if (key !== 'AHREFS_API_KEY') continue
        let val = trimmed.slice(eq + 1).trim()
        if (
          (val.startsWith('"') && val.endsWith('"')) ||
          (val.startsWith("'") && val.endsWith("'"))
        ) {
          val = val.slice(1, -1)
        }
        const t = val.trim()
        if (t) {
          process.env.AHREFS_API_KEY = t
        }
        return
      }
    } catch {
      /* ignore */
    }
  }
}

injectAhrefsApiKeyFromEnvLocal()

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
  },
}

export default nextConfig
