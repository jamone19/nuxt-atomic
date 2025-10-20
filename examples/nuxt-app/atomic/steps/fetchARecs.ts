
import { createHydrator } from '@jamone19/nuxt-atomic/runtime'

type In = { id?: string } & Record<string, any>
type Out = Record<string, never>

/** Second GET — fetch recs from Service A using the same id */
export const hydrate = createHydrator<In, Out>((input, ctx) => {
  return {}
})
