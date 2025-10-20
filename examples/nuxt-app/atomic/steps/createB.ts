
import { createHydrator } from '@jamone19/nuxt-atomic/runtime'

type In = {
  name?: string
  email?: string
  id?: string            // from Service A
  tier?: string          // from profile GET
  country?: string       // from profile GET
  interests?: string[]   // from recs GET
} & Record<string, any>

type Out = { aUserId: string; name: string; email: string; profile: { tier?: string; country?: string }, interests?: string[] }

/** Final PUT — create in Service B using original input + GET-window since last PUT */
export const hydrate = createHydrator<In, Out>((input, ctx) => {
  return {
    aUserId: String(input.id || ctx.chainAcc.id || ''),
    name: String(input.name || ''),
    email: String(input.email || ''),
    profile: { tier: input.tier, country: input.country },
    interests: Array.isArray(input.interests) ? input.interests : undefined
  }
})
