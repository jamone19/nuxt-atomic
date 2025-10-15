
import { createHydrator } from '@nuxt/nuxt-atomic/runtime'

type In = { id?: string } & Record<string, any>
type Out = Record<string, never> // GET uses URL params only

/** First GET — fetch profile from Service A using the id returned by CreateInServiceA */
export const hydrate = createHydrator<In, Out>((input, ctx) => {
  // no request body; the URL will template :id from input/chainAcc
  return {}
})
