
import { createHydrator } from '@nuxt/nuxt-atomic/runtime'

/** Input can include chain/window accumulators */
type In = { name: string; email: string } & Record<string, any>
type Out = { name: string; email: string }

export const hydrate = createHydrator<In, Out>((input, ctx) => {
  return { name: input.name, email: input.email }
})
