
import { createHydrator } from '@jamone19/nuxt-atomic/runtime'

type In = { name: string; email: string } & Record<string, any>
type Out = { name: string; email: string }

/** First PUT — create in Service A */
export const hydrate = createHydrator<In, Out>((input, ctx) => {
  return { name: input.name, email: input.email }
})
