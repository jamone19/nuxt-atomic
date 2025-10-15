
import express from 'express'
import cors from 'cors'
import bodyParser from 'body-parser'
import { nanoid } from 'nanoid'

export function createApp() {
  const app = express()
  app.use(cors())
  app.use(bodyParser.json())

  /** In-memory stores for demo */
  const users = new Map()           // id -> { id, name, email }
  const creditsLedger = []          // audit of credits/revocations

  app.get('/health', (req, res) => {
    res.json({ ok: true })
  })

  app.post('/mock/users', (req, res) => {
    const { name, email } = req.body || {}
    if (!name || !email) return res.status(400).json({ ok:false, error:'name and email required' })
    const id = nanoid(8)
    const user = { id, name, email }
    users.set(id, user)
    return res.json(user)
  })

  app.delete('/mock/users/:id', (req, res) => {
    const id = req.params.id
    users.delete(id)
    return res.json({ ok: true, deleted: id })
  })

  app.post('/mock/credits', (req, res) => {
    const { userId, amount } = req.body || {}
    if (!userId || typeof amount !== 'number') {
      return res.status(400).json({ ok:false, error:'userId and numeric amount required' })
    }
    creditsLedger.push({ t:'grant', userId, amount, ts: Date.now() })
    return res.json({ ok: true, userId, amount })
  })

  app.post('/mock/credits/revoke', (req, res) => {
    const { userId, amount } = req.body || {}
    creditsLedger.push({ t:'revoke', userId, amount, ts: Date.now() })
    return res.json({ ok: true, userId, amount })
  })

  // Extra GET endpoints for the flow demo
  app.get('/mock/users/:id/profile', (req, res) => {
    const id = req.params.id
    if (!users.has(id)) return res.status(404).json({ ok:false, error:'not found' })
    return res.json({ id, tier: 'gold', country: 'US' })
  })

  app.get('/mock/users/:id/recs', (req, res) => {
    const id = req.params.id
    if (!users.has(id)) return res.status(404).json({ ok:false, error:'not found' })
    return res.json({ id, interests: ['coding','music','gaming'] })
  })

  return app
}

export function createMockServer(port = 3001) {
  const app = createApp()
  return new Promise((resolve) => {
    const server = app.listen(port, () => resolve({ app, server, port }))
  })
}
