
import { createHydrator } from '@nuxt/nuxt-atomic/runtime'

type In = { credits?: number } & Record<string, any>
type Out = { userId: string; amount: number }

export const hydrate = createHydrator<In, Out>((input, ctx) => {
  // Favor userId coming from previous step results (chainAcc/windowAcc)
  const userId = input.id || ctx.chainAcc.id
  return { userId, amount: typeof input.credits === 'number' ? input.credits : 100 }
})
