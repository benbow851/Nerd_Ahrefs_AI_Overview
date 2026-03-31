import fs from 'fs'
import path from 'path'
import { loadEnvConfig } from '@next/env'

let cachedFile: { path: string; mtimeMs: number; value: string | undefined } | null =
  null

function discoverEnvLocalRoots(): string[] {
  const roots = new Set<string>()
  let dir = process.cwd()
  for (let i = 0; i < 12; i++) {
    roots.add(dir)
    const parent = path.dirname(dir)
    if (parent === dir) break
    dir = parent
  }
  return Array.from(roots)
}

/**
 * Parse AHREFS_API_KEY from .env.local without relying on process.env injection.
 */
function readAhrefsFromEnvLocalFile(projectRoot: string): string | undefined {
  const file = path.join(projectRoot, '.env.local')
  if (!fs.existsSync(file)) return undefined
  try {
    const st = fs.statSync(file)
    if (cachedFile && cachedFile.path === file && cachedFile.mtimeMs === st.mtimeMs) {
      return cachedFile.value
    }
    const text = fs.readFileSync(file, 'utf8')
    for (const line of text.split(/\r?\n/)) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue
      const eq = trimmed.indexOf('=')
      if (eq === -1) continue
      const key = trimmed
        .slice(0, eq)
        .trim()
        .replace(/^\uFEFF/, '')
      if (key !== 'AHREFS_API_KEY') continue
      let val = trimmed.slice(eq + 1).trim()
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1)
      }
      const t = val.trim()
      const value = t.length > 0 ? t : undefined
      cachedFile = { path: file, mtimeMs: st.mtimeMs, value }
      return value
    }
    cachedFile = { path: file, mtimeMs: st.mtimeMs, value: undefined }
    return undefined
  } catch {
    return undefined
  }
}

export function getAhrefsApiKey(): string | undefined {
  if (process.env.NODE_ENV === 'development') {
    loadEnvConfig(process.cwd(), true, { info: () => {}, error: console.error }, true)
  }

  const fromEnv = process.env.AHREFS_API_KEY
  if (typeof fromEnv === 'string') {
    const t = fromEnv.trim()
    if (t.length > 0) return t
  }

  for (const root of discoverEnvLocalRoots()) {
    const fromFile = readAhrefsFromEnvLocalFile(root)
    if (fromFile) {
      process.env.AHREFS_API_KEY = fromFile
      return fromFile
    }
  }

  return undefined
}
