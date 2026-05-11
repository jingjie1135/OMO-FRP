import { formatCloudflareTunnelJson, formatCloudflareTunnelPlan } from "./formatter"
import { createCloudflareTunnelPlan } from "./plan"
import type { CloudflareTunnelOptions } from "./types"

export async function cloudflareTunnel(options: CloudflareTunnelOptions): Promise<number> {
  const plan = createCloudflareTunnelPlan(options)
  const output = options.json ? formatCloudflareTunnelJson(plan) : formatCloudflareTunnelPlan(plan)
  console.log(output)
  return plan.canExpose ? 0 : 1
}

export { createCloudflareTunnelPlan } from "./plan"
export type * from "./types"
