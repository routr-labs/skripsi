import { cpSync, existsSync, mkdirSync, rmSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const frontendRoot = resolve(here, '..')
const repoRoot = resolve(frontendRoot, '..')
const source = resolve(repoRoot, 'app/static/vendor')
const target = resolve(frontendRoot, 'public/static/vendor')

if (!existsSync(source)) {
  throw new Error(`Missing ${source}. Download browser vendor assets first.`)
}

rmSync(target, { recursive: true, force: true })
mkdirSync(resolve(target, '..'), { recursive: true })
cpSync(source, target, { recursive: true })
