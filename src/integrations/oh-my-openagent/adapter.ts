import { createCommandSpec } from "../../core/executor"
import type { Plan } from "../../core/planner"
import type { PluginInstance } from "../../core/schema"

export const OH_MY_OPENAGENT_PLUGIN_PACKAGE = "oh-my-openagent"

export function createOhMyOpenAgentPlugin(toolId: string, configPath?: string): PluginInstance {
  return {
    toolId,
    kind: "oh-my-openagent",
    package: OH_MY_OPENAGENT_PLUGIN_PACKAGE,
    configPath,
    enabled: true,
  }
}

export function planOhMyOpenAgentInstall(plugin: PluginInstance): Plan<PluginInstance> {
  return {
    id: `${plugin.toolId}:plugin:oh-my-openagent:install`,
    title: "Install oh-my-openagent as an OpenCode plugin",
    targetId: plugin.toolId,
    output: plugin,
    commands: [createCommandSpec("oh-my-openagent", "bunx", [OH_MY_OPENAGENT_PLUGIN_PACKAGE, "install", "--no-tui", "--claude=max20", "--openai=no", "--gemini=no", "--copilot=no", "--skip-auth"])],
    issues: [],
  }
}
