
import http from 'node:http'

export async function waitOn(url: string, timeoutMs = 60000) {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    try {
      await fetchOnce(url)
      return
    } catch {}
    await new Promise(r => setTimeout(r, 250))
  }
  throw new Error(`Timeout waiting for ${url}`)
}

function fetchOnce(url: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const req = http.get(url, res => {
      res.resume()
      res.on('end', () => resolve())
    })
    req.on('error', reject)
    req.end()
  })
}
