
import { fileURLToPath, pathToFileURL } from 'node:url'
import { resolve } from 'node:path'

export async function startNuxtDev(cwd: string) {
  // Dynamically import Nuxt to avoid ESM/CJS pitfalls
  const { loadNuxt, buildNuxt } = await import('nuxt')
  const nuxt = await loadNuxt({ cwd, dev: true, ready: false })
  await buildNuxt(nuxt)
  const listening = await nuxt.server.listen(3000)
  return {
    nuxt,
    url: 'http://localhost:3000',
    async close() {
      await nuxt.close()
    }
  }
}
