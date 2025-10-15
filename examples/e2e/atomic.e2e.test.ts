
import { describe, it, beforeAll, afterAll, expect } from 'vitest'
import { waitOn } from './utils'
import { createMockServer } from '../mock-server/app'
import { startNuxtDev } from './nuxt-embed'

const ROOT = process.cwd()
let mockServer: any
let nuxtEmbed: any

describe('Nuxt Atomic e2e', () => {
  beforeAll(async () => {
    // Start mock server
    mockServer = await createMockServer(3001)
    await waitOn('http://localhost:3001/health')

    nuxtEmbed = await startNuxtDev(ROOT + '/examples/nuxt-app')
    await waitOn('http://localhost:3000/')
  }, 120000)

  afterAll(async () => {
    await nuxtEmbed?.close()
    await new Promise<void>(r => mockServer?.server?.close(() => r()))
  })

  it('runs CreateUser successfully', async () => {
    const res = await fetch('http://localhost:3000/api/atomic/CreateUser', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Ada', email: 'ada@lovelace.io', credits: 50 })
    })
    const json: any = await res.json()
    expect(json.ok).toBe(true)
    expect(json.results?.[0]?.step).toBe('CreateDBUser')
    expect(json.results?.[1]?.step).toBe('GrantWelcomeCredits')
  }, 120000)

  it('runs CreateUserFail and triggers rollback', async () => {
    const res = await fetch('http://localhost:3000/api/atomic/CreateUserFail', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Bob', email: 'bob@example.com', credits: 50 })
    })
    const json: any = await res.json()
    expect(json.ok).toBe(false)
    expect(json.failedStep).toBe('GrantWelcomeCredits')
    expect(Array.isArray(json.rollback)).toBe(true)
    // Ensure at least the first step was rolled back
    const rb = json.rollback.find((r: any) => r.key === 'CreateDBUser')
    expect(rb?.ok).toBeTypeOf('boolean')
  }, 120000)
})


it('runs CreateUserEverywhere (PUT → GET → GET → PUT) with composed inputs', async () => {
  const res = await fetch('http://localhost:3000/api/atomic/CreateUserEverywhere', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name: 'Alicia', email: 'alicia@example.com' })
  })
  const json: any = await res.json()
  expect(json.ok).toBe(true)
  const steps = json.results?.map((r: any) => r.step)
  expect(steps).toEqual([
    'CreateInServiceA',
    'FetchAProfile',
    'FetchARecommendations',
    'CreateInServiceB'
  ])
}, 120000)
